#!/bin/bash
# STORM UI Deployment Script
# Usage: ./deploy.sh [environment] [version]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY_DIR="/opt/storm-ui"
BACKUP_DIR="/opt/storm-ui/backups"
LOG_FILE="/var/log/storm-ui/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "${LOG_FILE}"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "${LOG_FILE}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "${LOG_FILE}"
}

# Help function
show_help() {
    cat << EOF
STORM UI Deployment Script

Usage: $0 [environment] [version]

Arguments:
    environment    Target environment (staging|production) [default: staging]
    version        Version to deploy (e.g., v1.0.0, latest) [default: latest]

Options:
    -h, --help     Show this help message
    -b, --backup   Create backup before deployment
    -r, --rollback Rollback to previous version
    -c, --check    Health check only
    -v, --verbose  Verbose output

Examples:
    $0 staging v1.2.3
    $0 production latest
    $0 staging --rollback
    $0 --check

EOF
}

# Parse command line arguments
ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"
BACKUP=false
ROLLBACK=false
HEALTH_CHECK=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--backup)
            BACKUP=true
            shift
            ;;
        -r|--rollback)
            ROLLBACK=true
            shift
            ;;
        -c|--check)
            HEALTH_CHECK=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            set -x
            shift
            ;;
        staging|production)
            ENVIRONMENT=$1
            shift
            ;;
        *)
            VERSION=$1
            shift
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
fi

# Set environment-specific variables
case $ENVIRONMENT in
    staging)
        COMPOSE_FILE="docker-compose.yml"
        ENV_FILE=".env.staging"
        DOMAIN="staging.storm-ui.com"
        ;;
    production)
        COMPOSE_FILE="docker-compose.yml"
        ENV_FILE=".env.production"
        DOMAIN="storm-ui.com"
        ;;
esac

# Check if running as correct user
if [[ $EUID -ne 0 ]] && [[ "$USER" != "storm" ]]; then
    warn "Running as user: $USER. Consider running as 'storm' user for production deployments."
fi

# Create necessary directories
mkdir -p "${BACKUP_DIR}" "${DEPLOY_DIR}" "$(dirname "${LOG_FILE}")"

log "Starting STORM UI deployment"
info "Environment: $ENVIRONMENT"
info "Version: $VERSION"
info "Deploy directory: $DEPLOY_DIR"

# Change to deployment directory
cd "$DEPLOY_DIR"

# Health check function
health_check() {
    info "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "http://localhost/health" > /dev/null 2>&1; then
            success "Health check passed"
            return 0
        fi
        
        info "Health check attempt $attempt/$max_attempts failed, waiting..."
        sleep 10
        ((attempt++))
    done
    
    error "Health check failed after $max_attempts attempts"
}

