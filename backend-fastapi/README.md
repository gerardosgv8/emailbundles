# FastAPI Transaction Backend

A comprehensive FastAPI backend for recording successful Stripe transactions in a SQLite database.

## Features

- ✅ **SQLite Database** - Simple, file-based storage
- ✅ **SQLAlchemy ORM** - Modern database management
- ✅ **RESTful API** - Clean, standard endpoints
- ✅ **Automatic Schema** - Creates tables on first run
- ✅ **Transaction Tracking** - Complete payment history
- ✅ **Statistics** - Revenue and transaction analytics
- ✅ **CORS Enabled** - Works with frontend apps
- ✅ **Auto-documented** - FastAPI OpenAPI docs

## Installation

```bash
# Navigate to backend-fastapi directory
cd backend-fastapi

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Running the Server

```bash
# Development mode with auto-reload
uvicorn main:app --reload --port 3002

# Production mode
uvicorn main:app --host 0.0.0.0 --port 3002
```

The server will start on: `http://localhost:3002`

## API Documentation

### Interactive Docs
- **Swagger UI:** http://localhost:3002/docs
- **ReDoc:** http://localhost:3002/redoc

### Endpoints

#### Health Check
```bash
GET /api/health
```

#### Create Transaction
```bash
POST /api/transactions
Content-Type: application/json

{
  "payment_id": "pi_xxx",
  "session_id": "cs_xxx",
  "email": "customer@example.com",
  "name": "John Doe",
  "amount": 79.00,
  "status": "paid",
  "product": "Email Template Bundle"
}
```

#### Get All Transactions
```bash
GET /api/transactions?skip=0&limit=100
```

#### Get Transaction by Payment ID
```bash
GET /api/transactions/payment/{payment_id}
```

#### Get Transaction by Session ID
```bash
GET /api/transactions/session/{session_id}
```

#### Get Transactions by Email
```bash
GET /api/transactions/email/{email}
```

#### Get Statistics
```bash
GET /api/transactions/stats

Response:
{
  "total_transactions": 50,
  "total_revenue": 3950.00,
  "average_transaction": 79.00
}
```

## Database Schema

```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY,
    payment_id TEXT UNIQUE,
    session_id TEXT,
    email TEXT,
    name TEXT,
    amount REAL,
    status TEXT,
    product TEXT,
    created_at TIMESTAMP
);
```

## Integration with Node.js Backend

The Node.js backend automatically saves transactions to this FastAPI backend:

1. Customer completes payment on Stripe
2. Stripe webhook triggers Node.js backend
3. Node.js backend saves to Airtable
4. Node.js backend saves to FastAPI database
5. Transaction is recorded in SQLite

## Configuration

Create a `.env` file in the `backend-fastapi` directory:

```env
DATABASE_URL=sqlite:///./transactions.db
```

Or use the default SQLite database.

## Querying Transactions

### Example: Get all transactions for a customer
```bash
curl http://localhost:3002/api/transactions/email/customer@example.com
```

### Example: Get revenue stats
```bash
curl http://localhost:3002/api/transactions/stats
```

### Example: Create a transaction
```bash
curl -X POST http://localhost:3002/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "payment_id": "pi_test123",
    "session_id": "cs_test123",
    "email": "test@example.com",
    "name": "Test User",
    "amount": 79.00,
    "status": "paid",
    "product": "Email Template Bundle"
  }'
```

## Development

### Project Structure
```
backend-fastapi/
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── transactions.db      # SQLite database (created automatically)
├── README.md           # This file
└── .env                # Environment variables (optional)
```

### Adding New Features

1. Update the `Transaction` model in `main.py`
2. Run migration (or delete `transactions.db` to recreate)
3. Add new endpoints as needed

### Database Migrations

Since we're using SQLite, you can:
- Delete `transactions.db` to recreate the schema
- Use Alembic for proper migrations (recommended for production)
- Manually update the schema if needed

## Production Deployment

For production, consider:

1. **Use PostgreSQL** instead of SQLite
2. **Add authentication** to API endpoints
3. **Set up proper migrations** with Alembic
4. **Add rate limiting** to prevent abuse
5. **Use environment variables** for all config
6. **Add logging** and monitoring
7. **Use HTTPS** with SSL certificates

### Example Production Setup

```python
# In main.py
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://user:pass@localhost/dbname"
)
```

## Testing

Test with the interactive docs at:
- http://localhost:3002/docs

Or use curl commands (see examples above).

## Troubleshooting

**Database locked error:**
- Make sure only one instance is running
- Close database connections properly

**Module not found:**
- Activate virtual environment
- Install requirements: `pip install -r requirements.txt`

**Port already in use:**
- Change port in uvicorn command
- Kill existing process: `lsof -ti:3002 | xargs kill`

## Next Steps

- Add authentication/authorization
- Implement pagination for large datasets
- Add filtering and search capabilities
- Create admin dashboard
- Export data to CSV/Excel
- Set up email notifications
- Add audit logging

