"""
FastAPI backend for recording successful Stripe transactions
Run with: uvicorn main:app --reload --port 3002
"""

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    Text,
    JSON,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Any
import calendar
import re
import os
from dotenv import load_dotenv
from pathlib import Path
from jose import JWTError, jwt, jwk
import bcrypt
import secrets
import string
import secrets
import string
import stripe
import json
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# Load environment variables
# Try to load from backend-fastapi/.env first, then from root .env
load_dotenv()  # Load from backend-fastapi/.env
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')  # Also try root .env

# Initialize Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
    print("✅ Stripe API initialized")
else:
    print("⚠️ STRIPE_SECRET_KEY not set - Stripe product sync will be disabled")

SUPABASE_URL = os.getenv("SUPABASE_URL")
if SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.rstrip('/')
    SUPABASE_JWKS_URL = f"{SUPABASE_URL}/auth/v1/keys"
else:
    SUPABASE_JWKS_URL = None
    print("⚠️ SUPABASE_URL not set - Supabase OAuth exchange will be disabled")
SUPABASE_JWKS_API_KEY = (
    os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("VITE_SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SECRET_KEY")
)

# Security configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing - using bcrypt directly

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Database setup
# Supabase is now the REQUIRED database system - no SQLite fallback
# Set DATABASE_URL in backend-fastapi/.env to your Supabase connection string
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# Require DATABASE_URL to be set (Supabase is mandatory)
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError(
        "❌ DATABASE_URL environment variable is required!\n"
        "   Please set DATABASE_URL in backend-fastapi/.env\n"
        "   Get your connection string from: Supabase Dashboard → Settings → Database → Connection string (URI)\n"
        "   Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
    )

# Validate that we're using PostgreSQL/Supabase (not SQLite)
if not SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    raise ValueError(
        "❌ Invalid DATABASE_URL! Only PostgreSQL/Supabase is supported.\n"
        f"   Current value starts with: {SQLALCHEMY_DATABASE_URL[:20]}...\n"
        "   Please set DATABASE_URL to your Supabase PostgreSQL connection string."
    )

# PostgreSQL/Supabase connection
print("✅ Using Supabase/PostgreSQL database")
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # Add SSL requirement for Supabase
    connect_args={"sslmode": "require"} if "supabase.co" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    price = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    stripe_price_id = Column(String, nullable=True)
    stripe_product_id = Column(String, nullable=True)
    download_file = Column(String, nullable=True)  # Path to downloadable file
    subscription_tier = Column(String, nullable=True)  # User tier granted: 'standard', 'pro', or NULL (downloadable)
    # For Pro tier products: prepaid term length in months (1, 3, 6, 12). Used at checkout / webhooks.
    pro_subscription_months = Column(Integer, nullable=True)
    active = Column(Boolean, default=True)  # PostgreSQL/Supabase uses native boolean
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(String, unique=True, index=True)
    session_id = Column(String, index=True)
    email = Column(String, index=True)
    name = Column(String)
    amount = Column(Float)
    status = Column(String)
    product = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    tier = Column(String, default="standard")  # standard or pro
    email_optin = Column(Boolean, default=True, nullable=False)  # Marketing email opt-in preference
    subscription_expiration_date = Column(DateTime, nullable=True)  # When subscription expires (NULL = lifetime)
    subscription_status = Column(String, default="active", nullable=False)  # active, expired, cancelled
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=True)


class SavedEmail(Base):
    """Subscriber saved emails; server enforces user_id (do not trust client-only filters)."""

    __tablename__ = "saved_emails"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    template_id = Column(String, nullable=False)
    template_name = Column(String, nullable=False)
    html = Column(Text, nullable=False)
    elements = Column(JSON, nullable=False)
    sections = Column(JSON, nullable=True)
    description = Column(String, nullable=True)
    theme_css_mode = Column(String, nullable=True)
    storage_size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SavedTemplate(Base):
    """Subscriber composed templates; server enforces user_id."""

    __tablename__ = "saved_templates"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    html = Column(Text, nullable=False)
    components = Column(JSON, nullable=False)
    # DB column remains "metadata"; Python name cannot be "metadata" (reserved on DeclarativeBase).
    template_meta = Column("metadata", JSON, nullable=True)
    storage_size = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SupportTicket(Base):
    """Subscriber support tickets; created via API with user_id from JWT."""

    __tablename__ = "support_tickets"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    category = Column(String(32), nullable=False, default="general")
    status = Column(String(32), nullable=False, default="open")
    priority = Column(String(32), nullable=False, default="normal")
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class EmailAlertTemplate(Base):
    """Admin-editable subjects/HTML for transactional Resend messages (see docs/features/EmailAlerts.txt)."""

    __tablename__ = "email_alert_templates"

    event_key = Column(String(64), primary_key=True)
    enabled = Column(Boolean, nullable=False, default=True)
    subject_template = Column(Text, nullable=False)
    html_template = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SentTransactionalEmail(Base):
    """Audit log of transactional sends (success or failure)."""

    __tablename__ = "sent_transactional_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_key = Column(String(64), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient_email = Column(String(512), nullable=False, index=True)
    subject = Column(String(500), nullable=False)
    provider_message_id = Column(String(256), nullable=True)
    error_message = Column(Text, nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# Saved email limits (keep aligned with src/utils/savedEmailsStorage.ts)
SAVED_EMAIL_MAX_COUNT = 30
SAVED_EMAIL_MAX_STORAGE_BYTES = 10 * 1024 * 1024

# Create tables on startup (with clear error if DB unreachable)
def _ensure_tables():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        if "could not translate host name" in str(e) or "nodename nor servname" in str(e):
            raise RuntimeError(
                "Cannot resolve database host. Check:\n"
                "  1. Internet connection\n"
                "  2. DATABASE_URL in backend-fastapi/.env points to a valid Supabase project\n"
                "  3. Supabase project is not paused (Dashboard → Settings → General)\n"
                "  4. Host in URL is correct, e.g. db.YOUR_PROJECT_REF.supabase.co"
            ) from e
        raise
_ensure_tables()

import email_alerts_service


def _seed_email_alert_templates_db():
    db = SessionLocal()
    try:
        email_alerts_service.seed_all_default_templates(db)
    except Exception as e:
        print(f"⚠️ Email alert template seed skipped: {e}")
        db.rollback()
    finally:
        db.close()


_seed_email_alert_templates_db()


def _maybe_send_pro_upgrade_email(db: Session, user: User, old_tier: Optional[str]) -> None:
    old = normalize_account_tier_string(old_tier or "standard")
    new = normalize_account_tier_string(user.tier or "standard")
    if new == "pro" and old != "pro":
        email_alerts_service.send_transactional_if_enabled(
            db,
            event_key=email_alerts_service.EVENT_PRO_UPGRADE,
            recipient_email=user.email,
            user_id=user.id,
            context={"username": user.username},
        )


def _send_welcome_email(db: Session, user: User) -> None:
    email_alerts_service.send_transactional_if_enabled(
        db,
        event_key=email_alerts_service.EVENT_WELCOME,
        recipient_email=user.email,
        user_id=user.id,
        context={"username": user.username},
    )


# Pydantic Models
class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    currency: str = "USD"
    stripe_price_id: Optional[str] = None
    stripe_product_id: Optional[str] = None
    download_file: Optional[str] = None
    subscription_tier: Optional[str] = None  # 'standard', 'pro', or None (downloadable)
    pro_subscription_months: Optional[int] = None  # 1, 3, 6, or 12 for Pro products
    active: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    stripe_price_id: Optional[str] = None
    stripe_product_id: Optional[str] = None
    download_file: Optional[str] = None
    subscription_tier: Optional[str] = None  # 'standard', 'pro', or None (downloadable)
    pro_subscription_months: Optional[int] = None
    active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    price: float
    currency: str
    stripe_price_id: Optional[str]
    stripe_product_id: Optional[str]
    download_file: Optional[str]
    subscription_tier: Optional[str]  # 'standard', 'pro', or None (downloadable)
    pro_subscription_months: Optional[int] = None
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UpgradeSubscriptionRequest(BaseModel):
    """Target Pro product id from /api/products (subscription_tier=pro)."""
    product_id: str

class TransactionCreate(BaseModel):
    payment_id: str
    session_id: str
    email: str
    name: str
    amount: float
    status: str
    product: str

class TransactionResponse(BaseModel):
    id: int
    payment_id: str
    session_id: str
    email: str
    name: str
    amount: float
    status: str
    product: str
    created_at: datetime

    class Config:
        from_attributes = True

# Authentication models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    tier: str = "standard"

class AdminCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class StripeUserRegister(BaseModel):
    """Model for registering users from Stripe webhooks"""
    email: str
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    tier: str = "standard"
    payment_id: Optional[str] = None
    session_id: Optional[str] = None
    product_name: Optional[str] = None  # Product that triggered registration
    pro_subscription_months: Optional[int] = None  # 1, 3, 6, 12 for Pro purchases

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool = False
    user_type: str = "subscriber"
    tier: str = "standard"
    email_optin: Optional[bool] = True  # Marketing email opt-in preference
    subscription_expiration_date: Optional[datetime] = None  # When subscription expires (NULL = lifetime)
    subscription_status: str = "active"  # active, expired, cancelled
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AdminResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool = True
    user_type: str = "admin"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


class SavedEmailUpsertBody(BaseModel):
    """Payload from the email builder / library (camelCase)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    name: str
    templateId: str
    templateName: str
    html: str
    elements: List[Any] = Field(default_factory=list)
    sections: Optional[List[Any]] = None
    description: Optional[str] = None
    themeCssMode: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class SavedTemplateUpsertBody(BaseModel):
    """Template Composer / library payload (camelCase)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str
    name: str
    components: List[Any] = Field(default_factory=list)
    html: str
    themeCssMode: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class SupportTicketCreateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    subject: str = Field(..., min_length=1, max_length=500)
    body: str = Field(..., min_length=1, max_length=20000)
    category: str = Field(default="general", max_length=32)


class SupportTicketAdminUpdateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    status: Optional[str] = Field(default=None, max_length=32)
    priority: Optional[str] = Field(default=None, max_length=32)
    adminNotes: Optional[str] = Field(default=None, max_length=20000)


class EmailAlertTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_key: str
    enabled: bool
    subject_template: str
    html_template: str
    updated_at: Optional[datetime] = None


class EmailAlertTemplatePatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    enabled: Optional[bool] = None
    subject_template: Optional[str] = None
    html_template: Optional[str] = None


class SentTransactionalEmailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_key: str
    user_id: Optional[int] = None
    recipient_email: str
    subject: str
    provider_message_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None


def _subscriber_user_id_for_saved_emails(current_user) -> int:
    if getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Saved emails are only available for subscriber accounts.",
        )
    return int(current_user.id)


def _subscriber_user_id_for_tickets(current_user) -> int:
    if getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Support tickets can only be filed by subscriber accounts.",
        )
    return int(current_user.id)


TICKET_CATEGORIES = frozenset({"billing", "technical", "account", "general", "other"})
TICKET_PRIORITIES = frozenset({"low", "normal", "high"})
TICKET_STATUSES = frozenset({"open", "in_progress", "resolved", "closed"})


def _normalize_ticket_category(v: str) -> str:
    s = (v or "general").strip().lower()
    return s if s in TICKET_CATEGORIES else "general"


def _normalize_ticket_priority(v: str) -> str:
    s = (v or "normal").strip().lower()
    return s if s in TICKET_PRIORITIES else "normal"


def _normalize_ticket_status(v: str) -> str:
    s = (v or "open").strip().lower()
    return s if s in TICKET_STATUSES else "open"


def _ticket_sort_priority_key(row: SupportTicket):
    """Sort: high → normal → low, then newest first."""
    p = (row.priority or "normal").strip().lower()
    order = {"high": 0, "normal": 1, "low": 2}.get(p, 1)
    ts = row.created_at.timestamp() if row.created_at else 0.0
    return (order, -ts)


def _ticket_to_client(
    row: SupportTicket,
    *,
    include_admin_fields: bool = False,
    include_priority: bool = False,
    user: Optional[User] = None,
) -> dict:
    out: dict = {
        "id": row.id,
        "userId": row.user_id,
        "subject": row.subject,
        "body": row.body,
        "category": row.category,
        "status": row.status,
        "createdAt": row.created_at.isoformat() if row.created_at else "",
        "updatedAt": row.updated_at.isoformat() if row.updated_at else "",
    }
    if include_priority:
        out["priority"] = row.priority
    if include_admin_fields:
        out["adminNotes"] = row.admin_notes
        if user is not None:
            out["userUsername"] = user.username
            out["userEmail"] = user.email
    return out


