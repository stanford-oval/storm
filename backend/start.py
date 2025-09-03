#!/usr/bin/env python3
"""
Development startup script for STORM UI backend.

Provides easy way to start the backend server with proper configuration.
"""

import os
import sys
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Add parent directory to path for imports
backend_dir = Path(__file__).parent
storm_root = backend_dir.parent
sys.path.insert(0, str(storm_root))

# Load environment variables from .env file
load_dotenv(backend_dir / ".env")


def main():
    """Start the FastAPI server."""

    # Set environment variables if not already set
    if not os.getenv("PYTHONPATH"):
        os.environ["PYTHONPATH"] = str(storm_root)

    # Change to backend directory
    os.chdir(backend_dir)

    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    print(f"Starting STORM UI Backend...")
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"Reload: {reload}")
    print(f"Log Level: {log_level}")
    print(f"Working Directory: {os.getcwd()}")
    print(f"Python Path: {sys.path[:3]}...")
    print()

    # Start server
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level=log_level,
        access_log=True,
        reload_dirs=[str(backend_dir)] if reload else None,
    )


if __name__ == "__main__":
    main()
