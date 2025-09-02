# STORM UI Deployment Guide

This document provides comprehensive guidance for deploying the STORM UI application using Docker and various deployment strategies.

## 📋 Overview

The STORM UI deployment configuration includes:

- **Multi-stage Docker builds** for optimized container images
- **Docker Compose** orchestration for local and staging deployments
- **Kubernetes** manifests for production-scale deployments
- **GitHub Actions CI/CD** pipelines for automated testing and deployment
- **Nginx** reverse proxy configuration for production
- **Health monitoring** and automated deployment scripts
- **Security best practices** and performance optimizations

## 🚀 Quick Start

### Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Node.js 18+ (for local frontend development)
- Python 3.11+ (for local backend development)
- Git

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/stanford-oval/storm.git
   cd storm
   ```

2. **Copy environment template:**
   ```bash
   cp .env.production.template .env.local
   # Edit .env.local with your configuration
   ```

3. **Start development environment:**
   ```bash
   # Start all services
   docker-compose up -d
   
   # Or start specific services
   docker-compose up -d postgres redis backend
   ```

4. **View logs:**
   ```bash
   docker-compose logs -f backend frontend
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Production Deployment

1. **Prepare environment:**
   ```bash
   cp .env.production.template .env.production
   # Edit .env.production with production values
   ```

2. **Deploy using script:**
   ```bash
   ./deploy/scripts/deploy.sh production v1.0.0
   ```

3. **Monitor health:**
   ```bash
   ./deploy/scripts/health-check.sh --continuous --interval 60
   ```

## 📦 Container Architecture

### Frontend (Next.js)
- **Base Image:** node:18-alpine
- **Build Stages:** deps → builder → development/production/test
- **Features:** Multi-stage optimization, security hardening, health checks
- **Size:** ~200MB (production)

### Backend (FastAPI)
- **Base Image:** python:3.11-slim
- **Build Stages:** builder → production/development/test/worker
- **Features:** Virtual environment, non-root user, comprehensive monitoring
- **Size:** ~300MB (production)

### Services
- **PostgreSQL 15:** Primary database with persistence
- **Redis 7:** Caching and task queue
- **Qdrant:** Vector database for embeddings (optional)
- **Nginx:** Reverse proxy and load balancer
- **Celery:** Background task processing

## 🔧 Configuration Files

### Docker Files
```
├── docker-compose.yml              # Main orchestration
├── frontend/storm-ui/Dockerfile    # Frontend multi-stage build
├── frontend/storm-ui/.dockerignore  # Frontend ignore patterns
└── backend/Dockerfile.prod         # Backend production build
```

### Environment Configuration
```
├── .env.production.template        # Production environment template
├── .env.staging                    # Staging environment (create manually)
└── .env.local                      # Local development (create manually)
```

### Deployment Scripts
```
├── deploy/
│   ├── nginx.conf                  # Nginx production configuration
│   ├── systemd/storm-ui.service    # Systemd service definition
│   ├── scripts/
│   │   ├── deploy.sh              # Main deployment script
│   │   └── health-check.sh        # Health monitoring script
│   └── kubernetes/
│       └── deployment.yaml        # Kubernetes manifests
```

### CI/CD Pipelines
```
├── .github/workflows/
│   ├── ci.yml                     # Continuous integration
│   └── deploy.yml                 # Automated deployment
```

## 🐳 Docker Compose Services

### Core Services

| Service | Port | Description | Health Check |
|---------|------|-------------|--------------|
| `postgres` | 5432 | PostgreSQL database | `pg_isready` |
| `redis` | 6379 | Redis cache/queue | `redis-cli ping` |
| `backend` | 8000 | FastAPI application | `GET /health` |
| `frontend` | 3000 | Next.js application | `GET /api/health` |
| `worker` | - | Celery background tasks | `celery inspect ping` |
| `nginx` | 80/443 | Reverse proxy | `GET /health` |

### Optional Services

| Service | Port | Description | Profile |
|---------|------|-------------|---------|
| `qdrant` | 6333 | Vector database | default |
| `flower` | 5555 | Celery monitoring | development |

### Service Dependencies

