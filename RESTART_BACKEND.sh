#!/bin/bash

# Script to restart the FastAPI backend with proper CORS settings

echo "🛑 Stopping existing backend..."
lsof -ti:3002 | xargs kill 2>/dev/null || echo "No existing process found"

sleep 2

echo "🚀 Starting FastAPI backend..."
cd backend-fastapi

if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

echo "🔌 Activating virtual environment..."
source venv/bin/activate

echo "✅ Starting server on port 3002..."
echo "   Access at: http://localhost:3002"
echo "   API Docs: http://localhost:3002/docs"
echo "   Health: http://localhost:3002/api/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

uvicorn main:app --reload --port 3002

