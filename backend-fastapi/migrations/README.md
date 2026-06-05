# PostgreSQL Migration Guide

This directory contains scripts to migrate your EmailBundles database from SQLite to PostgreSQL.

## Prerequisites

1. **PostgreSQL Database** - Set up on your hosting account
2. **Python Dependencies**:
   ```bash
   pip install psycopg2-binary python-dotenv
   ```
3. **Environment Variables** - Create `.env` file in `backend-fastapi/`:
   ```env
   POSTGRES_HOST=your-host.com
   POSTGRES_PORT=5432
   POSTGRES_DB=emailbundles
   POSTGRES_USER=your_username
   POSTGRES_PASSWORD=your_password
   SQLITE_DATABASE_PATH=transactions.db
   ```

## Migration Steps

### Step 1: Create PostgreSQL Schema

Run the schema creation script on your PostgreSQL database:

```bash
# Option 1: Using psql command line
psql -h your-host.com -U your_username -d emailbundles -f migrations/001_create_schema.sql

# Option 2: Using pgAdmin or other GUI tool
# Copy and paste the contents of 001_create_schema.sql into the SQL editor
```

This will create all tables, indexes, and triggers.

### Step 2: Export SQLite Data to PostgreSQL

Run the export script to migrate existing data:

```bash
cd backend-fastapi
python migrations/export_sqlite_to_postgres.py
```

This will:
- Export users table
- Export products table
- Export transactions table
- Skip duplicates (based on unique constraints)

### Step 3: Export LocalStorage Data (Optional)

If you have saved templates or components in localStorage:

1. **Export from Browser**:
   - Open browser Developer Console (F12)
   - Run the export commands (see `export_localstorage_data.py` for instructions)
   - Save JSON files to `migrations/localstorage_exports/`

2. **Import to PostgreSQL**:
   ```bash
   python migrations/import_localstorage_to_postgres.py
   ```

### Step 4: Update Application Configuration

Update `backend-fastapi/main.py` to use PostgreSQL:

```python
# Change from SQLite:
SQLALCHEMY_DATABASE_URL = "sqlite:///./transactions.db"

# To PostgreSQL:
SQLALCHEMY_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
```

Also update the engine creation:
```python
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # Remove SQLite-specific args:
    # connect_args={"check_same_thread": False}
)
```

### Step 5: Update Models for PostgreSQL

Update boolean fields in models (PostgreSQL uses native booleans):

```python
# Change from:
is_admin = Column(String, default="false")

# To:
is_admin = Column(Boolean, default=False)
```

## Verification

After migration, verify the data:

```sql
-- Check table counts
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'saved_templates', COUNT(*) FROM saved_templates
UNION ALL
SELECT 'component_library', COUNT(*) FROM component_library;

-- Check recent transactions
SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;

-- Check users
SELECT id, username, email, tier, is_admin FROM users LIMIT 10;
```

## Troubleshooting

### Connection Issues
- Verify PostgreSQL credentials in `.env`
- Check firewall rules allow connections
- Ensure PostgreSQL is running and accessible

### Data Type Issues
- SQLite stores booleans as strings ("true"/"false")
- PostgreSQL uses native BOOLEAN type
- The export script handles conversion automatically

### Duplicate Key Errors
- Export script skips existing records
- If you need to re-import, truncate tables first:
  ```sql
  TRUNCATE TABLE users, products, transactions CASCADE;
  ```

### JSONB Import Issues
- Ensure JSON is valid before importing
- Check JSON structure matches expected format
- Use `json.dumps()` for Python objects

## Rollback Plan

If you need to rollback:

1. Keep SQLite database as backup
2. Export PostgreSQL data back to SQLite if needed
3. Update `DATABASE_URL` back to SQLite connection string

## Production Checklist

- [ ] Backup SQLite database
- [ ] Create PostgreSQL database
- [ ] Run schema creation script
- [ ] Test connection
- [ ] Export SQLite data
- [ ] Verify data integrity
- [ ] Export localStorage data (if applicable)
- [ ] Update application configuration
- [ ] Test application with PostgreSQL
- [ ] Update environment variables in production
- [ ] Monitor for errors

## Files in This Directory

- `001_create_schema.sql` - PostgreSQL schema creation script
- `export_sqlite_to_postgres.py` - Export SQLite data to PostgreSQL
- `export_localstorage_data.py` - Helper script for localStorage export instructions
- `import_localstorage_to_postgres.py` - Import localStorage data to PostgreSQL
- `README.md` - This file

## Support

For issues or questions:
1. Check error messages carefully
2. Verify database connection settings
3. Ensure all prerequisites are installed
4. Review PostgreSQL logs for detailed errors

