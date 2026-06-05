"""
Migration script to migrate the default admin user from users table to admins table
This script migrates the user with username "admin" to the admins table.

Run with: python migrations/003_migrate_default_admin.py
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

def migrate_default_admin():
    """Migrate the default admin user from users table to admins table"""
    db = SessionLocal()
    
    try:
        admin_username = "admin"
        
        print(f"Looking for admin user with username: {admin_username}")
        
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
            result = db.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='admins';
            """))
            admins_table_exists = result.fetchone() is not None
        
        if not admins_table_exists:
            print("❌ Admins table does not exist. Please run migration 002_separate_users_admins.py first.")
            return
        
        # Check if admin already exists in admins table
        if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
            result = db.execute(text("SELECT id, username, email FROM admins WHERE username = :username"), 
                             {"username": admin_username})
        else:
            result = db.execute(text("SELECT id, username, email FROM admins WHERE username = :username"), 
                             {"username": admin_username})
        existing_admin = result.fetchone()
        
        if existing_admin:
            print(f"✅ Admin user '{admin_username}' already exists in admins table (ID: {existing_admin[0]})")
            print(f"   Email: {existing_admin[2]}")
            return
        
        # Find the admin user in users table
        print(f"Searching for user '{admin_username}' in users table...")
        if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
            result = db.execute(text("""
                SELECT id, username, email, hashed_password, created_at
                FROM users
                WHERE username = :username
            """), {"username": admin_username})
        else:
            result = db.execute(text("""
                SELECT id, username, email, hashed_password, created_at
                FROM users
                WHERE username = :username
            """), {"username": admin_username})
        
        user = result.fetchone()
        
        if not user:
            print(f"❌ User '{admin_username}' not found in users table.")
            print("   Please check the username or create the admin user first.")
            return
        
        user_id, username, email, hashed_password, created_at = user
        print(f"✅ Found user in users table:")
        print(f"   ID: {user_id}")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Created at: {created_at}")
        
        # Migrate to admins table
        print(f"\nMigrating to admins table...")
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
            
            db.commit()
            print(f"✅ Successfully migrated admin user to admins table")
            
            # Optionally remove from users table (commented out for safety)
            # Uncomment the following lines if you want to remove the user from users table
            # print(f"\nRemoving user from users table...")
            # if SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
            #     db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            # else:
            #     db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
            # db.commit()
            # print(f"✅ Removed user from users table")
            
        except Exception as e:
            print(f"❌ Error migrating admin user: {e}")
            db.rollback()
            raise
        
        print(f"\n✅ Migration completed successfully!")
        print(f"   Admin user '{username}' is now in the admins table")
        print(f"   You can now log in with username: {username}")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Migration: Migrate Default Admin User")
    print("=" * 60)
    print()
    migrate_default_admin()
    print()
    print("=" * 60)
    print("Migration script completed")
    print("=" * 60)

