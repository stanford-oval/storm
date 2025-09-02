# STORM UI Deployment Guide

This guide covers production deployment of the STORM UI system, including infrastructure requirements, configuration, security considerations, and operational best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Development Environment](#development-environment)
4. [Production Deployment](#production-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Database Setup](#database-setup)
8. [Security Configuration](#security-configuration)
9. [Environment Variables](#environment-variables)
10. [Monitoring and Logging](#monitoring-and-logging)
11. [Backup and Recovery](#backup-and-recovery)
12. [Performance Tuning](#performance-tuning)
13. [Troubleshooting](#troubleshooting)

## Architecture Overview

The STORM UI system consists of several components:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Frontend      │    │   Backend API   │
│   (Nginx/ALB)   │────│   (Next.js)     │────│   (FastAPI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN           │    │   Database      │    │   Task Queue    │
│   (CloudFlare)  │    │   (PostgreSQL)  │    │   (Celery+Redis)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │   File Storage  │
                       │   (S3/MinIO)    │
                       └─────────────────┘
```

## Infrastructure Requirements

### Minimum Requirements (Development)
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 10 Mbps

### Recommended Requirements (Production)
- **Frontend**: 2-4 cores, 8GB RAM, 50GB SSD
- **Backend**: 4-8 cores, 16GB RAM, 100GB SSD
- **Database**: 2-4 cores, 8GB RAM, 200GB SSD
- **Redis**: 2 cores, 4GB RAM, 20GB SSD

### Cloud Provider Recommendations

#### AWS
- **Frontend**: EC2 t3.large or ECS/Fargate
- **Backend**: EC2 c5.xlarge or ECS/Fargate
- **Database**: RDS PostgreSQL (db.r5.large)
- **Cache**: ElastiCache Redis (cache.r6g.large)
- **Storage**: S3 for file storage
- **Load Balancer**: Application Load Balancer

#### Google Cloud Platform
- **Frontend**: Compute Engine e2-standard-2 or Cloud Run
- **Backend**: Compute Engine c2-standard-4 or Cloud Run
- **Database**: Cloud SQL PostgreSQL (db-standard-2)
- **Cache**: Memorystore Redis (standard-2)
- **Storage**: Cloud Storage
- **Load Balancer**: Cloud Load Balancing

#### Azure
- **Frontend**: VM Standard_D2s_v3 or Container Instances
- **Backend**: VM Standard_D4s_v3 or Container Instances
- **Database**: Azure Database for PostgreSQL (General Purpose, 2 vCores)
- **Cache**: Azure Cache for Redis (Standard C1)
- **Storage**: Blob Storage
- **Load Balancer**: Application Gateway

## Development Environment

### Prerequisites
```bash
# Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python and pip
sudo apt-get update
sudo apt-get install python3.11 python3.11-venv python3-pip

# Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# PostgreSQL (development)
sudo apt-get install postgresql postgresql-contrib

# Redis (development)
sudo apt-get install redis-server
```

### Local Development Setup
```bash
# Clone the repository
git clone https://github.com/stanford-oval/storm.git
cd storm

# Setup backend environment
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup frontend environment
cd ../frontend/storm-ui
npm install

# Create environment files
cp .env.example .env.local
cp ../backend/.env.example ../backend/.env

# Start development services
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Run database migrations
cd ../backend
alembic upgrade head

# Start the services
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Task workers
cd backend
celery -A app.tasks.celery_app worker --loglevel=info

# Terminal 3: Frontend
cd frontend/storm-ui
npm run dev
```

## Production Deployment

### Option 1: Traditional Server Deployment

#### 1. Server Setup
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install required packages
sudo apt-get install -y nginx python3.11 python3.11-venv nodejs npm postgresql-client redis-tools

# Create application user
sudo useradd -m -s /bin/bash stormapp
sudo usermod -aG sudo stormapp
```

#### 2. Application Deployment
```bash
# Switch to application user
sudo su - stormapp

# Clone and setup application
git clone https://github.com/stanford-oval/storm.git /home/stormapp/storm
cd /home/stormapp/storm

# Backend setup
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn

# Frontend setup
cd ../frontend/storm-ui
npm ci --production
npm run build

# Create systemd services
sudo tee /etc/systemd/system/storm-api.service > /dev/null <<EOF
[Unit]
Description=STORM API Server
After=network.target

[Service]
User=stormapp
Group=stormapp
WorkingDirectory=/home/stormapp/storm/backend
Environment=PATH=/home/stormapp/storm/backend/venv/bin
EnvironmentFile=/home/stormapp/storm/backend/.env
ExecStart=/home/stormapp/storm/backend/venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/storm-worker.service > /dev/null <<EOF
[Unit]
Description=STORM Celery Worker
After=network.target

[Service]
User=stormapp
Group=stormapp
WorkingDirectory=/home/stormapp/storm/backend
Environment=PATH=/home/stormapp/storm/backend/venv/bin
EnvironmentFile=/home/stormapp/storm/backend/.env
ExecStart=/home/stormapp/storm/backend/venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/storm-frontend.service > /dev/null <<EOF
[Unit]
Description=STORM Frontend
After=network.target

[Service]
User=stormapp
Group=stormapp
WorkingDirectory=/home/stormapp/storm/frontend/storm-ui
EnvironmentFile=/home/stormapp/storm/frontend/storm-ui/.env.local
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
sudo systemctl enable storm-api storm-worker storm-frontend
sudo systemctl start storm-api storm-worker storm-frontend
```

#### 3. Nginx Configuration
```bash
sudo tee /etc/nginx/sites-available/storm > /dev/null <<EOF
upstream api_backend {
    server 127.0.0.1:8000;
}

upstream frontend_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # API routes
    location /api/ {
        proxy_pass http://api_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Frontend routes
    location / {
        proxy_pass http://frontend_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static file optimization
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

sudo ln -s /etc/nginx/sites-available/storm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Docker Deployment

### Production Docker Setup

#### 1. Dockerfile (Backend)
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash app \
    && chown -R app:app /app
USER app

EXPOSE 8000

CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

#### 2. Dockerfile (Frontend)
```dockerfile
# frontend/storm-ui/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### 3. Docker Compose (Production)
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  database:
    image: postgres:15
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    networks:
      - storm-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - storm-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@database:5432/${POSTGRES_DB}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    depends_on:
      - database
      - redis
    restart: unless-stopped
    networks:
      - storm-network
    volumes:
      - ./uploads:/app/uploads

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@database:5432/${POSTGRES_DB}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    depends_on:
      - database
      - redis
    restart: unless-stopped
    networks:
      - storm-network
    volumes:
      - ./uploads:/app/uploads

  frontend:
    build:
      context: ./frontend/storm-ui
      dockerfile: Dockerfile
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - storm-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - storm-network

volumes:
  postgres_data:
  redis_data:

networks:
  storm-network:
    driver: bridge
```

#### 4. Deployment Commands
```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Scale workers
docker-compose -f docker-compose.prod.yml up -d --scale worker=4
```

## Kubernetes Deployment

### 1. Namespace and ConfigMap
```yaml
# k8s/namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: storm

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: storm-config
  namespace: storm
data:
  DATABASE_HOST: "postgres"
  REDIS_HOST: "redis"
  ENVIRONMENT: "production"
```

### 2. Secrets
```yaml
# k8s/secrets.yml
apiVersion: v1
kind: Secret
metadata:
  name: storm-secrets
  namespace: storm
type: Opaque
data:
  # Base64 encoded values
  POSTGRES_PASSWORD: <base64-encoded-password>
  REDIS_PASSWORD: <base64-encoded-password>
  JWT_SECRET_KEY: <base64-encoded-secret>
  OPENAI_API_KEY: <base64-encoded-key>
```

### 3. Database Deployment
```yaml
# k8s/postgres.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: storm
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: storm
        - name: POSTGRES_USER
          value: storm
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: storm-secrets
              key: POSTGRES_PASSWORD
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: storm
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: storm
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

### 4. Backend Deployment
```yaml
# k8s/backend.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: storm-backend
  namespace: storm
spec:
  replicas: 3
  selector:
    matchLabels:
      app: storm-backend
  template:
    metadata:
      labels:
        app: storm-backend
    spec:
      containers:
      - name: backend
        image: your-registry/storm-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          value: "postgresql://storm:$(POSTGRES_PASSWORD)@postgres:5432/storm"
        - name: REDIS_URL
          value: "redis://:$(REDIS_PASSWORD)@redis:6379/0"
        envFrom:
        - configMapRef:
            name: storm-config
        - secretRef:
            name: storm-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: storm-backend
  namespace: storm
spec:
  selector:
    app: storm-backend
  ports:
  - port: 8000
    targetPort: 8000
```

### 5. Frontend Deployment
```yaml
# k8s/frontend.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: storm-frontend
  namespace: storm
spec:
  replicas: 2
  selector:
    matchLabels:
      app: storm-frontend
  template:
    metadata:
      labels:
        app: storm-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/storm-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.your-domain.com"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: storm-frontend
  namespace: storm
spec:
  selector:
    app: storm-frontend
  ports:
  - port: 3000
    targetPort: 3000
```

### 6. Ingress Configuration
```yaml
# k8s/ingress.yml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: storm-ingress
  namespace: storm
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: 50m
spec:
  tls:
  - hosts:
    - your-domain.com
    - api.your-domain.com
    secretName: storm-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: storm-frontend
            port:
              number: 3000
  - host: api.your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: storm-backend
            port:
              number: 8000
```

### 7. Deployment Commands
```bash
# Apply all configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get all -n storm

# View logs
kubectl logs -f deployment/storm-backend -n storm

# Scale deployments
kubectl scale deployment storm-backend --replicas=5 -n storm
```

## Database Setup

### PostgreSQL Configuration
```sql
-- init.sql
CREATE DATABASE storm;
CREATE USER storm WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE storm TO storm;

-- Enable required extensions
\c storm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
```

### Database Migration
```bash
# Backend directory
cd backend

# Install Alembic (if not already installed)
pip install alembic

# Initialize migrations (first time only)
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial schema"

# Apply migrations
alembic upgrade head

# Downgrade if needed
alembic downgrade -1
```

### Database Backup
```bash
#!/bin/bash
# backup.sh
DB_NAME="storm"
DB_USER="storm"
DB_HOST="localhost"
BACKUP_DIR="/var/backups/storm"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/storm_backup_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "storm_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: storm_backup_$DATE.sql.gz"
```

## Security Configuration

### SSL/TLS Setup
```bash
# Generate SSL certificate (Let's Encrypt)
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# Auto-renewal cron job
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### Firewall Configuration
```bash
# UFW firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Security Headers
```nginx
# Add to nginx configuration
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss: https:; media-src 'self'; object-src 'none'; child-src 'none'; worker-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self';" always;
add_header Strict-Transport-Security "max-age=63072000" always;
```

## Environment Variables

### Backend Configuration
```bash
# .env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/storm
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=storm
POSTGRES_USER=storm
POSTGRES_PASSWORD=secure_password

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Security
JWT_SECRET_KEY=your-super-secure-jwt-secret
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
BING_SEARCH_API_KEY=your-bing-key
GOOGLE_SEARCH_API_KEY=your-google-key
TAVILY_API_KEY=your-tavily-key

# Storage
FILE_STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET_NAME=storm-uploads
AWS_REGION=us-east-1

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=INFO

# Performance
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
WORKER_CONCURRENCY=4
MAX_CONNECTIONS_PER_API=10
REQUEST_TIMEOUT=300
```

### Frontend Configuration
```bash
# .env.local
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com/ws
NEXT_PUBLIC_APP_NAME="STORM UI"
NEXT_PUBLIC_SENTRY_DSN=your-frontend-sentry-dsn
NEXT_TELEMETRY_DISABLED=1

# Development only
NEXT_PUBLIC_DEBUG=false
```

## Monitoring and Logging

### Health Check Endpoints
```python
# backend/app/api/health.py
from fastapi import APIRouter
from sqlalchemy import text
from app.database import get_db
from app.cache import redis_client

router = APIRouter()

@router.get("/health")
async def health_check():
    """Basic health check"""
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@router.get("/ready")
async def readiness_check():
    """Detailed readiness check"""
    checks = {
        "database": False,
        "redis": False,
        "storage": False
    }
    
    # Database check
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass
    
    # Redis check
    try:
        redis_client.ping()
        checks["redis"] = True
    except Exception:
        pass
    
    # Storage check (implement based on your storage solution)
    checks["storage"] = True  # Implement actual check
    
    all_healthy = all(checks.values())
    status_code = 200 if all_healthy else 503
    
    return Response(
        content=json.dumps({
            "status": "ready" if all_healthy else "not ready",
            "checks": checks,
            "timestamp": datetime.utcnow().isoformat()
        }),
        status_code=status_code,
        media_type="application/json"
    )
```

### Logging Configuration
```python
# backend/app/core/logging.py
import logging
import sys
from logging.handlers import RotatingFileHandler
from app.core.config import settings

def setup_logging():
    """Configure application logging"""
    
    # Create logger
    logger = logging.getLogger("storm")
    logger.setLevel(settings.LOG_LEVEL)
    
    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (production)
    if settings.ENVIRONMENT == "production":
        file_handler = RotatingFileHandler(
            "/var/log/storm/app.log",
            maxBytes=10485760,  # 10MB
            backupCount=5
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger
```

### Prometheus Metrics
```python
# backend/app/monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Define metrics
REQUEST_COUNT = Counter(
    'storm_requests_total',
    'Total requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'storm_request_duration_seconds',
    'Request duration',
    ['method', 'endpoint']
)

PIPELINE_DURATION = Histogram(
    'storm_pipeline_duration_seconds',
    'Pipeline execution duration',
    ['stage']
)

ACTIVE_PIPELINES = Gauge(
    'storm_active_pipelines',
    'Number of active pipelines'
)

def start_metrics_server(port: int = 8001):
    """Start Prometheus metrics server"""
    start_http_server(port)
```

### Monitoring with Grafana
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning

volumes:
  grafana_data:
```

## Backup and Recovery

### Automated Backup Script
```bash
#!/bin/bash
# backup-system.sh

set -e

BACKUP_DIR="/var/backups/storm"
S3_BUCKET="storm-backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
echo "Backing up database..."
pg_dump -h localhost -U storm -d storm | gzip > $BACKUP_DIR/database_$DATE.sql.gz

# Redis backup
echo "Backing up Redis..."
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb

# File storage backup (if using local storage)
echo "Backing up uploads..."
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /app/uploads/

# Upload to S3
echo "Uploading to S3..."
aws s3 cp $BACKUP_DIR/ s3://$S3_BUCKET/backups/$DATE/ --recursive

# Cleanup old local backups (keep 3 days)
find $BACKUP_DIR -name "*" -mtime +3 -delete

echo "Backup completed successfully"
```

### Recovery Procedure
```bash
#!/bin/bash
# recovery.sh

BACKUP_DATE=$1
S3_BUCKET="storm-backups"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Example: $0 20231201_120000"
    exit 1
fi

echo "Starting recovery process for backup: $BACKUP_DATE"

# Download backup from S3
aws s3 cp s3://$S3_BUCKET/backups/$BACKUP_DATE/ ./recovery/ --recursive

# Stop services
systemctl stop storm-api storm-worker storm-frontend

# Restore database
echo "Restoring database..."
dropdb -h localhost -U postgres storm
createdb -h localhost -U postgres storm -O storm
gunzip -c ./recovery/database_$BACKUP_DATE.sql.gz | psql -h localhost -U storm -d storm

# Restore Redis
echo "Restoring Redis..."
systemctl stop redis
cp ./recovery/redis_$BACKUP_DATE.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
systemctl start redis

# Restore uploads
echo "Restoring uploads..."
rm -rf /app/uploads/*
tar -xzf ./recovery/uploads_$BACKUP_DATE.tar.gz -C /

# Start services
systemctl start storm-api storm-worker storm-frontend

echo "Recovery completed successfully"
```

## Performance Tuning

### Database Optimization
```sql
-- PostgreSQL configuration optimizations
-- postgresql.conf

# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Connections
max_connections = 200
superuser_reserved_connections = 3

# Write Ahead Logging
wal_buffers = 16MB
checkpoint_segments = 32
checkpoint_completion_target = 0.7
wal_writer_delay = 200ms

# Query Planner
random_page_cost = 1.1
effective_io_concurrency = 2

# Indexes for common queries
CREATE INDEX CONCURRENTLY idx_projects_user_status ON projects(user_id, status);
CREATE INDEX CONCURRENTLY idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX CONCURRENTLY idx_pipeline_logs_project_stage ON pipeline_logs(project_id, stage, timestamp);
```

### Redis Configuration
```conf
# redis.conf

# Memory optimization
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Network
tcp-keepalive 300
timeout 0
tcp-backlog 511

# Performance
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
```

### Application Performance
```python
# backend/app/core/performance.py

# Connection pooling
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=300
)

# Async optimization
import asyncio
from asyncio import Semaphore

# Rate limiting for API calls
api_semaphore = Semaphore(10)

async def rate_limited_api_call(func, *args, **kwargs):
    async with api_semaphore:
        return await func(*args, **kwargs)

# Caching
from functools import lru_cache
import redis.asyncio as redis

redis_client = redis.from_url(REDIS_URL)

@lru_cache(maxsize=128)
def get_config_template(template_id: str):
    # Cache configuration templates
    pass

# Background task optimization
from celery import Celery

celery_app = Celery(
    "storm",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_routes={
        'app.tasks.research.*': {'queue': 'research'},
        'app.tasks.generation.*': {'queue': 'generation'},
        'app.tasks.export.*': {'queue': 'export'}
    },
    worker_concurrency=4,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000
)
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Database Connection Issues
```bash
# Check database status
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Reset connections if needed
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'storm';"
```

#### 2. Redis Connection Issues
```bash
# Check Redis status
sudo systemctl status redis
redis-cli ping

# Check memory usage
redis-cli info memory

# Clear cache if needed
redis-cli flushdb
```

#### 3. High Memory Usage
```bash
# Check system memory
free -h
sudo ps aux --sort=-%mem | head

# Check application memory
sudo systemctl status storm-api
journalctl -u storm-api -f

# Restart services if needed
sudo systemctl restart storm-api storm-worker
```

#### 4. Slow API Responses
```bash
# Check API logs
journalctl -u storm-api -f | grep "slow"

# Check database performance
sudo -u postgres psql -d storm -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check Redis performance
redis-cli --latency-history -i 1
```

#### 5. Pipeline Failures
```bash
# Check worker logs
journalctl -u storm-worker -f

# Check Celery queue
celery -A app.tasks.celery_app inspect active
celery -A app.tasks.celery_app inspect reserved

# Purge failed tasks
celery -A app.tasks.celery_app purge
```

### Log Analysis
```bash
# Analyze error patterns
grep -E "(ERROR|CRITICAL)" /var/log/storm/app.log | tail -50

# Monitor real-time logs
tail -f /var/log/storm/app.log | grep -E "(ERROR|WARNING)"

# Analyze access patterns
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -20
```

### Performance Monitoring
```bash
# System monitoring
htop
iotop
nethogs

# Database monitoring
sudo -u postgres psql -d storm -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Application monitoring
curl -s http://localhost:8001/metrics | grep storm_
```

---

This deployment guide provides comprehensive instructions for deploying STORM UI in production environments. Always test deployments in staging environments before applying to production, and ensure regular backups and monitoring are in place.

For additional support or questions, refer to the project documentation or contact the development team.

*Last updated: September 2025*
*Version: 1.0*