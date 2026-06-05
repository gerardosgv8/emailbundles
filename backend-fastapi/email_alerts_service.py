"""
Transactional email alerts via Resend (https://resend.com).
Uses the official `resend` package when installed; falls back to Resend's REST API via urllib.
Templates and a send log live in Postgres (see EmailAlertTemplate / SentTransactionalEmail in main).
"""

from __future__ import annotations

import json
import os
import traceback
import urllib.error
import urllib.request
from typing import Any, Optional

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM_EMAIL = os.getenv(
    "RESEND_FROM_EMAIL",
    "EmailBundles <onboarding@resend.dev>",
).strip()
APP_PUBLIC_NAME = os.getenv("APP_PUBLIC_NAME", "EmailBundles").strip()

EVENT_WELCOME = "welcome_user"
EVENT_TICKET_CREATED = "ticket_created"
EVENT_TICKET_STATUS = "ticket_status_changed"
EVENT_PRO_UPGRADE = "tier_pro_upgraded"

DEFAULT_TEMPLATES: dict[str, dict[str, str]] = {
    EVENT_WELCOME: {
        "subject": "Welcome to {{app_name}}",
        "html": (
            "<p>Hi {{username}},</p>"
            "<p>Your account is ready. You can sign in with your username <strong>{{username}}</strong>.</p>"
            "<p>Thanks for joining {{app_name}}.</p>"
        ),
    },
    EVENT_TICKET_CREATED: {
        "subject": "We received your support ticket (#{{ticket_id_short}})",
        "html": (
            "<p>Hi {{username}},</p>"
            "<p>We received your ticket <strong>{{ticket_subject}}</strong> (reference {{ticket_id}}).</p>"
            "<p>Category: {{ticket_category}}. Current status: <strong>{{ticket_status}}</strong>.</p>"
            "<p>Our team will follow up by email.</p>"
        ),
    },
    EVENT_TICKET_STATUS: {
        "subject": "Ticket update: {{ticket_subject}}",
        "html": (
            "<p>Hi {{username}},</p>"
            "<p>Your support ticket <strong>{{ticket_subject}}</strong> ({{ticket_id}}) is now "
            "<strong>{{ticket_status}}</strong>.</p>"
            "<p>Previous status: {{previous_status}}.</p>"
        ),
    },
    EVENT_PRO_UPGRADE: {
        "subject": "You're on Pro at {{app_name}}",
        "html": (
            "<p>Hi {{username}},</p>"
            "<p>Your plan is now <strong>Pro</strong>. Thank you for upgrading.</p>"
            "<p>Enjoy the full {{app_name}} experience.</p>"
        ),
    },
}


def _subst(template: str, ctx: dict[str, Any]) -> str:
    out = template or ""
    for k, v in ctx.items():
        out = out.replace("{{" + k + "}}", "" if v is None else str(v))
    return out


def _send_resend_http(to_email: str, subject: str, html: str) -> tuple[Optional[str], Optional[str]]:
    """Returns (provider_message_id, error_message)."""
    if not RESEND_API_KEY:
        return None, "RESEND_API_KEY is not set"
    payload = json.dumps(
        {"from": RESEND_FROM_EMAIL, "to": [to_email], "subject": subject, "html": html}
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            mid = body.get("id")
            return (str(mid) if mid else None, None)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            err_body = str(e)
        return None, f"HTTP {e.code}: {err_body}"
    except Exception as e:
        return None, str(e)


def _send_resend_sdk(to_email: str, subject: str, html: str) -> tuple[Optional[str], Optional[str]]:
    import resend

    resend.api_key = RESEND_API_KEY
    try:
        r = resend.Emails.send(
            {
                "from": RESEND_FROM_EMAIL,
                "to": [to_email],
                "subject": subject,
                "html": html,
            }
        )
        if isinstance(r, dict) and r.get("id"):
            return str(r["id"]), None
        if isinstance(r, dict) and r.get("error"):
            return None, str(r.get("error"))
        return None, str(r)
    except Exception as e:
        return None, str(e)


def _dispatch_resend(to_email: str, subject: str, html: str) -> tuple[Optional[str], Optional[str]]:
    try:
        import resend  # noqa: F401

        return _send_resend_sdk(to_email, subject, html)
    except ImportError:
        return _send_resend_http(to_email, subject, html)


def _ensure_template_row(db: Any, event_key: str) -> None:
    import main as app_main

    EmailAlertTemplate = app_main.EmailAlertTemplate
    defaults = DEFAULT_TEMPLATES.get(event_key)
    if not defaults:
        return
    existing = db.query(EmailAlertTemplate).filter(EmailAlertTemplate.event_key == event_key).first()
    if existing:
        return
    db.add(
        EmailAlertTemplate(
            event_key=event_key,
            enabled=True,
            subject_template=defaults["subject"],
            html_template=defaults["html"],
        )
    )
    db.flush()


def send_transactional_if_enabled(
    db: Any,
    *,
    event_key: str,
    recipient_email: str,
    user_id: Optional[int],
    context: dict[str, Any],
) -> None:
    """
    Loads template from DB (seeds default if missing), sends via Resend if enabled.
    Always appends a SentTransactionalEmail row (success or error). Does not raise.
    """
    import main as app_main
    from datetime import datetime, timezone

    SentTransactionalEmail = app_main.SentTransactionalEmail
    EmailAlertTemplate = app_main.EmailAlertTemplate

    recipient_email = (recipient_email or "").strip()
    if not recipient_email or "@" not in recipient_email:
        return

    ctx = {**context, "app_name": APP_PUBLIC_NAME}
    provider_id: Optional[str] = None
    err: Optional[str] = None
    subject_out = ""
    html_out = ""

    try:
        _ensure_template_row(db, event_key)
        row = db.query(EmailAlertTemplate).filter(EmailAlertTemplate.event_key == event_key).first()
        if not row or not row.enabled:
            log = SentTransactionalEmail(
                event_key=event_key,
                user_id=user_id,
                recipient_email=recipient_email,
                subject="(skipped)",
                provider_message_id=None,
                error_message="disabled_or_missing_template",
                payload={"context": ctx},
                created_at=datetime.now(timezone.utc),
            )
            db.add(log)
            db.commit()
            return

        subject_out = _subst(row.subject_template, ctx)
        html_out = _subst(row.html_template, ctx)
        provider_id, err = _dispatch_resend(recipient_email, subject_out, html_out)
    except Exception as e:
        err = str(e)
        traceback.print_exc()

    try:
        log = SentTransactionalEmail(
            event_key=event_key,
            user_id=user_id,
            recipient_email=recipient_email,
            subject=(subject_out or event_key)[:500],
            provider_message_id=provider_id,
            error_message=err,
            payload={"context": ctx},
            created_at=datetime.now(timezone.utc),
        )
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()
        traceback.print_exc()


def seed_all_default_templates(db: Any) -> None:
    for key in DEFAULT_TEMPLATES:
        _ensure_template_row(db, key)
    db.commit()


def ensure_template_exists(db: Any, event_key: str) -> None:
    """Create default row for event_key if missing (commits immediately)."""
    _ensure_template_row(db, event_key)
    db.commit()
