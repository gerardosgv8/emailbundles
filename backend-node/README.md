# Node.js Stripe Backend

This is a lightweight Node.js Express server dedicated to handling Stripe payment processing for the EmailBundles application.

## Purpose

- Handle Stripe Checkout session creation
- Process Stripe webhook events
- Forward transaction data to FastAPI backend for storage
- Isolated from main application logic for security

## Setup

1. Install dependencies:
```bash
cd backend-node
npm install
```

2. Configure environment variables:
Create a `.env` file in this directory with:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FASTAPI_URL=http://localhost:3002
```

## Running

### Development:
```bash
npm run dev
```

### Production:
```bash
npm start
```

The server will start on **port 3001**.

## Endpoints

### POST `/api/create-checkout-session`
Creates a Stripe Checkout session for product purchase.

**Request:**
```json
{
  "productName": "The Ecommerce Mail Kit",
  "price": 97,
  "customerEmail": "user@example.com",
  "customerName": "John Doe"
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### POST `/webhook`
Receives Stripe webhook events (checkout completed, payment succeeded, etc.)

**Headers Required:**
- `stripe-signature`

**Events Handled:**
- `checkout.session.completed` - Payment successful
- `payment_intent.succeeded` - Payment processed
- More events as needed

## Integration with FastAPI

When a payment is successful, this server forwards transaction data to the FastAPI backend:

```
POST http://localhost:3002/api/transactions
```

This allows the main backend to:
- Store transaction records
- Update user tier (if subscription)
- Send confirmation emails
- Track analytics

## Port

**Default:** 3001

Configure in `server.js`:
```javascript
const PORT = process.env.PORT || 3001;
```

## Security

- All Stripe webhook events are verified using signature verification
- CORS configured for frontend (localhost:5173)
- Environment variables required for Stripe keys
- No sensitive data stored locally

## Logs

Transaction processing logs are written to console:
- ✅ Successful transactions
- ❌ Failed transactions
- 📧 Database save confirmations

## Related

- **Main Backend (FastAPI):** `backend-fastapi/`
- **Frontend:** `src/`
- **Startup Script:** `start-all.sh` (starts all servers)

## Testing Connectivity

### Run Connectivity Tests

To verify Stripe API and backend connectivity:

```bash
node test-stripe-connection.js
```

This tests:
- Stripe API authentication
- Account access
- Product/price retrieval
- Checkout session creation
- FastAPI backend connection
- Full integration (Stripe → Backend → Database)

**Test Results:** See `CONNECTIVITY_TEST_RESULTS.md` for latest test run

### Manual Testing

**Test Checkout Session Creation:**
```bash
curl -X POST http://localhost:3001/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Pro Subscription",
    "price": 130,
    "customerEmail": "test@example.com",
    "customerName": "Test User"
  }'
```

## Notes

- This server runs independently from FastAPI
- Uses ES modules (`type: "module"`)
- Requires Node.js 18+ for native `fetch` support
- All connectivity tests passed (see CONNECTIVITY_TEST_RESULTS.md)