```mermaid
graph TD
    A[Nginx] --> B[Frontend]
    A --> C[Backend]
    C --> D[PostgreSQL]
    C --> E[Redis]
    C --> F[Qdrant]
    G[Worker] --> E
    G --> D
    H[Flower] --> E
```

## 🌐 Deployment Strategies

### 1. Docker Compose (Recommended for staging)

**Pros:**
- Simple setup and management
- Perfect for single-server deployments
- Easy to debug and modify
- Built-in service discovery

**Cons:**
- Limited scalability
- Single point of failure
- No built-in load balancing

**Usage:**
```bash
# Production deployment
docker-compose --profile production up -d

# Staging deployment
docker-compose up -d

# Development with Flower monitoring
docker-compose --profile development up -d
```

### 2. Kubernetes (Recommended for production)

**Pros:**
- Horizontal scaling and high availability
- Built-in service discovery and load balancing
- Rolling updates and rollbacks
- Resource management and monitoring

**Cons:**
- Complex setup and management
- Requires Kubernetes knowledge
- Higher resource overhead

**Usage:**
```bash
# Apply all manifests
kubectl apply -f deploy/kubernetes/deployment.yaml

# Monitor deployment
kubectl rollout status deployment/storm-backend -n storm
kubectl get pods -n storm

# Scale services
kubectl scale deployment storm-backend --replicas=5 -n storm
```

### 3. Systemd Service (Traditional server deployment)

**Pros:**
- Direct server deployment
- System integration
- Service management with systemctl

**Cons:**
- Manual setup required
- Limited scalability
- More complex maintenance

**Usage:**
```bash
# Install service
sudo cp deploy/systemd/storm-ui.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable storm-ui
sudo systemctl start storm-ui

# Monitor service
sudo systemctl status storm-ui
sudo journalctl -u storm-ui -f
```

## 🔄 CI/CD Pipeline

### Continuous Integration (.github/workflows/ci.yml)

**Triggers:**
- Push to `main` or `develop`
- Pull requests
- Manual dispatch

**Stages:**
1. **Backend Tests:** Python linting, type checking, unit tests
2. **Frontend Tests:** TypeScript checking, ESLint, Jest tests, E2E tests
3. **Security Scan:** Trivy vulnerability scanning, dependency checks
4. **Docker Build:** Multi-platform image building and testing
5. **Integration Tests:** Full stack testing with Docker Compose

### Continuous Deployment (.github/workflows/deploy.yml)

**Triggers:**
- Push to `main` (staging)
- Version tags (production)
- Manual dispatch

**Stages:**
1. **Pre-deployment:** Version determination, deployment validation
2. **Build & Publish:** Docker images to GitHub Container Registry
3. **Deploy Staging:** Automatic staging deployment
4. **Deploy Production:** Manual approval required for production
5. **Health Checks:** Post-deployment verification
6. **Notifications:** Slack/webhook notifications

## 🔧 Configuration Guide

### Environment Variables

#### Required Configuration
```bash
# Database
POSTGRES_PASSWORD=your_secure_password
SECRET_KEY=your_jwt_secret_key_32_chars_minimum

# API Keys (at least one search engine)
OPENAI_API_KEY=your_openai_key
BING_SEARCH_API_KEY=your_bing_search_key
```

#### Optional Configuration
```bash
# Additional LLM providers
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Additional search engines
SERPER_API_KEY=your_serper_key
TAVILY_API_KEY=your_tavily_key

# Monitoring
SENTRY_DSN=your_sentry_dsn
SLACK_WEBHOOK_URL=your_slack_webhook
```

### SSL/TLS Configuration

1. **Obtain certificates:**
   ```bash
   # Using Let's Encrypt with Certbot
   sudo certbot certonly --nginx -d storm-ui.com -d www.storm-ui.com
   ```

2. **Configure Nginx:**
   ```bash
   # Certificates should be placed in:
   /etc/ssl/certs/storm-ui.com.crt
   /etc/ssl/certs/storm-ui.com.key
   ```

3. **Auto-renewal:**
   ```bash
   # Add to crontab
   0 12 * * * /usr/bin/certbot renew --quiet
   ```

