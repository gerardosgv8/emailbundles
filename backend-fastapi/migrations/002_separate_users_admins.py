"""
Migration script to separate users and admins into different tables
This script migrates existing users from the old single-table structure
to the new separate users and admins tables.

Run with: python migrations/002_separate_users_admins.py
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import from main
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Database setup
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./transactions.db")

# Check if using PostgreSQL (Supabase) or SQLite
if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"sslmode": "require"} if "supabase.co" in SQLALCHEMY_DATABASE_URL else {}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate_users_and_admins():
    """Migrate existing users to separate users and admins tables"""
    db = SessionLocal()
    
    try:
        # Check if admins table exists
        if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
            result = db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'admins'
                );
            """))
            admins_table_exists = result.scalar()
        else:
            # SQLite
            result = db.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='admins';
            """))
            admins_table_exists = result.fetchone() is not None
        
        if not admins_table_exists:
            print("Creating admins table...")
            if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
                db.execute(text("""
                    CREATE TABLE admins (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        hashed_password VARCHAR(255) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                db.execute(text("CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);"))
                db.execute(text("CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);"))
            else:
                db.execute(text("""
                    CREATE TABLE admins (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username VARCHAR(255) UNIQUE NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        hashed_password VARCHAR(255) NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                db.execute(text("CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);"))
                db.execute(text("CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);"))
            db.commit()
            print("✅ Admins table created")
        
        # Check if old users table has is_admin or user_type column
        if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
            result = db.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name IN ('is_admin', 'user_type');
            """))
            columns = [row[0] for row in result.fetchall()]
        else:
            result = db.execute(text("PRAGMA table_info(users);"))
            columns = [row[1] for row in result.fetchall()]
        
        has_admin_columns = 'is_admin' in columns or 'user_type' in columns
        
        if has_admin_columns:
            print("Migrating existing users to separate tables...")
            
            # Get all users from old table
            if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
                users = db.execute(text("""
                    SELECT id, username, email, hashed_password, 
                           COALESCE(is_admin, false) as is_admin,
                           COALESCE(user_type, 'subscriber') as user_type,
                           COALESCE(tier, 'standard') as tier,
                           created_at
                    FROM users;
                """)).fetchall()
            else:
                # SQLite - handle string booleans
                users = db.execute(text("""
                    SELECT id, username, email, hashed_password,
                           CASE 
                               WHEN is_admin = 'true' OR is_admin = 1 THEN 1
                               WHEN user_type = 'admin' THEN 1
                               ELSE 0
                           END as is_admin,
                           COALESCE(user_type, 'subscriber') as user_type,
                           COALESCE(tier, 'standard') as tier,
                           created_at
                    FROM users;
                """)).fetchall()
            
            admins_migrated = 0
            users_kept = 0
            
            for user in users:
                user_id, username, email, hashed_password, is_admin, user_type, tier, created_at = user
                
                # Convert is_admin to boolean
                if isinstance(is_admin, str):
                    is_admin = is_admin.lower() == 'true'
                is_admin = bool(is_admin)
                
                # Check if user is admin
                if is_admin or user_type == 'admin':
                    # Migrate to admins table
                    try:
                        if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
                            db.execute(text("""
                                INSERT INTO admins (id, username, email, hashed_password, created_at)
                                VALUES (:id, :username, :email, :hashed_password, :created_at)
                                ON CONFLICT (id) DO NOTHING;
                            """), {
                                'id': user_id,
                                'username': username,
                                'email': email,
                                'hashed_password': hashed_password,
                                'created_at': created_at
                            })
                        else:
                            db.execute(text("""
                                INSERT OR IGNORE INTO admins (id, username, email, hashed_password, created_at)
                                VALUES (:id, :username, :email, :hashed_password, :created_at);
                            """), {
                                'id': user_id,
                                'username': username,
                                'email': email,
                                'hashed_password': hashed_password,
                                'created_at': created_at
                            })
                        admins_migrated += 1
                        print(f"  ✅ Migrated admin: {username}")
                    except Exception as e:
                        print(f"  ⚠️  Error migrating admin {username}: {e}")
                else:
                    # Keep in users table but remove admin columns
                    users_kept += 1
                    print(f"  ✅ Kept user: {username} (tier: {tier})")
            
            # Remove is_admin and user_type columns from users table (after migration)
            print("\nRemoving is_admin and user_type columns from users table...")
            try:
                if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
                    # PostgreSQL - drop columns
                    db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS is_admin;"))
                    db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS user_type;"))
                else:
                    # SQLite - need to recreate table
                    print("  Note: SQLite doesn't support DROP COLUMN. You may need to recreate the table.")
                    print("  For now, the columns will remain but won't be used.")
                
                db.commit()
                print("✅ Migration completed!")
                print(f"  - Admins migrated: {admins_migrated}")
                print(f"  - Users kept: {users_kept}")
            except Exception as e:
                print(f"  ⚠️  Warning: Could not remove columns: {e}")
                print("  The migration completed, but old columns remain.")
                db.rollback()
        else:
            print("✅ Users table already uses new structure (no is_admin/user_type columns)")
            print("  No migration needed.")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Separate Users and Admins Tables")
    print("=" * 60)
    print()
    migrate_users_and_admins()
    print()
    print("=" * 60)
    print("Migration script completed")
    print("=" * 60)

