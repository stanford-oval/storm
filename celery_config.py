from celery import Celery
import os
from functools import wraps
import requests
import time
from dotenv import load_dotenv
import hmac
import hashlib
import json

# Load environment variables from .env file
load_dotenv()

# Initialize Celery and get webhook secret
celery_app = Celery('storm_tasks')
WEBHOOK_SECRET_KEY = os.getenv('WEBHOOK_SECRET_KEY')
if not WEBHOOK_SECRET_KEY:
    raise ValueError("WEBHOOK_SECRET_KEY must be set in environment variables")

# Configure Celery
celery_app.conf.update(
    broker_url=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    result_backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    enable_utc=True,
    worker_pool_restarts=True,
)

def generate_webhook_signature(payload: dict, secret_key: str) -> str:
    """Generate HMAC SHA256 signature for webhook payload"""
    # Convert payload to JSON string without sorting keys to match raw body
    message = json.dumps(payload).encode('utf-8')
    signature = hmac.new(
        secret_key.encode('utf-8'),
        message,
        hashlib.sha256
    ).hexdigest()
    return signature

def send_webhook_with_retry(webhook_url: str, payload: dict, max_retries: int = 3, delay: int = 5):
    """Send webhook with retry logic and signature"""
    headers = {}
    # Use the global WEBHOOK_SECRET_KEY we defined
    if WEBHOOK_SECRET_KEY:
        signature = generate_webhook_signature(payload, WEBHOOK_SECRET_KEY)
        headers['X-Webhook-Signature'] = signature

    for attempt in range(max_retries):
        try:
            response = requests.post(webhook_url, json=payload, headers=headers)
            response.raise_for_status()
            return True
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(delay)
    return False 