def _saved_email_to_client(row: SavedEmail) -> dict:
    mode = row.theme_css_mode
    theme = mode if mode in ("light-only", "adaptive") else "adaptive"
    ca = row.created_at.isoformat() if row.created_at else ""
    ua = row.updated_at.isoformat() if row.updated_at else ""
    return {
        "id": row.id,
        "name": row.name,
        "templateId": row.template_id,
        "templateName": row.template_name,
        "html": row.html,
        "elements": row.elements or [],
        "sections": row.sections,
        "createdAt": ca,
        "updatedAt": ua,
        "description": row.description,
        "themeCssMode": theme,
    }


def _compute_saved_email_storage_bytes(
    *,
    email_id: str,
    name: str,
    template_id: str,
    template_name: str,
    html: str,
    elements: Any,
    sections: Any,
    description: Optional[str],
    theme_css_mode: Optional[str],
) -> int:
    payload = {
        "id": email_id,
        "name": name,
        "templateId": template_id,
        "templateName": template_name,
        "html": html,
        "elements": elements or [],
        "sections": sections,
        "description": description,
        "themeCssMode": theme_css_mode,
    }
    return len(json.dumps(payload, default=str).encode("utf-8"))


def _template_limits_for_account_tier(tier_raw: Optional[str]) -> dict:
    """Align with src/utils/userTiers.ts Pro vs Standard."""
    t = normalize_account_tier_string(tier_raw)
    if t == "pro":
        return {"max_templates": 10, "max_storage_mb": 5, "max_storage_bytes": 5 * 1024 * 1024}
    return {"max_templates": 0, "max_storage_mb": 0, "max_storage_bytes": 0}


def _target_user_id_for_saved_template_reads(
    current_user, requested_user_id: Optional[int], db: Session
) -> int:
    if getattr(current_user, "is_admin", False):
        if requested_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id query parameter is required for admin",
            )
        u = db.query(User).filter(User.id == int(requested_user_id)).first()
        if not u:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return int(requested_user_id)
    return _subscriber_user_id_for_saved_emails(current_user)


def _saved_template_to_client(row: SavedTemplate) -> dict:
    meta = row.template_meta if isinstance(row.template_meta, dict) else {}
    mode = meta.get("themeCssMode")
    theme = mode if mode in ("light-only", "adaptive") else "adaptive"
    ca = row.created_at.isoformat() if row.created_at else ""
    ua = row.updated_at.isoformat() if row.updated_at else ""
    return {
        "id": row.id,
        "name": row.name,
        "components": row.components or [],
        "createdAt": ca,
        "updatedAt": ua,
        "themeCssMode": theme,
    }


def _compute_saved_template_storage_bytes(
    *,
    template_id: str,
    name: str,
    components: Any,
    html: str,
    theme_css_mode: Optional[str],
) -> int:
    payload = {
        "id": template_id,
        "name": name,
        "components": components or [],
        "html": html,
        "themeCssMode": theme_css_mode,
    }
    return len(json.dumps(payload, default=str).encode("utf-8"))


def _saved_templates_storage_payload(
    uid: int, limits: dict, db: Session
) -> dict:
    rows = db.query(SavedTemplate).filter(SavedTemplate.user_id == uid).all()
    templates_count = len(rows)
    storage_used = sum((r.storage_size or 0) for r in rows)
    storage_used_mb = storage_used / (1024 * 1024)
    storage_limit_mb = limits["max_storage_mb"]
    storage_percentage = (storage_used_mb / storage_limit_mb) * 100 if storage_limit_mb > 0 else 0
    if limits["max_templates"] > 0:
        templates_remaining = max(0, limits["max_templates"] - templates_count)
    else:
        templates_remaining = 0
    templates_at_limit = limits["max_templates"] == 0 or (
        limits["max_templates"] > 0 and templates_count >= limits["max_templates"]
    )
    storage_at_limit = (
        storage_limit_mb > 0 and storage_used_mb > 0 and storage_used_mb >= storage_limit_mb
    )
    is_at_limit = templates_at_limit or storage_at_limit
    return {
        "templatesCount": templates_count,
        "storageUsed": storage_used,
        "storageUsedMB": storage_used_mb,
        "storageLimitMB": storage_limit_mb,
        "storagePercentage": storage_percentage,
        "templatesRemaining": templates_remaining,
        "isWarning": (storage_percentage >= 80 and storage_used_mb > 0)
        or (
            limits["max_templates"] > 0
            and templates_count >= limits["max_templates"] * 0.8
        ),
        "isCritical": (storage_percentage >= 90 and storage_used_mb > 0)
        or (
            limits["max_templates"] > 0
            and templates_count >= limits["max_templates"] * 0.9
        ),
        "isAtLimit": is_at_limit,
    }


# FastAPI app
app = FastAPI(
    title="Stripe Transaction API",
    description="Backend for recording successful Stripe transactions",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3001",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()

# Authentication utility functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    """Hash a password"""
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    return hashed.decode('utf-8')

VALID_PRO_SUBSCRIPTION_MONTHS = (1, 3, 6, 12)

def normalize_pro_subscription_months(months: Optional[int]) -> int:
    if months is not None and int(months) in VALID_PRO_SUBSCRIPTION_MONTHS:
        return int(months)
    return 12


def normalize_account_tier_string(value: Optional[str]) -> str:
    """
    Canonical tier for users: 'standard' or 'pro'.
    Handles DB/Stripe casing (e.g. 'Pro'), whitespace, and legacy 'starter'.
    Unknown values default to 'standard'.
    """
    if value is None:
        return "standard"
    s = str(value).strip().lower()
    if not s or s == "starter":
        return "standard"
    if s == "pro":
        return "pro"
    return "standard"


def parse_product_subscription_tier(value: Optional[str]) -> Optional[str]:
    """
    Normalize products.subscription_tier from the database.
    Returns 'standard', 'pro', or None if empty/unknown (caller may use product-name fallback).
    """
    if value is None:
        return None
    s = str(value).strip().lower()
    if not s:
        return None
    if s == "starter":
        return "standard"
    if s in ("standard", "pro"):
        return s
    return None


def add_utc_calendar_months(dt: datetime, months: int) -> datetime:
    """Add N calendar months in UTC (clamp day to valid end-of-month)."""
    if months <= 0:
        months = 1
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)

def _naive_utc(dt: datetime) -> datetime:
    """UTC wall time as naive datetime (matches most DB DateTime columns)."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def new_pro_period_starting_now(months: Optional[int]) -> datetime:
    """
    Pro term length starting from the current instant (UTC).
    Used for Standard→Pro purchases so we never stack on a stale subscription_expiration_date
    left on Standard accounts (which produced multi-year 'days remaining' after a 1-month plan).
    """
    n = normalize_pro_subscription_months(months)
    base = _naive_utc(datetime.now(timezone.utc))
    return add_utc_calendar_months(base, n)


def compute_pro_subscription_end(
    existing_expiration: Optional[datetime],
    months: Optional[int],
    now: Optional[datetime] = None,
) -> datetime:
    """Stack new Pro time onto an unexpired subscription; otherwise start from now."""
    now_naive = _naive_utc(now if now is not None else datetime.now(timezone.utc))
    n = normalize_pro_subscription_months(months)
    if existing_expiration is not None:
        exp_naive = _naive_utc(_subscription_expiration_utc(existing_expiration))
        if exp_naive > now_naive:
            base = exp_naive
            return add_utc_calendar_months(base, n)
    return add_utc_calendar_months(now_naive, n)

def calculate_subscription_expiration_date() -> datetime:
    """Legacy alias: 12 calendar months of Pro access from now."""
    return compute_pro_subscription_end(None, 12, None)

def pro_subscription_expiry_from_registration_anchor(registration_anchor: datetime, months: Optional[int]) -> datetime:
    """
    Pro end date anchored to account registration (same instant as users.created_at).
    Used when a new user is created with a Pro purchase.
    """
    return add_utc_calendar_months(registration_anchor, normalize_pro_subscription_months(months))

def infer_pro_months_from_product_name(product_name: Optional[str]) -> Optional[int]:
    if not product_name:
        return None
    match = re.search(r"(\d+)\s*months?", product_name.lower())
    if not match:
        return None
    n = int(match.group(1))
    return n if n in VALID_PRO_SUBSCRIPTION_MONTHS else None

def resolve_pro_months_from_stripe_product(stripe_product) -> Optional[int]:
    """Read pro_subscription_months from Stripe Product metadata, else infer from name."""
    meta = getattr(stripe_product, "metadata", None) or {}
    if isinstance(meta, dict):
        raw = meta.get("pro_subscription_months") or meta.get("pro_months")
    else:
        raw = None
    if raw not in (None, ""):
        try:
            n = int(raw)
            if n in VALID_PRO_SUBSCRIPTION_MONTHS:
                return n
        except (TypeError, ValueError):
            pass
    return infer_pro_months_from_product_name(getattr(stripe_product, "name", None))

def validate_product_pro_months(subscription_tier: Optional[str], pro_subscription_months: Optional[int]) -> None:
    if subscription_tier == 'pro':
        if pro_subscription_months is None or int(pro_subscription_months) not in VALID_PRO_SUBSCRIPTION_MONTHS:
            raise HTTPException(
                status_code=400,
                detail="Pro products must set pro_subscription_months to one of: 1, 3, 6, 12",
            )
        return
    if pro_subscription_months is not None:
        raise HTTPException(
            status_code=400,
            detail="pro_subscription_months may only be set when subscription_tier is 'pro'",
        )

def apply_subscription_purchase_to_user(
    user: User,
    tier: str,
    pro_subscription_months: Optional[int],
) -> None:
    tier = (tier or "standard").lower()
    if tier == "starter":
        tier = "standard"
    if tier == "standard":
        user.tier = "standard"
        user.subscription_expiration_date = None
        user.subscription_status = "active"
        return
    if tier == "pro":
        user.tier = "pro"
        user.subscription_expiration_date = compute_pro_subscription_end(
            user.subscription_expiration_date,
            pro_subscription_months,
        )
        user.subscription_status = "active"
        return

def _subscription_expiration_utc(dt: datetime) -> datetime:
    """Normalize DB timestamp to aware UTC for comparison (avoids naive/aware errors)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def pro_entitlement_currently_active(user: User) -> bool:
    """
    True if the account is Pro and the paid window has not ended (or Pro has no end date).
    Used to block Standard→Pro upgrade while an active Pro term is in effect.
    """
    if (user.tier or "").lower() != "pro":
        return False
    if not user.subscription_expiration_date:
        return True
    return _subscription_expiration_utc(user.subscription_expiration_date) > datetime.now(timezone.utc)


def check_and_update_subscription_status(user: User, db: Session) -> User:
    """
    Compare subscription_expiration_date to current UTC time and sync tier + status.

    - NULL end date: non-expiring access; ensure subscriber is active (e.g. lifetime Pro).
    - End date in the past: downgrade Pro to standard; set expired when appropriate.
    - End date in the future: user qualifies as Pro until that instant; ensure tier is pro
      and clear a stale expired status. Keeps cancelled until the period actually ends.

    Runs on sign-in (login), logout, GET /api/auth/me, and other subscription checks.
    """
    now = datetime.now(timezone.utc)

    # If user has no expiration date, they have lifetime access (keep as active)
    if not user.subscription_expiration_date:
        if user.subscription_status != "active":
            user.subscription_status = "active"
            db.commit()
            db.refresh(user)
        return user

    exp_utc = _subscription_expiration_utc(user.subscription_expiration_date)
    # Instant UTC comparison — not timedelta.days (wrong on last day when <24h remains).
    is_expired = exp_utc <= now
    days_until_expiration = (exp_utc - now).days

    if is_expired:
        # Past paid period: Pro entitlement ends → Standard tier (saved data may remain in DB; app access requires active Pro).
        updated = False
        if (user.tier or "").lower() == "pro":
            user.tier = "standard"
            updated = True
        if user.subscription_status == "cancelled":
            # Still cancelled; tier above already downgraded if it was Pro.
            pass
        elif user.subscription_status != "expired":
            user.subscription_status = "expired"
            updated = True
        if updated:
            db.commit()
            db.refresh(user)
            print(
                f"⏰ User {user.id} past subscription end: tier={user.tier}, status={user.subscription_status}"
            )
    else:
        # Paid window still open → absolute Pro until exp_utc; fixes stale standard tier in DB.
        updated = False
        if (user.tier or "").lower() != "pro":
            user.tier = "pro"
            updated = True
        # Cancelled but not expired: leave cancelled (access through end date).
        if user.subscription_status == "expired":
            user.subscription_status = "active"
            updated = True
        if updated:
            db.commit()
            db.refresh(user)
            print(
                f"✅ User {user.id} Pro valid until {exp_utc.isoformat()} "
                f"(~{days_until_expiration}d); tier=pro, status={user.subscription_status}"
            )

    return user

