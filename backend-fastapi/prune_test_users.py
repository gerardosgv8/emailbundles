#!/usr/bin/env python3
"""
Keep one admin (admins table) and one pro subscriber (users table).
Delete all other rows from admins and users.

Related rows cascade: saved_emails, saved_templates, support_tickets.
Transactions are not linked by user_id and are left unchanged.

Usage:
  python prune_test_users.py              # dry-run (preview only)
  python prune_test_users.py --execute    # apply deletes

Options:
  --keep-admin admin
  --keep-pro pro_user
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(Path(__file__).parent / ".env")
load_dotenv(Path(__file__).parent.parent / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL is not set in backend-fastapi/.env or project root .env")
    sys.exit(1)

if "[PASSWORD]" in DATABASE_URL or "[PROJECT-REF]" in DATABASE_URL or "YOUR_" in DATABASE_URL:
    print("DATABASE_URL still looks like a placeholder. Set your real Supabase URI first.")
    sys.exit(1)


def connect():
    kwargs = {"connect_args": {"sslmode": "require"}} if "supabase.co" in DATABASE_URL else {}
    engine = create_engine(DATABASE_URL, **kwargs)
    return engine.connect()


def fetch_all(conn, sql: str):
    return conn.execute(text(sql)).fetchall()


def main() -> None:
    parser = argparse.ArgumentParser(description="Keep one admin and one pro user; remove the rest.")
    parser.add_argument("--keep-admin", default="admin", help="Admin username to keep in admins table")
    parser.add_argument("--keep-pro", default="pro_user", help="Pro subscriber username to keep in users table")
    parser.add_argument("--execute", action="store_true", help="Apply deletes (default is dry-run)")
    args = parser.parse_args()

    with connect() as conn:
        admins = fetch_all(conn, "SELECT id, username, email FROM admins ORDER BY id")
        users = fetch_all(conn, "SELECT id, username, email, tier FROM users ORDER BY id")

        keep_admin = [a for a in admins if a.username == args.keep_admin]
        keep_pro = [u for u in users if u.username == args.keep_pro]

        if not keep_admin:
            print(f"No admin found with username '{args.keep_admin}' in admins table.")
            sys.exit(1)
        if not keep_pro:
            print(f"No user found with username '{args.keep_pro}' in users table.")
            sys.exit(1)
        if str(keep_pro[0].tier).lower() != "pro":
            print(f"Warning: '{args.keep_pro}' tier is '{keep_pro[0].tier}', not 'pro'.")

        admins_to_delete = [a for a in admins if a.username != args.keep_admin]
        users_to_delete = [u for u in users if u.username != args.keep_pro]

        print("=== KEEP ===")
        print(f"  admin: {keep_admin[0].username} ({keep_admin[0].email})")
        print(f"  pro:   {keep_pro[0].username} ({keep_pro[0].email}, tier={keep_pro[0].tier})")
        print()
        print(f"=== DELETE ({len(admins_to_delete)} admin(s), {len(users_to_delete)} user(s)) ===")
        for a in admins_to_delete:
            print(f"  admin: {a.username} ({a.email})")
        for u in users_to_delete:
            print(f"  user:  {u.username} ({u.email}, tier={u.tier})")

        if not args.execute:
            print()
            print("Dry-run only. Re-run with --execute to apply.")
            return

        trans = conn.begin()
        try:
            conn.execute(
                text("DELETE FROM admins WHERE username != :username"),
                {"username": args.keep_admin},
            )
            conn.execute(
                text("DELETE FROM users WHERE username != :username"),
                {"username": args.keep_pro},
            )
            trans.commit()
            print()
            print("Done. Only the kept admin and pro user remain.")
        except Exception:
            trans.rollback()
            raise


if __name__ == "__main__":
    main()