# Backup function
backup() {
    info "Creating backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="${BACKUP_DIR}/backup_${timestamp}"
    
    mkdir -p "$backup_path"
    
    # Backup current environment file
    if [[ -f "$ENV_FILE" ]]; then
        cp "$ENV_FILE" "${backup_path}/"
    fi
    
    # Export current Docker images
    if docker-compose ps -q | grep -q .; then
        info "Exporting current Docker images..."
        docker-compose images --quiet | while read -r image; do
            if [[ -n "$image" ]]; then
                local image_name=$(echo "$image" | tr '/' '_' | tr ':' '_')
                docker save "$image" | gzip > "${backup_path}/${image_name}.tar.gz" &
            fi
        done
        wait
    fi
    
    # Backup database
    if docker-compose ps postgres | grep -q "Up"; then
        info "Backing up database..."
        docker-compose exec -T postgres pg_dump -U storm storm > "${backup_path}/database.sql"
    fi
    
    # Create restore script
    cat > "${backup_path}/restore.sh" << 'EOF'
#!/bin/bash
# Restore script
BACKUP_DIR=$(dirname "$0")
cd /opt/storm-ui

echo "Restoring from backup: $BACKUP_DIR"

# Stop current services
docker-compose down

# Load Docker images
for image_file in "$BACKUP_DIR"/*.tar.gz; do
    if [[ -f "$image_file" ]]; then
        echo "Loading image: $image_file"
        docker load < "$image_file"
    fi
done

# Restore environment
if [[ -f "$BACKUP_DIR/.env.production" ]] || [[ -f "$BACKUP_DIR/.env.staging" ]]; then
    cp "$BACKUP_DIR"/.env.* ./
fi

# Start services
docker-compose up -d

echo "Restore completed"
EOF
    
    chmod +x "${backup_path}/restore.sh"
    
    success "Backup created at: $backup_path"
    echo "$backup_path" > "${BACKUP_DIR}/latest"
}

# Rollback function
rollback() {
    info "Rolling back to previous version..."
    
    if [[ ! -f "${BACKUP_DIR}/latest" ]]; then
        error "No backup found for rollback"
    fi
    
    local backup_path=$(cat "${BACKUP_DIR}/latest")
    
    if [[ ! -d "$backup_path" ]]; then
        error "Backup directory not found: $backup_path"
    fi
    
    info "Rolling back using backup: $backup_path"
    
    # Execute restore script
    bash "${backup_path}/restore.sh"
    
    # Wait for services to start
    sleep 30
    
    # Health check
    health_check
    
    success "Rollback completed successfully"
}

# Pre-deployment checks
pre_deployment_checks() {
    info "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        error "Docker is not running"
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose > /dev/null 2>&1; then
        error "docker-compose is not installed"
    fi
    
    # Check disk space (require at least 2GB free)
    local available_space=$(df "$DEPLOY_DIR" | awk 'NR==2 {print $4}')
    local required_space=$((2 * 1024 * 1024)) # 2GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        error "Insufficient disk space. Required: 2GB, Available: $((available_space / 1024 / 1024))GB"
    fi
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Environment file not found: $ENV_FILE"
    fi
    
    success "Pre-deployment checks passed"
}

# Deploy function
deploy() {
    info "Starting deployment process..."
    
    # Load environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Pull latest images
    info "Pulling Docker images for version: $VERSION"
    
    if [[ "$VERSION" != "latest" ]]; then
        # Update docker-compose file with specific version
        sed -i.bak "s|:latest|:$VERSION|g" "$COMPOSE_FILE"
    fi
    
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Stop existing services (graceful shutdown)
    info "Stopping existing services..."
    docker-compose -f "$COMPOSE_FILE" down --timeout 60
    
    # Start new services
    info "Starting new services..."
    docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans
    
    # Wait for services to initialize
    info "Waiting for services to initialize..."
    sleep 30
    
    # Health check
    health_check
    
    # Post-deployment tasks
    info "Running post-deployment tasks..."
    
    # Database migrations (if needed)
    if docker-compose ps backend | grep -q "Up"; then
        info "Running database migrations..."
        docker-compose exec -T backend python -m alembic upgrade head || warn "Database migration failed"
    fi
    
    # Clear old Docker images (keep last 3 versions)
    info "Cleaning up old Docker images..."
    docker image prune -f --filter "until=72h" || warn "Image cleanup failed"
    
    # Update systemd service if running in production
    if [[ "$ENVIRONMENT" == "production" ]] && systemctl is-enabled storm-ui > /dev/null 2>&1; then
        info "Reloading systemd service..."
        systemctl daemon-reload
    fi
    
    success "Deployment completed successfully"
}

# Post-deployment verification
post_deployment_verification() {
    info "Running post-deployment verification..."
    
    # Check all services are running
    local services=("backend" "frontend" "postgres" "redis")
    for service in "${services[@]}"; do
        if ! docker-compose ps "$service" | grep -q "Up"; then
            error "Service $service is not running"
        fi
    done
    
    # API endpoint tests
    info "Testing API endpoints..."
    
    # Test health endpoint
    if ! curl -f -s "http://localhost/health" > /dev/null; then
        error "Health endpoint is not responding"
    fi
    
    # Test API health endpoint
    if ! curl -f -s "http://localhost/api/health" > /dev/null; then
        error "API health endpoint is not responding"
    fi
    
    # Test frontend is serving content
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost/")
    if [[ "$status_code" != "200" ]]; then
        error "Frontend is not serving content properly (status: $status_code)"
    fi
    
    # Performance check
    info "Running performance check..."
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost/")
    if (( $(echo "$response_time > 5.0" | bc -l) )); then
        warn "High response time detected: ${response_time}s"
    fi
    
    success "Post-deployment verification completed"
}

# Main execution
main() {
    # Handle special flags
    if [[ "$HEALTH_CHECK" == true ]]; then
        health_check
        exit 0
    fi
    
    if [[ "$ROLLBACK" == true ]]; then
        rollback
        exit 0
    fi
    
    # Normal deployment flow
    pre_deployment_checks
    
    if [[ "$BACKUP" == true ]] || [[ "$ENVIRONMENT" == "production" ]]; then
        backup
    fi
    
    deploy
    post_deployment_verification
    
    # Summary
    info "Deployment Summary:"
    info "  Environment: $ENVIRONMENT"
    info "  Version: $VERSION"
    info "  Domain: $DOMAIN"
    info "  Timestamp: $(date)"
    
    success "STORM UI deployment completed successfully!"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        info "🎉 Production deployment is live at: https://$DOMAIN"
    else
        info "🚀 Staging deployment is live at: https://$DOMAIN"
    fi
}

# Trap errors and cleanup
trap 'error "Deployment failed at line $LINENO"' ERR

# Execute main function
main "$@"