## 📊 Monitoring & Health Checks

### Health Check Script

The `deploy/scripts/health-check.sh` script provides comprehensive monitoring:

```bash
# Basic health check
./deploy/scripts/health-check.sh

# Continuous monitoring
./deploy/scripts/health-check.sh --continuous --interval 30

# JSON output for integration
./deploy/scripts/health-check.sh --json

# Check specific service
./deploy/scripts/health-check.sh --service backend

# Auto-fix common issues
./deploy/scripts/health-check.sh --fix
```

### Monitoring Endpoints

| Endpoint | Description | Response |
|----------|-------------|----------|
| `GET /health` | Nginx health | `200 OK` |
| `GET /api/health` | Backend health | `{"status": "healthy"}` |
| `GET /api/health` (frontend) | Frontend health | `200 OK` |

### Resource Monitoring

**Docker Stats:**
```bash
docker-compose ps
docker stats
```

**System Resources:**
```bash
# Disk usage
df -h /opt/storm-ui

# Memory usage
free -h

# Process monitoring
htop
```

## 🔒 Security Considerations

### Container Security
- Non-root users in all containers
- Minimal base images (Alpine Linux)
- Regular security updates
- Secrets management via environment variables

### Network Security
- Internal Docker networks
- Limited external port exposure
- Nginx rate limiting
- CORS configuration

### Application Security
- JWT token authentication
- Input validation
- SQL injection prevention
- XSS protection headers

### SSL/TLS Configuration
- Strong cipher suites
- HSTS headers
- Certificate pinning
- Regular certificate renewal

## 🚨 Troubleshooting

### Common Issues

1. **Services not starting:**
   ```bash
   # Check logs
   docker-compose logs service_name
   
   # Restart service
   docker-compose restart service_name
   ```

2. **Database connection issues:**
   ```bash
   # Test connection
   docker-compose exec backend python -c "
   import psycopg2
   conn = psycopg2.connect('postgresql://storm:password@postgres:5432/storm')
   print('Connected!')
   "
   ```

3. **Frontend build failures:**
   ```bash
   # Clear Next.js cache
   docker-compose exec frontend rm -rf .next
   docker-compose restart frontend
   ```

4. **Memory issues:**
   ```bash
   # Check memory usage
   docker stats
   
   # Increase memory limits in docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 4G
   ```

### Performance Optimization

1. **Database optimization:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_projects_user_id ON projects(user_id);
   CREATE INDEX idx_articles_created_at ON articles(created_at);
   ```

2. **Redis optimization:**
   ```bash
   # Increase memory limit
   REDIS_MAXMEMORY=512mb
   REDIS_MAXMEMORY_POLICY=allkeys-lru
   ```

3. **Nginx optimization:**
   ```nginx
   # Enable compression
   gzip on;
   gzip_comp_level 6;
   
   # Enable caching
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

## 📝 Maintenance Tasks

### Daily Tasks
- Monitor health check results
- Review application logs
- Check disk space and memory usage

### Weekly Tasks
- Update container images
- Review security alerts
- Database maintenance (VACUUM, REINDEX)
- Clean up old Docker images

### Monthly Tasks
- Security updates
- Performance review
- Backup testing
- Documentation updates

### Backup & Restore

**Database Backup:**
```bash
# Create backup
docker-compose exec postgres pg_dump -U storm storm > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U storm storm < backup.sql
```

**Full System Backup:**
```bash
# Use deployment script backup feature
./deploy/scripts/deploy.sh --backup
```

## 🤝 Contributing

When contributing deployment configurations:

1. Test changes in local environment first
2. Update documentation for any new features
3. Follow security best practices
4. Test health checks and monitoring
5. Validate CI/CD pipeline changes

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)

## 🆘 Support

For deployment issues:

1. Check the troubleshooting section above
2. Review application logs: `docker-compose logs`
3. Run health checks: `./deploy/scripts/health-check.sh`
4. Open an issue on GitHub with:
   - Error messages and logs
   - Environment details
   - Steps to reproduce

---

**Note:** This deployment configuration is production-ready but should be customized for your specific infrastructure and requirements. Always test thoroughly in a staging environment before deploying to production.