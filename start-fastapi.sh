#!/bin/bash
# Quick FastAPI startup script

# Navigate to backend-fastapi directory
cd "$(dirname "$0")/backend-fastapi"

# Activate virtual environment and start server
source venv/bin/activate && uvicorn main:app --reload --port 3002