def authenticate_user(db: Session, username: str, password: str):
    """Authenticate a user or admin by username and password"""
    # First check admins table
    admin = db.query(Admin).filter(Admin.username == username).first()
    if admin:
        if verify_password(password, admin.hashed_password):
            return admin
        return False
    
    # Then check users table
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get the current authenticated user or admin from token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError as e:
        raise credentials_exception
    
    try:
        # First check admins table
        admin = db.query(Admin).filter(Admin.username == token_data.username).first()
        if admin:
            # Create a user-like object for admins
            admin_obj = type('AdminUser', (), {
                'id': admin.id,
                'username': admin.username,
                'email': admin.email,
                'is_admin': True,
                'user_type': 'admin',
                'tier': None,  # Admins don't have tiers
                'created_at': admin.created_at
            })()
            return admin_obj
        
        # Then check users table
        user = db.query(User).filter(User.username == token_data.username).first()
        if user is None:
            raise credentials_exception
        
        # Canonical tier (fixes DB values like "Pro", whitespace, legacy starter)
        user.tier = normalize_account_tier_string(getattr(user, "tier", None))
        
        # Add is_admin and user_type for compatibility
        user.is_admin = False
        user.user_type = "subscriber"
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_current_user: {e}")
        import traceback
        traceback.print_exc()
        raise credentials_exception

async def get_current_admin_user(current_user = Depends(get_current_user)):
    """Get the current authenticated admin user"""
    # Check if user is admin (from admins table)
    if not hasattr(current_user, 'is_admin') or not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

