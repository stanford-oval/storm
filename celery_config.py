from celery import Celery
import os
from functools import wraps
import requests
import time
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Celery
celery_app = Celery('storm_tasks')

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

def send_webhook_with_retry(webhook_url: str, payload: dict, max_retries: int = 3, delay: int = 5):
    """Send webhook with retry logic"""
    for attempt in range(max_retries):
        try:
            response = requests.post(webhook_url, json=payload)
            response.raise_for_status()
            return True
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(delay)
    return False 