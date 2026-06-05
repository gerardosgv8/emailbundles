#!/bin/bash
# Script to start all three servers

echo "🚀 Starting EmailBundles System..."
echo ""

# Start Frontend (Terminal 1)
echo "📱 Terminal 1: Starting Frontend..."
npm run dev &
FRONTEND_PID=$!

# Start Node Backend (Terminal 2)
sleep 2
echo "🔧 Terminal 2: Starting Node Backend..."
node backend-node/server.js &
NODE_PID=$!

# Start FastAPI Backend (Terminal 3)
sleep 2
echo "🐍 Terminal 3: Starting FastAPI Backend..."
cd backend-fastapi
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
uvicorn main:app --port 3002 &
FASTAPI_PID=$!
cd ..

echo ""
echo "✅ All servers starting..."
echo ""
echo "Frontend:  http://localhost:5173"
echo "Node API:  http://localhost:3001"
echo "FastAPI:   http://localhost:3002"
echo "Docs:      http://localhost:3002/docs"
echo ""
echo "Press CTRL+C to stop all servers"
echo ""

# Wait for interrupt
trap "kill $FRONTEND_PID $NODE_PID $FASTAPI_PID 2>/dev/null; exit" INT TERM
wait