async def require_active_subscription(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Dependency to ensure user has an active subscription.
    """
    if hasattr(current_user, 'is_admin') and current_user.is_admin:
        return current_user
    
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = check_and_update_subscription_status(user, db)

    if user.subscription_expiration_date:
        exp_utc = _subscription_expiration_utc(user.subscription_expiration_date)
        if exp_utc > datetime.now(timezone.utc):
            return user

    # Check if subscription is active
    if user.subscription_status not in ['active', 'cancelled']:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied. Your subscription is {user.subscription_status}. Please renew your subscription to access this feature."
        )
    
    # If cancelled, check if still within expiration period
    if user.subscription_status == 'cancelled':
        if user.subscription_expiration_date:
            exp_utc = _subscription_expiration_utc(user.subscription_expiration_date)
            if exp_utc <= datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=403,
                    detail="Access denied. Your subscription has expired. Please renew to access this feature."
                )
    
    return user

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "FastAPI backend is running"}

@app.get("/api/health/db")
async def health_check_db(db: Session = Depends(get_db)):
    """Check database connection and products table"""
    try:
        from sqlalchemy import text
        
        # Test database connection
        db.execute(text("SELECT 1"))
        
        # Check if products table exists
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'products'
            );
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            return {
                "status": "error",
                "message": "Products table does not exist in database",
                "database_connected": True,
                "table_exists": False
            }
        
        # Try to query products
        product_count = db.query(Product).count()
        
        return {
            "status": "ok",
            "message": "Database connection successful",
            "database_connected": True,
            "table_exists": True,
            "product_count": product_count
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Database connection failed: {str(e)}",
            "database_connected": False,
            "error": str(e)
        }

# ========================================
# AUTHENTICATION ENDPOINTS
# ========================================

@app.post("/api/auth/register", response_model=UserResponse)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user (not admin)"""
    # Check if user already exists in users table
    existing_user = db.query(User).filter(
        (User.username == user.username) | (User.email == user.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered"
        )
    
    # Check if username/email exists in admins table
    existing_admin = db.query(Admin).filter(
        (Admin.username == user.username) | (Admin.email == user.email)
    ).first()
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered"
        )
    
    user_tier = "standard"
    expiration_date = None
    
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        tier=user_tier,
        subscription_expiration_date=expiration_date
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    _send_welcome_email(db, db_user)

    # Return as UserResponse
    return UserResponse(
        id=db_user.id,
        username=db_user.username,
        email=db_user.email,
        is_admin=False,
        user_type="subscriber",
        tier=db_user.tier,
        email_optin=getattr(db_user, 'email_optin', True),
        subscription_expiration_date=getattr(db_user, 'subscription_expiration_date', None),
        subscription_status=getattr(db_user, 'subscription_status', 'active'),
        created_at=db_user.created_at
    )

def generate_secure_password(length: int = 16) -> str:
    """Generate a secure random password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = ''.join(secrets.choice(alphabet) for i in range(length))
    return password

@app.get("/api/auth/check-email")
async def check_email_exists(email: str = Query(..., description="Email address to check"), db: Session = Depends(get_db)):
    """
    Check if an email address is already registered in the database.
    Returns whether the email exists and is available for registration.
    """
    try:
        if not email or '@' not in email:
            return {
                "exists": False,
                "available": True,
                "message": "Invalid email format"
            }
        
        # Check if email exists in users table
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        
        if user:
            return {
                "exists": True,
                "available": False,
                "message": "This email is already registered. Please use a different email or log in to your existing account."
            }
        
        return {
            "exists": False,
            "available": True,
            "message": "Email is available"
        }
    except Exception as e:
        print(f"❌ Error checking email: {e}")
        return {
            "exists": False,
            "available": True,
            "message": "Could not verify email availability"
        }

@app.post("/api/auth/register-from-session", response_model=UserResponse)
async def register_user_from_session(session_data: dict, db: Session = Depends(get_db)):
    """
    Register a user from confirmation page after successful payment.
    This endpoint is called directly from the frontend confirmation page.
    """
    try:
        # Extract data from session_data
        email = session_data.get('email')
        name = session_data.get('name', 'Customer')
        first_name = session_data.get('first_name')
        last_name = session_data.get('last_name')
        payment_id = session_data.get('payment_id')
        session_id = session_data.get('session_id')
        product_name = session_data.get('product_name')
        product_id = session_data.get('product_id')
        raw_months = session_data.get('pro_subscription_months')
        pro_from_payload: Optional[int] = None
        if raw_months is not None:
            try:
                pro_from_payload = int(raw_months)
            except (TypeError, ValueError):
                pro_from_payload = None
        
        print(f"\n" + "="*60)
        print(f"🔄 REGISTERING USER FROM CONFIRMATION PAGE")
        print(f"="*60)
        print(f"   Email: {email}")
        print(f"   Name: {name}")
        print(f"   Product: {product_name}")
        print(f"   Product ID: {product_id}")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        existing_admin = db.query(Admin).filter(Admin.email == email).first()
        if existing_admin:
            raise HTTPException(
                status_code=400,
                detail="Email is already registered as an admin"
            )
        
        product_row: Optional[Product] = None
        tier = None
        if product_id:
            try:
                print(f"🔍 Looking up product by ID: {product_id}")
                product_row = db.query(Product).filter(Product.id == product_id).first()
                if product_row:
                    tier = parse_product_subscription_tier(product_row.subscription_tier)
                    print(f"✅ Product found: {product_row.name}")
                    print(f"   Product subscription_tier: {tier or 'NULL'}")
                else:
                    print(f"⚠️ Product not found with ID: {product_id}")
            except Exception as e:
                print(f"❌ Error fetching product: {e}")
                import traceback
                traceback.print_exc()
        
        # If no tier from product, check product name to determine tier
        if not tier:
            print(f"⚠️ No subscription_tier in database, checking product name...")
            
            if not product_name:
                print(f"⚠️ No product name provided, defaulting to standard")
                tier = 'standard'
            else:
                product_name_lower = product_name.lower()
                
                # Check if product is downloadable (no registration)
                if 'bundle' in product_name_lower and 'template' in product_name_lower:
                    print(f"ℹ️ Product is downloadable, skipping registration")
                    raise HTTPException(status_code=200, detail="Product does not require user registration (downloadable product)")
                
                # Check product name for tier indicators
                if 'pro membership' in product_name_lower or 'pro' in product_name_lower:
                    tier = 'pro'
                    print(f"✅ Matched product name '{product_name}' → pro tier")
                elif 'email builder' in product_name_lower or 'standard' in product_name_lower:
                    tier = 'standard'
                    print(f"✅ Matched product name '{product_name}' → standard tier")
                else:
                    tier = 'standard'
                    print(f"⚠️ Could not determine tier from product name '{product_name}', defaulting to standard")
        
        user_tier = normalize_account_tier_string(tier)

        pro_months_resolved: Optional[int] = pro_from_payload
        if pro_months_resolved is None and product_row and product_row.pro_subscription_months is not None:
            pro_months_resolved = product_row.pro_subscription_months
        if pro_months_resolved is None and product_name:
            pro_months_resolved = infer_pro_months_from_product_name(product_name)

        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"ℹ️ User already exists — applying subscription purchase")
            old_tier_existing = existing_user.tier
            apply_subscription_purchase_to_user(existing_user, user_tier, pro_months_resolved)
            db.commit()
            db.refresh(existing_user)
            _maybe_send_pro_upgrade_email(db, existing_user, old_tier_existing)
            return UserResponse(
                id=existing_user.id,
                username=existing_user.username,
                email=existing_user.email,
                is_admin=False,
                user_type="subscriber",
                tier=normalize_account_tier_string(existing_user.tier),
                email_optin=getattr(existing_user, 'email_optin', True),
                subscription_expiration_date=getattr(existing_user, 'subscription_expiration_date', None),
                subscription_status=getattr(existing_user, 'subscription_status', 'active'),
                created_at=existing_user.created_at
            )
        
        # Generate username from email
        username = email.split('@')[0].lower()
        base_username = username
        counter = 1
        while db.query(User).filter(User.username == username).first() or \
              db.query(Admin).filter(Admin.username == username).first():
            username = f"{base_username}{counter}"
            counter += 1
        
        initial_password = payment_id or session_id or f"pay_{int(datetime.utcnow().timestamp())}"
        hashed_password = get_password_hash(initial_password)
        
        registration_anchor = datetime.utcnow()
        expiration_date = None
        if user_tier == "pro":
            expiration_date = pro_subscription_expiry_from_registration_anchor(
                registration_anchor,
                pro_months_resolved,
            )
            print(
                f"📅 Pro expiry from registration ({registration_anchor.isoformat()}): "
                f"{expiration_date.isoformat()} (months={normalize_pro_subscription_months(pro_months_resolved)})"
            )
        
        # Create user
        try:
            db_user = User(
                username=username,
                email=email,
                hashed_password=hashed_password,
                tier=user_tier,
                created_at=registration_anchor,
                subscription_expiration_date=expiration_date
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            _send_welcome_email(db, db_user)

            print(f"\n✅ USER REGISTRATION SUCCESSFUL")
            print(f"   User ID: {db_user.id}")
            print(f"   Username: {db_user.username}")
            print(f"   Tier: {user_tier}")

            return UserResponse(
                id=db_user.id,
                username=db_user.username,
                email=db_user.email,
                is_admin=False,
                user_type="subscriber",
                tier=db_user.tier,
                email_optin=getattr(db_user, 'email_optin', True),
                subscription_expiration_date=getattr(db_user, 'subscription_expiration_date', None),
                subscription_status=getattr(db_user, 'subscription_status', 'active'),
                created_at=db_user.created_at
            )
        except Exception as db_error:
            db.rollback()
            print(f"❌ Database error: {db_error}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Registration error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")

@app.post("/api/auth/register-from-stripe", response_model=UserResponse)
async def register_user_from_stripe(stripe_user: StripeUserRegister, db: Session = Depends(get_db)):
    """
    Register a new user from Stripe webhook after successful payment.
    """
    # Check if email exists in admins table
    existing_admin = db.query(Admin).filter(Admin.email == stripe_user.email).first()
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail="Email is already registered as an admin"
        )

    # Use product-derived tier (standard or pro). Stripe/DB may send "Pro" etc.
    user_tier = normalize_account_tier_string(stripe_user.tier)

    pro_months_payload: Optional[int] = stripe_user.pro_subscription_months
    if pro_months_payload is None and stripe_user.product_name:
        pro_months_payload = infer_pro_months_from_product_name(stripe_user.product_name)

    existing_user = db.query(User).filter(User.email == stripe_user.email).first()
    if existing_user:
        print(f"ℹ️ User with email {stripe_user.email} already exists — applying subscription purchase")
        old_tier_existing = existing_user.tier
        apply_subscription_purchase_to_user(existing_user, user_tier, pro_months_payload)
        db.commit()
        db.refresh(existing_user)
        _maybe_send_pro_upgrade_email(db, existing_user, old_tier_existing)
        return UserResponse(
            id=existing_user.id,
            username=existing_user.username,
            email=existing_user.email,
            is_admin=False,
            user_type="subscriber",
            tier=normalize_account_tier_string(existing_user.tier),
            email_optin=getattr(existing_user, 'email_optin', True),
            subscription_expiration_date=getattr(existing_user, 'subscription_expiration_date', None),
            subscription_status=getattr(existing_user, 'subscription_status', 'active'),
            created_at=existing_user.created_at
        )
    
    # Generate username from email (part before @)
    # This is simpler and more reliable than using first/last name
    base_username = stripe_user.email.split('@')[0]
    username = base_username.lower()
    
    # Ensure username is unique by appending numbers if needed
    original_username = username
    counter = 1
    while db.query(User).filter(User.username == username).first() or \
          db.query(Admin).filter(Admin.username == username).first():
        username = f"{original_username}{counter}"
        counter += 1
    
    print(f"   Generated username: {username} (from email: {stripe_user.email})")
    
    payment_id = stripe_user.payment_id or stripe_user.session_id or f"pay_{int(datetime.utcnow().timestamp())}"
    hashed_password = get_password_hash(payment_id)
    
    # Create new user
    try:
        print(f"\n💾 Creating user in database...")
        print(f"   Username: {username}")
        print(f"   Email: {stripe_user.email}")
        print(f"   Tier: {user_tier}")
        
        registration_anchor = datetime.utcnow()
        expiration_date = None
        if user_tier == "pro":
            expiration_date = pro_subscription_expiry_from_registration_anchor(
                registration_anchor,
                pro_months_payload,
            )
            print(
                f"📅 Pro expiry from registration ({registration_anchor.isoformat()}): "
                f"{expiration_date.isoformat()} (months={normalize_pro_subscription_months(pro_months_payload)})"
            )
        
        db_user = User(
            username=username,
            email=stripe_user.email,
            hashed_password=hashed_password,
            tier=user_tier,
            created_at=registration_anchor,
            subscription_expiration_date=expiration_date
        )
        db.add(db_user)
        print(f"   ✅ User object created, committing to database...")
        db.commit()
        print(f"   ✅ Database commit successful")
        db.refresh(db_user)
        print(f"   ✅ User refreshed, ID: {db_user.id}")
        _send_welcome_email(db, db_user)
    except Exception as db_error:
        print(f"\n❌ DATABASE ERROR:")
        print(f"   Error type: {type(db_error).__name__}")
        print(f"   Error message: {str(db_error)}")
        import traceback
        print(f"   Traceback:")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(db_error)}"
        )
    
    product_info = f" (Product: {stripe_user.product_name})" if stripe_user.product_name else ""
    print(f"\n✅ USER REGISTRATION SUCCESSFUL")
    print(f"   Email: {stripe_user.email}")
    print(f"   User ID: {db_user.id}")
    print(f"   Username: {db_user.username}")
    print(f"   Tier: {user_tier}{product_info}")
    print(f"   Customer Name: {stripe_user.name}")
    
    # Return as UserResponse
    return UserResponse(
        id=db_user.id,
        username=db_user.username,
        email=db_user.email,
        is_admin=False,
        user_type="subscriber",
        tier=db_user.tier,
        email_optin=getattr(db_user, 'email_optin', True),
        subscription_expiration_date=getattr(db_user, 'subscription_expiration_date', None),
        subscription_status=getattr(db_user, 'subscription_status', 'active'),
        created_at=db_user.created_at
    )

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and get access token. Also checks subscription expiration."""
    try:
        user = authenticate_user(db, form_data.username, form_data.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Sign-in: compare subscription_expiration_date to current UTC; restore Pro if still in paid window, downgrade when past end.
        if isinstance(user, User):
            user = check_and_update_subscription_status(user, db)
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in login endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/api/auth/logout")
async def logout(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Logout endpoint. Checks subscription expiration before logout.
    """
    try:
        # Check if this is a regular user (not admin)
        if not hasattr(current_user, 'is_admin') or not current_user.is_admin:
            user = db.query(User).filter(User.id == current_user.id).first()
            if user:
                # Check and update subscription status on logout
                user = check_and_update_subscription_status(user, db)
                print(f"🔍 Subscription status checked on logout for user {user.id}: {user.subscription_status}")
        
        return {"message": "Logged out successfully"}
    except Exception as e:
        print(f"Error in logout endpoint: {e}")
        # Still allow logout even if check fails
        return {"message": "Logged out successfully"}

class SupabaseExchangeRequest(BaseModel):
    access_token: str

def _fetch_supabase_jwks() -> dict:
    if not SUPABASE_JWKS_URL:
        raise HTTPException(status_code=400, detail="SUPABASE_URL is not configured")

    headers = {"User-Agent": "fastapi-supabase-jwt-exchange"}
    if SUPABASE_JWKS_API_KEY:
        headers["apikey"] = SUPABASE_JWKS_API_KEY
        headers["Authorization"] = f"Bearer {SUPABASE_JWKS_API_KEY}"

    req = Request(
        SUPABASE_JWKS_URL,
        headers=headers,
        method="GET",
    )
    with urlopen(req, timeout=10) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)

def _verify_supabase_jwt(access_token: str) -> dict:
    """
    Verify Supabase access token signature using Supabase JWKS.
    Returns decoded claims if valid, otherwise raises HTTPException.
    """
    try:
        unverified_header = jwt.get_unverified_header(access_token)
        kid = unverified_header.get("kid")
        if not kid:
            return _verify_supabase_token_via_userinfo(access_token)

        jwks = _fetch_supabase_jwks()
        keys = jwks.get("keys") or []
        if not keys:
            return _verify_supabase_token_via_userinfo(access_token)
        matching_key = next((k for k in keys if k.get("kid") == kid), None)
        if not matching_key:
            return _verify_supabase_token_via_userinfo(access_token)

        key = jwk.construct(matching_key)
        public_key_pem = key.to_pem().decode("utf-8")

        issuer = f"{SUPABASE_URL}/auth/v1" if SUPABASE_URL else None
        try:
            return jwt.decode(
                access_token,
                public_key_pem,
                algorithms=["RS256"],
                audience="authenticated",
                issuer=issuer,
            )
        except Exception:
            return jwt.decode(
                access_token,
                public_key_pem,
                algorithms=["RS256"],
                options={"verify_aud": False, "verify_iss": False},
            )
    except HTTPException:
        raise
    except Exception as e:
        try:
            return _verify_supabase_token_via_userinfo(access_token)
        except HTTPException:
            raise HTTPException(status_code=401, detail=f"Invalid Supabase token: {str(e)}")

def _verify_supabase_token_via_userinfo(access_token: str) -> dict:
    """
    Validate Supabase access token by calling Supabase Auth user endpoint.
    Works for projects that don't expose JWKS signing keys for local verification.
    """
    if not SUPABASE_URL:
        raise HTTPException(status_code=400, detail="SUPABASE_URL is not configured")

    auth_url = f"{SUPABASE_URL}/auth/v1/user"
    headers = {"Authorization": f"Bearer {access_token}"}
    if SUPABASE_JWKS_API_KEY:
        headers["apikey"] = SUPABASE_JWKS_API_KEY

    req = Request(auth_url, headers=headers, method="GET")
    try:
        with urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw)
            if not data.get("email"):
                raise HTTPException(status_code=400, detail="Supabase user payload missing email")
            return data
    except HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8")
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=f"Invalid Supabase token: {e} {body}".strip())

@app.post("/api/auth/supabase-exchange")
async def supabase_exchange(req: SupabaseExchangeRequest, db: Session = Depends(get_db)):
    """
    Exchange a Supabase OAuth session access token for the app's FastAPI JWT.
    On first login, it auto-creates a `users` row with free/standard access.
    """
    if not SUPABASE_URL:
        raise HTTPException(status_code=400, detail="SUPABASE_URL not configured")

    claims = _verify_supabase_jwt(req.access_token)

    email = claims.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Supabase token missing email claim")
    email = str(email).lower().strip()

    # Find existing user by email
    existing_user = db.query(User).filter(User.email == email).first()

    # Generate a stable username from email prefix, then make it unique.
    base_username = email.split('@')[0].lower()
    username = base_username
    counter = 1
    while db.query(User).filter(User.username == username).first() or \
          db.query(Admin).filter(Admin.username == username).first():
        username = f"{base_username}{counter}"
        counter += 1

    if existing_user:
        user = existing_user
        # Keep the existing tier. If legacy tier is missing, default to standard.
        if not user.tier:
            user.tier = "standard"
        if user.tier == "starter":
            user.tier = "standard"
        # Standard gets lifetime access; Pro keeps its existing expiration.
        if user.tier == "standard":
            user.subscription_expiration_date = None
            user.subscription_status = "active"
        db.commit()
        db.refresh(user)
    else:
        # Create user with a random password hash (Google doesn't use password login)
        random_password = f"google_{claims.get('sub')}_{secrets.token_urlsafe(24)}"
        hashed_password = get_password_hash(random_password)

        db_user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            tier="standard",
            subscription_expiration_date=None,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        user = db_user
        _send_welcome_email(db, user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires,
    )

    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
async def read_users_me(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current authenticated user or admin. Checks subscription expiration on access."""
    try:
        # Check if this is an admin by querying the admins table
        admin = db.query(Admin).filter(Admin.username == current_user.username).first()
        
        if admin:
            # This is an admin
            created_at = admin.created_at if admin.created_at else datetime.utcnow()
            return UserResponse(
                id=admin.id,
                username=admin.username,
                email=admin.email,
                is_admin=True,
                user_type='admin',
                tier='standard',  # Admins don't have tiers, but we return standard for compatibility
                email_optin=True,  # Admins always opted in
                subscription_status='active',  # Admins always active
                created_at=created_at
            )
        else:
            # This is a regular user
            user = db.query(User).filter(User.username == current_user.username).first()
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Check and update subscription status
            user = check_and_update_subscription_status(user, db)
            
            tier = normalize_account_tier_string(user.tier)
            
            created_at = user.created_at if user.created_at else datetime.utcnow()
            return UserResponse(
                id=user.id,
                username=user.username,
                email=user.email,
                is_admin=False,
                user_type='subscriber',
                tier=tier,
                email_optin=getattr(user, 'email_optin', True),
                subscription_expiration_date=getattr(user, 'subscription_expiration_date', None),
                subscription_status=getattr(user, 'subscription_status', 'active'),
                created_at=created_at
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in read_users_me: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error retrieving user data: {str(e)}")

@app.put("/api/auth/me/tier")
async def update_user_tier(
    tier: str = Query(..., description="User tier: standard or pro"),
    pro_months: Optional[int] = Query(
        None,
        description="For Pro: prepaid months (1, 3, 6, or 12). Default 12. Used when setting or extending Pro.",
    ),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user tier (self) - only for regular users, not admins"""
    
    # Admins don't have tiers
    if hasattr(current_user, 'is_admin') and current_user.is_admin:
        raise HTTPException(
            status_code=400,
            detail="Admins do not have tiers"
        )
    
    valid_tiers = ["standard", "pro"]
    tier = str(tier).strip().lower()
    if tier == "starter":
        tier = "standard"
    if tier not in valid_tiers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Must be one of: {', '.join(valid_tiers)}"
        )
    
    # Get the actual user from database
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_tier = user.tier
    old_exp = user.subscription_expiration_date
    user.tier = tier
    
    if tier == 'standard':
        user.subscription_expiration_date = None
        user.subscription_status = 'active'
    else:
        base_exp = old_exp if old_tier == 'pro' else None
        user.subscription_expiration_date = compute_pro_subscription_end(base_exp, pro_months, None)
        user.subscription_status = 'active'
        print(f"📅 Pro subscription expiration set to: {user.subscription_expiration_date.isoformat()} (months={normalize_pro_subscription_months(pro_months)})")
    
    db.commit()
    db.refresh(user)
    _maybe_send_pro_upgrade_email(db, user, old_tier)

    expiration_info = f" (expires: {user.subscription_expiration_date.isoformat()})" if user.subscription_expiration_date else " (lifetime access)"
    print(f"✅ Tier updated: {old_tier} → {tier}{expiration_info}")

    return {
        "message": "Tier updated successfully", 
        "tier": tier,
        "subscription_expiration_date": user.subscription_expiration_date.isoformat() if user.subscription_expiration_date else None
    }

@app.post("/api/subscriptions/cancel")
async def cancel_subscription(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel user's subscription.
    Subscription remains active until expiration date, then status changes to 'cancelled'.
    """
    # Admins don't have subscriptions
    if hasattr(current_user, 'is_admin') and current_user.is_admin:
        raise HTTPException(
            status_code=400,
            detail="Admins do not have subscriptions"
        )
    
    # Get the actual user from database
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if subscription is already cancelled
    if user.subscription_status == 'cancelled':
        return {
            "message": "Subscription is already cancelled",
            "subscription_status": "cancelled",
            "expiration_date": user.subscription_expiration_date.isoformat() if user.subscription_expiration_date else None
        }
    
    # Mark subscription as cancelled
    # It will remain active until expiration date
    old_status = user.subscription_status
    user.subscription_status = 'cancelled'
    db.commit()
    db.refresh(user)
    
    expiration_info = ""
    if user.subscription_expiration_date:
        days_remaining = (user.subscription_expiration_date - datetime.utcnow()).days
        expiration_info = f" Subscription remains active until {user.subscription_expiration_date.isoformat()} ({days_remaining} days remaining)."
    
    print(f"🚫 User {user.id} cancelled subscription. Status: {old_status} → cancelled.{expiration_info}")
    
    return {
        "message": "Subscription cancelled successfully." + expiration_info,
        "subscription_status": "cancelled",
        "expiration_date": user.subscription_expiration_date.isoformat() if user.subscription_expiration_date else None,
        "days_remaining": (user.subscription_expiration_date - datetime.utcnow()).days if user.subscription_expiration_date else None
    }

@app.post("/api/subscriptions/upgrade")
async def upgrade_subscription(
    body: UpgradeSubscriptionRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upgrade Standard → Pro for a chosen Pro product.
    Allowed for Standard accounts regardless of subscription_status (e.g. expired or cancelled Standard).
    Not allowed while Pro entitlement is still in effect (paid period not ended); see error detail for renewal wording.
    """
    # Admins don't have subscriptions
    if hasattr(current_user, 'is_admin') and current_user.is_admin:
        raise HTTPException(
            status_code=400,
            detail="Admins do not have subscriptions"
        )
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=400,
            detail="STRIPE_SECRET_KEY not configured. Please set it in your environment variables."
        )
    
    # Get the actual user from database
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user = check_and_update_subscription_status(user, db)

    if pro_entitlement_currently_active(user):
        if user.subscription_expiration_date:
            exp_local = user.subscription_expiration_date
            if exp_local.tzinfo is None:
                exp_display = exp_local.isoformat() + "Z"
            else:
                exp_display = exp_local.isoformat()
            raise HTTPException(
                status_code=400,
                detail=(
                    "You already have an active Pro subscription.\n\n"
                    f"Your current Pro access runs through {exp_display}.\n\n"
                    "Standard→Pro checkout here is only for members on Standard who do not already have Pro time left.\n\n"
                    "To extend Pro: use Renew subscription in Settings. Any new prepaid period starts the day after "
                    "your current Pro access ends — you keep Pro until that date, then the extra months apply from "
                    "there (your new term does not replace or interrupt the time you already paid for)."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail=(
                "You already have Pro access with no end date. "
                "The Standard→Pro upgrade checkout is only for accounts on Standard."
            ),
        )

    tier_norm = (user.tier or "standard").lower()
    if tier_norm == "starter":
        tier_norm = "standard"
    if tier_norm != "standard":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Standard→Pro upgrade is only for Standard accounts. Your current tier is “{user.tier}”."
            ),
        )
    
    # Resolve Standard baseline price (optional): used as upgrade credit vs selected Pro price.
    # Catalog may only have Pro SKUs (e.g. Stripe names without "standard"); then we charge full Pro price.
    from sqlalchemy import text, inspect, func, or_
    inspector = inspect(engine)
    columns = inspector.get_columns('products')
    active_column = next((col for col in columns if col['name'] == 'active'), None)

    tier_lower = func.lower(Product.subscription_tier)
    standard_query = db.query(Product).filter(or_(tier_lower == "standard", tier_lower == "starter"))

    if active_column and (str(active_column['type']) == 'VARCHAR' or 'character varying' in str(active_column['type']).lower()):
        standard_query = standard_query.filter(text("active::boolean = true"))
    else:
        standard_query = standard_query.filter(Product.active == True)

    standard_product = standard_query.first()
    pro_product = db.query(Product).filter(Product.id == body.product_id.strip()).first()

    if standard_product:
        try:
            standard_price = float(standard_product.price)
        except (TypeError, ValueError):
            standard_price = 0.0
            print(f"⚠️ Standard product {standard_product.id} has invalid price; using $0 baseline")
    else:
        standard_price = 0.0
        print(
            "⚠️ No active Standard (or starter) product in catalog — "
            "using $0 baseline; checkout amount is the selected Pro plan’s full price."
        )

    if not pro_product:
        raise HTTPException(
            status_code=404,
            detail="Product not found."
        )
    if isinstance(pro_product.active, str):
        pro_product.active = pro_product.active.lower() == "true"
    if not bool(pro_product.active):
        raise HTTPException(status_code=400, detail="Selected product is not available.")
    if (pro_product.subscription_tier or "").lower() != "pro":
        raise HTTPException(
            status_code=400,
            detail="Selected product is not a Pro subscription tier. Choose a Pro plan from the list."
        )
    
    if pro_product.price is None:
        raise HTTPException(
            status_code=400,
            detail="Selected Pro product has no price set. Update it in Products (gestión) or Stripe sync."
        )

    # Ensure currency is set
    if not pro_product.currency:
        pro_product.currency = "USD"  # Default to USD if not set
        print(f"⚠️ Pro product currency was None, defaulting to USD")

    # Calculate price difference (Pro minus Standard catalog price, or full Pro if no Standard row)
    try:
        price_difference = float(pro_product.price) - standard_price
        if standard_product:
            print(
                f"💰 Price difference: ${price_difference:.2f} "
                f"(Pro ${pro_product.price} - Standard ${standard_price})"
            )
        else:
            print(f"💰 Upgrade amount (no Standard product): ${price_difference:.2f} (full Pro ${pro_product.price})")
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error calculating price: {str(e)}. Pro price: {pro_product.price}, baseline: {standard_price}"
        )
    
    if price_difference <= 0:
        # If pro is cheaper or same price, apply upgrade in place
        old_tier_upgrade = user.tier
        user.tier = 'pro'
        user.subscription_expiration_date = new_pro_period_starting_now(
            pro_product.pro_subscription_months
        )
        user.subscription_status = "active"
        db.commit()
        db.refresh(user)
        _maybe_send_pro_upgrade_email(db, user, old_tier_upgrade)
        return {
            "message": "Subscription upgraded to Pro successfully",
            "tier": "pro",
            "price_difference": 0,
            "payment_required": False
        }
    
    # Create Stripe checkout session for the price difference
    try:
        # Get frontend URL from environment or use default
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        
        # Ensure currency is valid
        currency = (pro_product.currency or "USD").lower()
        if currency not in ['usd', 'eur', 'gbp', 'cad', 'aud']:
            currency = "usd"  # Default to USD for invalid currencies
        
        # Ensure unit_amount is positive and valid
        unit_amount = int(price_difference * 100)
        if unit_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid price difference: ${price_difference:.2f}. Pro price must be higher than Standard price."
            )
        
        pro_months = normalize_pro_subscription_months(pro_product.pro_subscription_months)
        if standard_product:
            line_name = f'Upgrade to Pro: {pro_product.name}'
            line_desc = f'Upgrade from Standard — {pro_product.name} ({pro_months} mo.)'
        else:
            line_name = f'Pro: {pro_product.name}'
            line_desc = (
                f'{pro_product.name} ({pro_months} mo.). '
                f'Full plan price (no separate Standard product in your catalog to offset).'
            )
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': currency,
                    'product_data': {
                        'name': line_name,
                        'description': line_desc
                    },
                    'unit_amount': unit_amount,  # Convert to cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/upgrade-success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/settings?upgrade=cancelled',
            metadata={
                'user_id': str(user.id),
                'upgrade_type': 'standard_to_pro',
                'current_tier': user.tier,
                'target_tier': 'pro',
                'target_product_id': pro_product.id,
                'pro_subscription_months': str(pro_months),
            },
            customer_email=user.email
        )
        
        return {
            "message": "Upgrade payment link generated",
            "tier": "pro",
            "price_difference": price_difference,
            "currency": currency.upper(),
            "payment_required": True,
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except stripe.error.StripeError as e:
        print(f"❌ Stripe error in upgrade: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=400,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Unexpected error in upgrade: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/api/subscriptions/upgrade-confirm")
async def confirm_upgrade(
    session_id: str = Query(..., description="Stripe checkout session ID"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirm upgrade after successful payment.
    Standard→Pro: new Pro end date is N months from payment time (does not stack on stale DB dates).
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=400,
            detail="STRIPE_SECRET_KEY not configured"
        )
    
    try:
        # Retrieve the checkout session from Stripe
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status != 'paid':
            raise HTTPException(
                status_code=400,
                detail="Payment not completed"
            )
        
        # Get user from metadata or current user
        user_id = int(session.metadata.get('user_id', current_user.id))
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify this is the current user (security check)
        if user.id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Cannot upgrade another user's subscription"
            )
        
        old_tier = user.tier
        user.tier = 'pro'
        target_product_id = session.metadata.get('target_product_id')
        months_val: Optional[int] = None
        if target_product_id:
            prod_row = db.query(Product).filter(Product.id == target_product_id).first()
            if prod_row and (prod_row.subscription_tier or "").lower() == "pro":
                months_val = prod_row.pro_subscription_months
        if months_val is None:
            meta_months = session.metadata.get('pro_subscription_months')
            if meta_months is not None:
                try:
                    months_val = int(meta_months)
                except (TypeError, ValueError):
                    pass
        user.subscription_expiration_date = new_pro_period_starting_now(months_val)
        user.subscription_status = "active"
        db.commit()
        db.refresh(user)
        _maybe_send_pro_upgrade_email(db, user, old_tier)

        print(
            f"✅ User {user.id} upgraded from {old_tier} to pro. "
            f"Expiration: {user.subscription_expiration_date}"
        )

        return {
            "message": "Subscription upgraded to Pro successfully",
            "tier": "pro",
            "expiration_date": user.subscription_expiration_date.isoformat() if user.subscription_expiration_date else None
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Stripe error: {str(e)}"
        )

@app.get("/api/subscriptions/renewal-eligibility")
async def check_renewal_eligibility(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if user is eligible for subscription renewal.
    Returns eligibility status and days until expiration.
    """
    # Admins don't have subscriptions
    if hasattr(current_user, 'is_admin') and current_user.is_admin:
        return {
            "eligible": False,
            "reason": "Admins do not have subscriptions"
        }
    
    # Get the actual user from database
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has a subscription with expiration date
    if not user.subscription_expiration_date:
        return {
            "eligible": False,
            "reason": "Lifetime subscription (no expiration date)"
        }
    
    # Calculate days until expiration
    now = datetime.utcnow()
    days_until_expiration = (user.subscription_expiration_date - now).days
    
    # Check eligibility: must be less than 20 days until expiration
    eligible = days_until_expiration < 20
    
    return {
        "eligible": eligible,
        "days_until_expiration": days_until_expiration,
        "expiration_date": user.subscription_expiration_date.isoformat(),
        "subscription_status": user.subscription_status,
        "tier": user.tier,
        "reason": f"Renewal available when subscription expires in less than 20 days. Currently {days_until_expiration} days remaining." if not eligible else "Eligible for renewal"
    }

@app.post("/api/subscriptions/renew")
async def renew_subscription(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate subscription renewal.
    User can renew when subscription expires in less than 20 days.
    After payment, new start date = old expiration date, new end date = start date + 1 year.
    """
    # Admins don't have subscriptions
    if hasattr(current_user, 'is_admin') and current_user.is_admin:
        raise HTTPException(
            status_code=400,
            detail="Admins do not have subscriptions"
        )
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=400,
            detail="STRIPE_SECRET_KEY not configured. Please set it in your environment variables."
        )
    
    # Get the actual user from database
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user has a subscription with expiration date
    if not user.subscription_expiration_date:
        raise HTTPException(
            status_code=400,
            detail="Cannot renew subscription without expiration date (lifetime subscription)"
        )
    
    # Check subscription status
    if user.subscription_status == 'cancelled':
        raise HTTPException(
            status_code=400,
            detail="Cannot renew a cancelled subscription. Please reactivate your subscription first."
        )
    
    # Calculate days until expiration
    now = datetime.utcnow()
    days_until_expiration = (user.subscription_expiration_date - now).days
    
    # Check eligibility: must be less than 20 days until expiration
    if days_until_expiration >= 20:
        raise HTTPException(
            status_code=400,
            detail=f"Renewal is only available when subscription expires in less than 20 days. Your subscription expires in {days_until_expiration} days."
        )
    
    # Get product for user's current tier
    from sqlalchemy import text, inspect
    inspector = inspect(engine)
    columns = inspector.get_columns('products')
    active_column = next((col for col in columns if col['name'] == 'active'), None)
    
    tier_query = db.query(Product).filter(Product.subscription_tier == user.tier)
    
    if active_column and (str(active_column['type']) == 'VARCHAR' or 'character varying' in str(active_column['type']).lower()):
        tier_query = tier_query.filter(text("active::boolean = true"))
    else:
        tier_query = tier_query.filter(Product.active == True)
    
    product = tier_query.first()
    
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"{user.tier.capitalize()} subscription product not found. Please ensure products are configured."
        )
    
    # Validate product price and currency
    if product.price is None:
        raise HTTPException(
            status_code=400,
            detail=f"Product price is not set correctly. Price: {product.price}"
        )
    
    # Ensure currency is set
    currency = (product.currency or "USD").lower()
    if currency not in ['usd', 'eur', 'gbp', 'cad', 'aud']:
        currency = "usd"
    
    # Create Stripe checkout session for renewal
    try:
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        
        # Ensure unit_amount is positive and valid
        unit_amount = int(float(product.price) * 100)
        if unit_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid product price: ${product.price:.2f}"
            )
        
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': currency,
                    'product_data': {
                        'name': f'Renew {user.tier.capitalize()} Subscription',
                        'description': f'Renew your {user.tier} subscription for another year'
                    },
                    'unit_amount': unit_amount,  # Convert to cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{frontend_url}/renewal-success?session_id={{CHECKOUT_SESSION_ID}}',
            cancel_url=f'{frontend_url}/settings?renewal=cancelled',
            metadata={
                'user_id': str(user.id),
                'renewal_type': 'subscription_renewal',
                'current_tier': user.tier,
                'old_expiration_date': user.subscription_expiration_date.isoformat()
            },
            customer_email=user.email
        )
        
        return {
            "message": "Renewal payment link generated",
            "tier": user.tier,
            "price": float(product.price),
            "currency": currency.upper(),
            "days_until_expiration": days_until_expiration,
            "current_expiration_date": user.subscription_expiration_date.isoformat(),
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id
        }
    except HTTPException:
        raise
    except stripe.error.StripeError as e:
        print(f"❌ Stripe error in renewal: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=400,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Unexpected error in renewal: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/api/subscriptions/renew-confirm")
async def confirm_renewal(
    session_id: str = Query(..., description="Stripe checkout session ID"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirm renewal after successful payment.
    New start date = old expiration date, new end date = start date + 1 year.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=400,
            detail="STRIPE_SECRET_KEY not configured"
        )
    
    try:
        # Retrieve the checkout session from Stripe
        session = stripe.checkout.Session.retrieve(session_id)
        
        if session.payment_status != 'paid':
            raise HTTPException(
                status_code=400,
                detail="Payment not completed"
            )
        
        # Get user from metadata or current user
        user_id = int(session.metadata.get('user_id', current_user.id))
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Verify this is the current user (security check)
        if user.id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Cannot renew another user's subscription"
            )
        
        # Get old expiration date from metadata (fallback to current if not in metadata)
        old_expiration_str = session.metadata.get('old_expiration_date')
        if old_expiration_str:
            old_expiration = datetime.fromisoformat(old_expiration_str.replace('Z', '+00:00'))
            if old_expiration.tzinfo:
                old_expiration = old_expiration.replace(tzinfo=None)
        else:
            # Fallback: use current expiration date
            if not user.subscription_expiration_date:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot renew subscription without expiration date"
                )
            old_expiration = user.subscription_expiration_date
        
        # Calculate new dates:
        # New start date = old expiration date
        new_start_date = old_expiration
        # New end date = new start date + 1 year
        new_end_date = new_start_date + timedelta(days=365)
        
        # Update user's expiration date
        user.subscription_expiration_date = new_end_date
        # Reset subscription status to active if it was expired
        if user.subscription_status == 'expired':
            user.subscription_status = 'active'
        
        db.commit()
        db.refresh(user)
        
        print(f"✅ User {user.id} subscription renewed:")
        print(f"   Old expiration: {old_expiration.isoformat()}")
        print(f"   New start date: {new_start_date.isoformat()}")
        print(f"   New expiration: {new_end_date.isoformat()}")
        
        return {
            "message": "Subscription renewed successfully",
            "tier": user.tier,
            "old_expiration_date": old_expiration.isoformat(),
            "new_start_date": new_start_date.isoformat(),
            "new_expiration_date": new_end_date.isoformat(),
            "subscription_status": user.subscription_status
        }
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error confirming renewal: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/api/users/{user_id}/tier")
async def get_user_tier(
    user_id: int,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get user tier (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    tier = user.tier or "standard"
    # Legacy support: convert 'starter' to 'standard'
    if tier == "starter":
        tier = "standard"
    
    return {"user_id": user_id, "tier": tier}

@app.get("/api/users", response_model=List[UserResponse])
async def get_all_users(
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all users (admin only) - returns only users, not admins"""
    users = db.query(User).all()
    result = []
    for user in users:
        result.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            is_admin=False,
            user_type="subscriber",
            tier=normalize_account_tier_string(user.tier),
            email_optin=getattr(user, 'email_optin', True),  # Default to True if column doesn't exist yet
            subscription_expiration_date=getattr(user, 'subscription_expiration_date', None),
            subscription_status=getattr(user, 'subscription_status', 'active'),
            created_at=user.created_at
        ))
    return result

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get user by ID (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_admin=False,
        user_type="subscriber",
        tier=normalize_account_tier_string(user.tier),
        email_optin=getattr(user, 'email_optin', True),
        subscription_expiration_date=getattr(user, 'subscription_expiration_date', None),
        subscription_status=getattr(user, 'subscription_status', 'active'),
        created_at=user.created_at
    )

@app.put("/api/users/{user_id}/tier")
async def update_user_tier_admin(
    user_id: int,
    tier: str = Query(..., description="User tier: standard or pro"),
    pro_months: Optional[int] = Query(
        None,
        description="For Pro: prepaid months (1, 3, 6, or 12). Default 12.",
    ),
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update user tier (admin only)"""
    
    valid_tiers = ["standard", "pro"]
    tier = str(tier).strip().lower()
    if tier == "starter":
        tier = "standard"
    if tier not in valid_tiers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Must be one of: {', '.join(valid_tiers)}"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_tier = user.tier
    old_exp = user.subscription_expiration_date
    user.tier = tier

    if tier == 'standard':
        user.subscription_expiration_date = None
        user.subscription_status = 'active'
    else:
        base_exp = old_exp if old_tier == 'pro' else None
        user.subscription_expiration_date = compute_pro_subscription_end(base_exp, pro_months, None)
        user.subscription_status = 'active'
        print(f"📅 Pro expiration: {user.subscription_expiration_date.isoformat()} (months={normalize_pro_subscription_months(pro_months)})")
    
    db.commit()
    db.refresh(user)
    _maybe_send_pro_upgrade_email(db, user, old_tier)

    expiration_info = f" (expires: {user.subscription_expiration_date.isoformat()})" if user.subscription_expiration_date else " (lifetime access)"
    print(f"✅ Tier updated by admin: {old_tier} → {tier}{expiration_info}")

    return {
        "message": "User tier updated successfully", 
        "user_id": user_id, 
        "tier": tier,
        "subscription_expiration_date": user.subscription_expiration_date.isoformat() if user.subscription_expiration_date else None
    }

@app.put("/api/users/me/email-optin")
async def update_email_optin(
    email_optin: bool = Query(..., description="Email opt-in preference: true or false"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's email opt-in preference (self)"""
    
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.email_optin = email_optin
    db.commit()
    db.refresh(user)
    
    print(f"✅ User {user.id} ({user.email}) email_optin updated to: {email_optin}")
    
    return {
        "message": "Email opt-in preference updated successfully",
        "email_optin": email_optin
    }

# ========================================
# ADMIN MANAGEMENT ENDPOINTS
# ========================================

@app.post("/api/admins", response_model=AdminResponse)
async def create_admin(
    admin: AdminCreate,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new admin (admin only)"""
    # Check if admin already exists
    existing_admin = db.query(Admin).filter(
        (Admin.username == admin.username) | (Admin.email == admin.email)
    ).first()
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered"
        )
    
    # Check if username/email exists in users table
    existing_user = db.query(User).filter(
        (User.username == admin.username) | (User.email == admin.email)
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered"
        )
    
    # Create new admin
    hashed_password = get_password_hash(admin.password)
    db_admin = Admin(
        username=admin.username,
        email=admin.email,
        hashed_password=hashed_password
    )
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)
    
    return AdminResponse(
        id=db_admin.id,
        username=db_admin.username,
        email=db_admin.email,
        is_admin=True,
        user_type="admin",
        created_at=db_admin.created_at
    )

@app.get("/api/admins", response_model=List[AdminResponse])
async def get_all_admins(
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all admins (admin only)"""
    admins = db.query(Admin).all()
    result = []
    for admin in admins:
        result.append(AdminResponse(
            id=admin.id,
            username=admin.username,
            email=admin.email,
            is_admin=True,
            user_type="admin",
            created_at=admin.created_at
        ))
    return result

@app.get("/api/admins/{admin_id}", response_model=AdminResponse)
async def get_admin_by_id(
    admin_id: int,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin by ID (admin only)"""
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    return AdminResponse(
        id=admin.id,
        username=admin.username,
        email=admin.email,
        is_admin=True,
        user_type="admin",
        created_at=admin.created_at
    )

@app.delete("/api/admins/{admin_id}")
async def delete_admin(
    admin_id: int,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete admin (admin only) - cannot delete yourself"""
    if current_user.id == admin_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete your own admin account"
        )
    
    admin = db.query(Admin).filter(Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    db.delete(admin)
    db.commit()
    
    return {"message": "Admin deleted successfully"}

# List files in _img directory
@app.get("/api/files")
async def list_files():
    try:
        # Get the parent directory of backend-fastapi (project root)
        project_root = Path(__file__).parent.parent
        img_dir = project_root / "_img"
        
        if not img_dir.exists():
            return {"files": []}
        
        # List all files in _img directory
        files = [f.name for f in img_dir.iterdir() if f.is_file()]
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing files: {str(e)}")

# ========================================
# PRODUCT ENDPOINTS
# ========================================

# Create product
@app.post("/api/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    product_id = f"prod_{int(datetime.utcnow().timestamp() * 1000)}"
    
    # Trim product name to remove leading/trailing spaces
    trimmed_name = product.name.strip()
    
    # Validate subscription_tier if provided
    if product.subscription_tier and product.subscription_tier not in ['standard', 'pro']:
        raise HTTPException(
            status_code=400,
            detail="subscription_tier must be 'standard', 'pro', or null (for downloadable products)"
        )
    validate_product_pro_months(product.subscription_tier, product.pro_subscription_months)
    
    db_product = Product(
        id=product_id,
        name=trimmed_name,  # Store trimmed name
        description=product.description,
        price=product.price,
        currency=product.currency,
        stripe_price_id=product.stripe_price_id,
        stripe_product_id=product.stripe_product_id,
        download_file=product.download_file,
        subscription_tier=product.subscription_tier,  # Store subscription tier
        pro_subscription_months=product.pro_subscription_months,
        active=bool(product.active)  # PostgreSQL uses native boolean
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Ensure boolean type
    db_product.active = bool(db_product.active)
    
    print(f"✅ Product created: {trimmed_name} (Tier: {product.subscription_tier or 'None - Downloadable'})")
    
    return db_product

# Get all products
@app.get("/api/products", response_model=List[ProductResponse])
async def get_products(active_only: bool = False, db: Session = Depends(get_db)):
    try:
        # First, verify table exists
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if 'products' not in tables:
            print("❌ Products table does not exist in database")
            raise HTTPException(
                status_code=500, 
                detail="Products table does not exist. Please run database migrations."
            )
        
        print(f"✅ Products table exists, querying...")
        
        # Check the actual type of the 'active' column
        from sqlalchemy import text, inspect
        inspector = inspect(engine)
        columns = inspector.get_columns('products')
        active_column = next((col for col in columns if col['name'] == 'active'), None)
        
        # Start fresh query
        query = db.query(Product)
        
        if active_only:
            # Handle both boolean and string types for 'active' column
            if active_column and str(active_column['type']) == 'VARCHAR' or 'character varying' in str(active_column['type']).lower():
                # Column is VARCHAR, use string comparison
                print("⚠️ Active column is VARCHAR, using string comparison")
                query = query.filter(text("active::boolean = true"))
            else:
                # Column is boolean, use normal comparison
                query = query.filter(Product.active == True)
        
        # Try ordering, but handle if created_at doesn't exist
        try:
            products = query.order_by(Product.created_at.desc()).all()
        except Exception as order_error:
            print(f"⚠️ Could not order by created_at: {order_error}, fetching without order")
            # Rollback and retry without ordering
            db.rollback()
            query = db.query(Product)
            if active_only:
                if active_column and str(active_column['type']) == 'VARCHAR' or 'character varying' in str(active_column['type']).lower():
                    query = query.filter(text("active::boolean = true"))
                else:
                    query = query.filter(Product.active == True)
            products = query.all()
        
        # Ensure boolean type (for backward compatibility)
        for p in products:
            if isinstance(p.active, str):
                p.active = p.active.lower() == "true"
            p.active = bool(p.active)
        
        print(f"✅ Retrieved {len(products)} products from database")
        return products
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Error fetching products: {error_msg}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching products: {error_msg}. Check backend logs for details."
        )

# Get product by ID
@app.get("/api/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Ensure boolean type (PostgreSQL uses native boolean)
    if isinstance(product.active, str):
        product.active = product.active.lower() == "true"
    product.active = bool(product.active)
    return product

# Update product
@app.put("/api/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product_update: ProductUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update fields
    update_data = product_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "name" and value is not None:
            # Trim product name
            setattr(db_product, key, value.strip())
        elif key == "subscription_tier":
            # Validate subscription_tier - allow None, 'standard', or 'pro'
            if value is not None and value not in ['standard', 'pro']:
                raise HTTPException(
                    status_code=400,
                    detail="subscription_tier must be 'standard', 'pro', or null (for downloadable products)"
                )
            setattr(db_product, key, value)
        elif key == "pro_subscription_months":
            setattr(db_product, key, value)
        elif key == "active" and value is not None:
            setattr(db_product, key, bool(value))  # PostgreSQL uses native boolean
        else:
            setattr(db_product, key, value)
    
    if db_product.subscription_tier != 'pro':
        db_product.pro_subscription_months = None
    else:
        if db_product.pro_subscription_months is None:
            db_product.pro_subscription_months = 12
        validate_product_pro_months('pro', db_product.pro_subscription_months)
    
    db_product.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_product)
    
    print(f"✅ Product updated: {db_product.name} (Tier: {db_product.subscription_tier or 'None - Downloadable'})")
    
    # Ensure boolean type
    db_product.active = bool(db_product.active)
    return db_product

# Delete product
@app.delete("/api/products/{product_id}")
async def delete_product(product_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()
    
    return {"message": "Product deleted successfully"}

# Sync products from Stripe
@app.post("/api/products/sync-from-stripe", response_model=List[ProductResponse])
async def sync_products_from_stripe(db: Session = Depends(get_db), current_user = Depends(get_current_admin_user)):
    """Fetch products from Stripe and sync them to the database"""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=400,
            detail="STRIPE_SECRET_KEY not configured. Please set it in your environment variables."
        )
    
    try:
        # Fetch all products from Stripe
        stripe_products = stripe.Product.list(limit=100, active=True)
        synced_products = []
        
        for stripe_product in stripe_products.data:
            # Get the default price for this product (first active price)
            prices = stripe.Price.list(product=stripe_product.id, active=True, limit=1)
            default_price = prices.data[0] if prices.data else None
            
            if not default_price:
                print(f"⚠️ Skipping product {stripe_product.name} - no active price found")
                continue
            
            # Convert price from cents to dollars
            price_amount = default_price.unit_amount / 100 if default_price.unit_amount else 0
            currency = default_price.currency.upper() if default_price.currency else "USD"
            
            # Check if product already exists in database by stripe_product_id
            existing_product = db.query(Product).filter(
                Product.stripe_product_id == stripe_product.id
            ).first()
            
            if existing_product:
                # Update existing product
                existing_product.name = stripe_product.name
                existing_product.description = stripe_product.description or ""
                existing_product.price = price_amount
                existing_product.currency = currency
                existing_product.stripe_price_id = default_price.id
                existing_product.active = stripe_product.active
                existing_product.updated_at = datetime.utcnow()
                
                # Try to infer subscription tier from product name
                product_name_lower = stripe_product.name.lower()
                if 'pro' in product_name_lower:
                    existing_product.subscription_tier = 'pro'
                elif 'standard' in product_name_lower:
                    existing_product.subscription_tier = 'standard'
                # Otherwise keep existing tier or leave as null
                if existing_product.subscription_tier == 'pro':
                    pm = resolve_pro_months_from_stripe_product(stripe_product)
                    existing_product.pro_subscription_months = pm if pm is not None else 12
                else:
                    existing_product.pro_subscription_months = None
                
                db.commit()
                db.refresh(existing_product)
                synced_products.append(existing_product)
                print(f"✅ Updated product: {stripe_product.name}")
            else:
                # Create new product
                product_id = f"prod_{int(datetime.utcnow().timestamp() * 1000)}"
                
                # Try to infer subscription tier from product name
                subscription_tier = None
                product_name_lower = stripe_product.name.lower()
                if 'pro' in product_name_lower:
                    subscription_tier = 'pro'
                elif 'standard' in product_name_lower:
                    subscription_tier = 'standard'
                
                pro_mo = resolve_pro_months_from_stripe_product(stripe_product) if subscription_tier == 'pro' else None
                if subscription_tier == 'pro' and pro_mo is None:
                    pro_mo = 12
                new_product = Product(
                    id=product_id,
                    name=stripe_product.name,
                    description=stripe_product.description or "",
                    price=price_amount,
                    currency=currency,
                    stripe_product_id=stripe_product.id,
                    stripe_price_id=default_price.id,
                    subscription_tier=subscription_tier,
                    pro_subscription_months=pro_mo,
                    active=stripe_product.active
                )
                
                db.add(new_product)
                db.commit()
                db.refresh(new_product)
                synced_products.append(new_product)
                print(f"✅ Created product: {stripe_product.name}")
        
        return synced_products
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Stripe API error: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error syncing products from Stripe: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error syncing products: {str(e)}"
        )

# ========================================
# TRANSACTION ENDPOINTS
# ========================================

# Create transaction
@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: TransactionCreate, db: Session = Depends(get_db)):
    # Check if transaction already exists
    existing = db.query(Transaction).filter(Transaction.payment_id == transaction.payment_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Transaction already exists")
    
    # Create new transaction
    db_transaction = Transaction(**transaction.model_dump())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    
    return db_transaction

# Get all transactions
@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    transactions = db.query(Transaction).offset(skip).limit(limit).all()
    return transactions

# Get transaction by payment ID
@app.get("/api/transactions/payment/{payment_id}", response_model=TransactionResponse)
async def get_transaction_by_payment_id(payment_id: str, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.payment_id == payment_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

# Get transaction by session ID
@app.get("/api/transactions/session/{session_id}", response_model=TransactionResponse)
async def get_transaction_by_session_id(session_id: str, db: Session = Depends(get_db)):
    transaction = db.query(Transaction).filter(Transaction.session_id == session_id).first()
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return transaction

# Get transaction by email
@app.get("/api/transactions/email/{email}", response_model=List[TransactionResponse])
async def get_transactions_by_email(email: str, db: Session = Depends(get_db)):
    transactions = db.query(Transaction).filter(Transaction.email == email).all()
    return transactions

# Get transaction statistics
@app.get("/api/transactions/stats")
async def get_stats(db: Session = Depends(get_db)):
    total_transactions = db.query(Transaction).count()
    total_revenue = db.query(Transaction).filter(Transaction.status == "paid").with_entities(
        Transaction.amount
    ).all()
    total_revenue = sum([t.amount for t in total_revenue])
    
    return {
        "total_transactions": total_transactions,
        "total_revenue": round(total_revenue, 2),
        "average_transaction": round(total_revenue / total_transactions, 2) if total_transactions > 0 else 0
    }

# ========================================
# PROTECTED ROUTES (Require Active Subscription)
# ========================================

@app.post("/api/email-builder/create")
async def create_email(
    email_data: dict,
    current_user = Depends(require_active_subscription),
    db: Session = Depends(get_db)
):
    """
    Create a new email using the email builder.
    Requires active subscription (or cancelled but not expired).
    """
    return {
        "message": "Email created successfully",
        "user_id": current_user.id,
        "subscription_status": current_user.subscription_status
    }

@app.post("/api/template-composer/create")
async def create_template(
    template_data: dict,
    current_user = Depends(require_active_subscription),
    db: Session = Depends(get_db)
):
    """
    Create a new template using the template composer.
    Requires active subscription (or cancelled but not expired).
    """
    return {
        "message": "Template created successfully",
        "user_id": current_user.id,
        "subscription_status": current_user.subscription_status
    }

@app.get("/api/saved-emails/storage-summary")
async def saved_emails_storage_summary(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate storage for the authenticated subscriber (server-side user_id only)."""
    uid = _subscriber_user_id_for_saved_emails(current_user)
    rows = db.query(SavedEmail).filter(SavedEmail.user_id == uid).all()
    emails_count = len(rows)
    storage_used = sum((r.storage_size or 0) for r in rows)
    storage_used_mb = storage_used / (1024 * 1024)
    storage_limit_mb = SAVED_EMAIL_MAX_STORAGE_BYTES / (1024 * 1024)
    storage_percentage = (storage_used / SAVED_EMAIL_MAX_STORAGE_BYTES) * 100 if SAVED_EMAIL_MAX_STORAGE_BYTES else 0
    emails_remaining = SAVED_EMAIL_MAX_COUNT - emails_count
    warn = 0.8
    crit = 0.9
    return {
        "emailsCount": emails_count,
        "storageUsed": storage_used,
        "storageUsedMB": storage_used_mb,
        "storageLimitMB": storage_limit_mb,
        "storagePercentage": storage_percentage,
        "emailsRemaining": emails_remaining,
        "isWarning": storage_percentage >= warn * 100
        or emails_count >= SAVED_EMAIL_MAX_COUNT * warn,
        "isCritical": storage_percentage >= crit * 100
        or emails_count >= SAVED_EMAIL_MAX_COUNT * crit,
        "isAtLimit": emails_count >= SAVED_EMAIL_MAX_COUNT or storage_percentage >= 100,
    }


@app.get("/api/saved-emails/can-save")
async def saved_emails_can_save(
    estimated_bytes: int = Query(0, ge=0, description="Approximate size of the new email in bytes"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_saved_emails(current_user)
    rows = db.query(SavedEmail).filter(SavedEmail.user_id == uid).all()
    emails_count = len(rows)
    storage_used = sum((r.storage_size or 0) for r in rows)
    if emails_count >= SAVED_EMAIL_MAX_COUNT:
        return {
            "canSave": False,
            "reason": f"You've reached the maximum limit of {SAVED_EMAIL_MAX_COUNT} saved emails. Please delete some emails to save new ones.",
        }
    estimated_total = storage_used + max(estimated_bytes, 0)
    if estimated_total > SAVED_EMAIL_MAX_STORAGE_BYTES:
        storage_used_mb = storage_used / (1024 * 1024)
        limit_mb = SAVED_EMAIL_MAX_STORAGE_BYTES / (1024 * 1024)
        return {
            "canSave": False,
            "reason": f"Not enough storage space. You're using {storage_used_mb:.2f} MB of {limit_mb:.0f} MB. Please delete some emails to free up space.",
        }
    return {"canSave": True}


@app.get("/api/saved-emails/name-exists")
async def saved_emails_name_exists(
    name: str = Query(..., min_length=1),
    exclude_email_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_saved_emails(current_user)
    trimmed = name.strip()
    if not trimmed:
        return {"exists": False}
    rows = db.query(SavedEmail).filter(SavedEmail.user_id == uid).all()
    tl = trimmed.lower()
    for r in rows:
        if exclude_email_id and r.id == exclude_email_id:
            continue
        if (r.name or "").strip().lower() == tl:
            return {"exists": True}
    return {"exists": False}


@app.get("/api/saved-emails")
async def list_saved_emails(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List saved emails for the authenticated subscriber only."""
    uid = _subscriber_user_id_for_saved_emails(current_user)
    rows = (
        db.query(SavedEmail)
        .filter(SavedEmail.user_id == uid)
        .order_by(SavedEmail.created_at.desc())
        .all()
    )
    return [_saved_email_to_client(r) for r in rows]


@app.put("/api/saved-emails")
async def upsert_saved_email(
    body: SavedEmailUpsertBody,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_saved_emails(current_user)
    theme_mode = body.themeCssMode if body.themeCssMode in ("light-only", "adaptive") else None
    storage_size = _compute_saved_email_storage_bytes(
        email_id=body.id,
        name=body.name,
        template_id=body.templateId,
        template_name=body.templateName,
        html=body.html,
        elements=body.elements,
        sections=body.sections,
        description=body.description,
        theme_css_mode=theme_mode,
    )

    existing = db.query(SavedEmail).filter(SavedEmail.id == body.id).first()
    if existing is not None:
        if int(existing.user_id) != uid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email id is already used by another account.",
            )
        rows_same_user = db.query(SavedEmail).filter(SavedEmail.user_id == uid).all()
        storage_used = sum((r.storage_size or 0) for r in rows_same_user) - (existing.storage_size or 0)
        if storage_used + storage_size > SAVED_EMAIL_MAX_STORAGE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough storage space to save this email.",
            )
        existing.name = body.name
        existing.template_id = body.templateId
        existing.template_name = body.templateName
        existing.html = body.html
        existing.elements = body.elements or []
        existing.sections = body.sections
        existing.description = body.description
        existing.theme_css_mode = theme_mode
        existing.storage_size = storage_size
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return _saved_email_to_client(existing)

    count = db.query(SavedEmail).filter(SavedEmail.user_id == uid).count()
    if count >= SAVED_EMAIL_MAX_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {SAVED_EMAIL_MAX_COUNT} saved emails reached.",
        )
    rows_same_user = db.query(SavedEmail).filter(SavedEmail.user_id == uid).all()
    storage_used = sum((r.storage_size or 0) for r in rows_same_user)
    if storage_used + storage_size > SAVED_EMAIL_MAX_STORAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not enough storage space to save this email.",
        )

    now = datetime.now(timezone.utc)
    row = SavedEmail(
        id=body.id,
        user_id=uid,
        name=body.name,
        template_id=body.templateId,
        template_name=body.templateName,
        html=body.html,
        elements=body.elements or [],
        sections=body.sections,
        description=body.description,
        theme_css_mode=theme_mode,
        storage_size=storage_size,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        if "ux_support_tickets_one_active_per_user" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an active support ticket. Please wait until it is closed before creating another.",
            ) from e
        raise
    db.refresh(row)
    return _saved_email_to_client(row)


@app.get("/api/saved-emails/{email_id}/export")
async def export_saved_email(
    email_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_saved_emails(current_user)
    row = (
        db.query(SavedEmail)
        .filter(SavedEmail.user_id == uid, SavedEmail.id == email_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved email not found")
    return {"name": row.name or "email", "html": row.html or ""}


@app.get("/api/saved-emails/{email_id}")
async def get_saved_email(
    email_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_saved_emails(current_user)
    row = (
        db.query(SavedEmail)
        .filter(SavedEmail.user_id == uid, SavedEmail.id == email_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved email not found")
    return _saved_email_to_client(row)


@app.delete("/api/saved-emails/{email_id}")
async def delete_saved_email(
    email_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_saved_emails(current_user)
    q = db.query(SavedEmail).filter(SavedEmail.user_id == uid, SavedEmail.id == email_id)
    deleted = q.delete(synchronize_session=False)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved email not found")
    db.commit()
    return {"ok": True}


@app.post("/api/tickets")
async def create_support_ticket(
    body: SupportTicketCreateBody,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_tickets(current_user)
    existing_active = (
        db.query(SupportTicket)
        .filter(
            SupportTicket.user_id == uid,
            SupportTicket.status != "closed",
        )
        .order_by(SupportTicket.created_at.desc())
        .first()
    )
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active support ticket. Please wait until it is closed before creating another.",
        )

    cat = _normalize_ticket_category(body.category)
    now = datetime.now(timezone.utc)
    tid = str(uuid.uuid4())
    row = SupportTicket(
        id=tid,
        user_id=uid,
        subject=body.subject.strip(),
        body=body.body.strip(),
        category=cat,
        status="open",
        priority="normal",
        admin_notes=None,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    u = db.query(User).filter(User.id == uid).first()
    if u:
        preview = (row.body or "")[:400]
        email_alerts_service.send_transactional_if_enabled(
            db,
            event_key=email_alerts_service.EVENT_TICKET_CREATED,
            recipient_email=u.email,
            user_id=u.id,
            context={
                "username": u.username,
                "ticket_id": row.id,
                "ticket_id_short": row.id[:8],
                "ticket_subject": row.subject,
                "ticket_category": row.category,
                "ticket_status": row.status,
                "ticket_body_preview": preview,
            },
        )
    return _ticket_to_client(row, include_admin_fields=False, include_priority=False)


@app.get("/api/tickets")
async def list_my_support_tickets(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_tickets(current_user)
    rows = (
        db.query(SupportTicket)
        .filter(SupportTicket.user_id == uid)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [_ticket_to_client(r, include_admin_fields=False, include_priority=False) for r in rows]


@app.get("/api/admin/tickets")
async def admin_list_support_tickets(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    q = db.query(SupportTicket)
    if status_filter:
        sf = status_filter.strip().lower()
        if sf in TICKET_STATUSES:
            q = q.filter(SupportTicket.status == sf)
    rows = sorted(q.all(), key=_ticket_sort_priority_key)
    out = []
    for r in rows:
        u = db.query(User).filter(User.id == r.user_id).first()
        out.append(_ticket_to_client(r, include_admin_fields=True, include_priority=True, user=u))
    return out


@app.patch("/api/admin/tickets/{ticket_id}")
async def admin_update_support_ticket(
    ticket_id: str,
    body: SupportTicketAdminUpdateBody,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    row = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    previous_status = row.status
    patch = body.model_dump(exclude_unset=True)
    if "status" in patch and patch["status"] is not None:
        row.status = _normalize_ticket_status(str(patch["status"]))
    if "adminNotes" in patch:
        raw_notes = patch["adminNotes"]
        if raw_notes is None:
            row.admin_notes = None
        else:
            row.admin_notes = str(raw_notes).strip() or None
    if "priority" in patch and patch["priority"] is not None:
        row.priority = _normalize_ticket_priority(str(patch["priority"]))
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    u = db.query(User).filter(User.id == row.user_id).first()
    if (
        u
        and "status" in patch
        and patch["status"] is not None
        and previous_status != row.status
    ):
        email_alerts_service.send_transactional_if_enabled(
            db,
            event_key=email_alerts_service.EVENT_TICKET_STATUS,
            recipient_email=u.email,
            user_id=u.id,
            context={
                "username": u.username,
                "ticket_id": row.id,
                "ticket_id_short": row.id[:8],
                "ticket_subject": row.subject,
                "ticket_status": row.status,
                "previous_status": previous_status,
            },
        )
    return _ticket_to_client(row, include_admin_fields=True, include_priority=True, user=u)


@app.get("/api/admin/email-alerts/templates", response_model=List[EmailAlertTemplateOut])
async def admin_list_email_alert_templates(
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    rows = db.query(EmailAlertTemplate).order_by(EmailAlertTemplate.event_key.asc()).all()
    return rows


@app.patch("/api/admin/email-alerts/templates/{event_key}", response_model=EmailAlertTemplateOut)
async def admin_patch_email_alert_template(
    event_key: str,
    body: EmailAlertTemplatePatch,
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    if event_key not in email_alerts_service.DEFAULT_TEMPLATES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unknown event_key",
        )
    row = db.query(EmailAlertTemplate).filter(EmailAlertTemplate.event_key == event_key).first()
    if not row:
        email_alerts_service.ensure_template_exists(db, event_key)
        row = db.query(EmailAlertTemplate).filter(EmailAlertTemplate.event_key == event_key).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    patch = body.model_dump(exclude_unset=True)
    if "enabled" in patch and patch["enabled"] is not None:
        row.enabled = bool(patch["enabled"])
    if "subject_template" in patch and patch["subject_template"] is not None:
        row.subject_template = str(patch["subject_template"])
    if "html_template" in patch and patch["html_template"] is not None:
        row.html_template = str(patch["html_template"])
    db.commit()
    db.refresh(row)
    return row


@app.get("/api/admin/email-alerts/sent", response_model=List[SentTransactionalEmailOut])
async def admin_list_sent_transactional_emails(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(SentTransactionalEmail)
        .order_by(SentTransactionalEmail.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return rows


@app.get("/api/saved-templates")
async def list_saved_templates(
    user_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _target_user_id_for_saved_template_reads(current_user, user_id, db)
    rows = (
        db.query(SavedTemplate)
        .filter(SavedTemplate.user_id == uid)
        .order_by(SavedTemplate.created_at.desc())
        .all()
    )
    return [_saved_template_to_client(r) for r in rows]


@app.get("/api/saved-templates/storage-summary")
async def saved_templates_storage_summary(
    user_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _target_user_id_for_saved_template_reads(current_user, user_id, db)
    db_user = db.query(User).filter(User.id == uid).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    limits = _template_limits_for_account_tier(db_user.tier)
    return _saved_templates_storage_payload(uid, limits, db)


@app.get("/api/saved-templates/{template_id}")
async def get_saved_template(
    template_id: str,
    user_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _target_user_id_for_saved_template_reads(current_user, user_id, db)
    row = (
        db.query(SavedTemplate)
        .filter(SavedTemplate.user_id == uid, SavedTemplate.id == template_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return _saved_template_to_client(row)


@app.get("/api/saved-templates/{template_id}/export")
async def export_saved_template(
    template_id: str,
    user_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _target_user_id_for_saved_template_reads(current_user, user_id, db)
    row = (
        db.query(SavedTemplate)
        .filter(SavedTemplate.user_id == uid, SavedTemplate.id == template_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    meta = row.template_meta if isinstance(row.template_meta, dict) else {}
    mode = meta.get("themeCssMode")
    theme = mode if mode in ("light-only", "adaptive") else "adaptive"
    return {
        "id": row.id,
        "name": row.name,
        "html": row.html,
        "components": row.components or [],
        "themeCssMode": theme,
        "createdAt": row.created_at.isoformat() if row.created_at else "",
        "updatedAt": row.updated_at.isoformat() if row.updated_at else "",
    }


@app.put("/api/saved-templates")
async def upsert_saved_template(
    body: SavedTemplateUpsertBody,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _subscriber_user_id_for_saved_emails(current_user)
    theme_mode = body.themeCssMode if body.themeCssMode in ("light-only", "adaptive") else None
    meta = {"themeCssMode": theme_mode or "adaptive"}
    storage_size = _compute_saved_template_storage_bytes(
        template_id=body.id,
        name=body.name,
        components=body.components,
        html=body.html,
        theme_css_mode=theme_mode,
    )

    db_user = db.query(User).filter(User.id == uid).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    limits = _template_limits_for_account_tier(db_user.tier)

    existing = db.query(SavedTemplate).filter(SavedTemplate.id == body.id).first()
    if existing is not None:
        if int(existing.user_id) != uid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Template id belongs to another account",
            )
        rows = db.query(SavedTemplate).filter(SavedTemplate.user_id == uid).all()
        storage_used = sum((r.storage_size or 0) for r in rows) - (existing.storage_size or 0)
        if limits["max_storage_bytes"] > 0 and storage_used + storage_size > limits["max_storage_bytes"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough storage space")
        existing.name = body.name
        existing.html = body.html
        existing.components = body.components or []
        existing.template_meta = meta
        existing.storage_size = storage_size
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return _saved_template_to_client(existing)

    count = db.query(SavedTemplate).filter(SavedTemplate.user_id == uid).count()
    if limits["max_templates"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your plan does not allow saving templates",
        )
    if count >= limits["max_templates"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum of {limits['max_templates']} templates reached",
        )
    rows = db.query(SavedTemplate).filter(SavedTemplate.user_id == uid).all()
    storage_used = sum((r.storage_size or 0) for r in rows)
    if limits["max_storage_bytes"] > 0 and storage_used + storage_size > limits["max_storage_bytes"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough storage space")

    now = datetime.now(timezone.utc)
    row = SavedTemplate(
        id=body.id,
        user_id=uid,
        name=body.name,
        html=body.html,
        components=body.components or [],
        template_meta=meta,
        storage_size=storage_size,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _saved_template_to_client(row)


@app.delete("/api/saved-templates/{template_id}")
async def delete_saved_template(
    template_id: str,
    user_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uid = _target_user_id_for_saved_template_reads(current_user, user_id, db)
    q = db.query(SavedTemplate).filter(SavedTemplate.user_id == uid, SavedTemplate.id == template_id)
    deleted = q.delete(synchronize_session=False)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    db.commit()
    return {"ok": True}


# Root
@app.get("/")
async def root():
    return {
        "message": "Stripe Product & Transaction API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/api/health",
            "products": {
                "create": "POST /api/products",
                "get_all": "GET /api/products",
                "get_by_id": "GET /api/products/{product_id}",
                "update": "PUT /api/products/{product_id}",
                "delete": "DELETE /api/products/{product_id}"
            },
            "transactions": {
                "create": "POST /api/transactions",
                "get_all": "GET /api/transactions",
                "get_by_payment_id": "GET /api/transactions/payment/{payment_id}",
                "get_by_session_id": "GET /api/transactions/session/{session_id}",
                "get_by_email": "GET /api/transactions/email/{email}",
                "stats": "GET /api/transactions/stats"
            }
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)

