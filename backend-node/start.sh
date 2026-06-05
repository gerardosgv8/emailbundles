#!/bin/bash
# Start Node.js Stripe Backend

echo "🔧 Starting Node.js Stripe Backend..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Create a .env file with:"
    echo "   STRIPE_SECRET_KEY=sk_test_..."
    echo "   STRIPE_WEBHOOK_SECRET=whsec_..."
    echo "   FASTAPI_URL=http://localhost:3002"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start server
echo "✅ Starting server on port 3001..."
node server.js
