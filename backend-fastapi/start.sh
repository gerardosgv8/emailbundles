#!/bin/bash

# FastAPI Backend Startup Script

echo "🚀 Starting FastAPI Transaction Backend..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.installed" ]; then
    echo "📥 Installing dependencies..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# Start the server
echo "✅ Starting FastAPI server on port 3002..."
uvicorn main:app --reload --port 3002

