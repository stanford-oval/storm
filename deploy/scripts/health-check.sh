#!/bin/bash
# STORM UI Health Check Script
# Comprehensive health monitoring for all system components

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/storm-ui/health-check.log"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
MAX_RESPONSE_TIME=5.0
CRITICAL_SERVICES=("postgres" "redis" "backend" "frontend")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Health check results
HEALTH_STATUS="healthy"
FAILED_CHECKS=()
WARNINGS=()

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $*"
    log "[INFO] $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
    log "[WARN] $*"
    WARNINGS+=("$*")
}

error() {
    echo -e "${RED}[ERROR]${NC} $*"
    log "[ERROR] $*"
    FAILED_CHECKS+=("$*")
    HEALTH_STATUS="unhealthy"
}

success() {
    echo -e "${GREEN}[OK]${NC} $*"
    log "[OK] $*"
}

# Help function
show_help() {
    cat << EOF
STORM UI Health Check Script

Usage: $0 [options]

Options:
    -h, --help         Show this help message
    -v, --verbose      Verbose output
    -q, --quiet        Quiet mode (only errors)
    -j, --json         Output results in JSON format
    -c, --continuous   Run continuous monitoring
    -i, --interval N   Check interval in seconds (default: 60)
    -f, --fix          Attempt to fix issues automatically
    --endpoint URL     Check specific endpoint only
    --service NAME     Check specific service only

Examples:
    $0                           # Run all health checks
    $0 --verbose                 # Run with detailed output
    $0 --service backend         # Check backend service only
    $0 --endpoint /api/health    # Check specific endpoint
    $0 --continuous --interval 30 # Continuous monitoring every 30s

EOF
}

# Parse command line arguments
VERBOSE=false
QUIET=false
JSON_OUTPUT=false
CONTINUOUS=false
INTERVAL=60
AUTO_FIX=false
SPECIFIC_ENDPOINT=""
SPECIFIC_SERVICE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -j|--json)
            JSON_OUTPUT=true
            shift
            ;;
        -c|--continuous)
            CONTINUOUS=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -f|--fix)
            AUTO_FIX=true
            shift
            ;;
        --endpoint)
            SPECIFIC_ENDPOINT="$2"
            shift 2
            ;;
        --service)
            SPECIFIC_SERVICE="$2"
            shift 2
            ;;
        *)
            warn "Unknown option: $1"
            shift
            ;;
    esac
done

# Create log directory
mkdir -p "$(dirname "${LOG_FILE}")"

# Utility functions
check_command() {
    if ! command -v "$1" > /dev/null 2>&1; then
        error "Command not found: $1"
        return 1
    fi
}

measure_response_time() {
    local url="$1"
    local response_time
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "$url" 2>/dev/null || echo "999")
    echo "$response_time"
}

check_http_status() {
    local url="$1"
    local expected_status="${2:-200}"
    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [[ "$status_code" == "$expected_status" ]]; then
        return 0
    else
        return 1
    fi
}

# Docker service checks
check_docker() {
    info "Checking Docker daemon..."
    
    if ! docker info > /dev/null 2>&1; then
        error "Docker daemon is not running"
        return 1
    fi
    
    success "Docker daemon is running"
}

check_docker_compose() {
    info "Checking Docker Compose services..."
    
    if ! command -v docker-compose > /dev/null 2>&1; then
        error "docker-compose not found"
        return 1
    fi
    
    local services_status
    services_status=$(docker-compose ps --services --filter status=running 2>/dev/null || echo "")
    
    if [[ -z "$services_status" ]]; then
        error "No Docker Compose services are running"
        return 1
    fi
    
    success "Docker Compose services are running"
    
    if [[ "$VERBOSE" == true ]]; then
        docker-compose ps
    fi
}

check_service_health() {
    local service="$1"
    
    if [[ -n "$SPECIFIC_SERVICE" ]] && [[ "$service" != "$SPECIFIC_SERVICE" ]]; then
        return 0
    fi
    
    info "Checking $service service..."
    
    local container_status
    container_status=$(docker-compose ps -q "$service" | xargs -I {} docker inspect -f '{{.State.Status}}' {} 2>/dev/null || echo "not_found")
    
    case "$container_status" in
        "running")
            success "$service service is running"
            ;;
        "not_found")
            error "$service service container not found"
            ;;
        *)
            error "$service service is not healthy (status: $container_status)"
            ;;
    esac
    
    # Check resource usage
    if [[ "$container_status" == "running" ]]; then
        local container_id
        container_id=$(docker-compose ps -q "$service")
        
        if [[ -n "$container_id" ]]; then
            local stats
            stats=$(docker stats "$container_id" --no-stream --format "table {{.CPUPerc}}\t{{.MemPerc}}" | tail -n 1)
            
            if [[ "$VERBOSE" == true ]]; then
                info "$service resource usage: $stats"
            fi
            
            # Parse CPU and memory percentages
            local cpu_percent memory_percent
            cpu_percent=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
            memory_percent=$(echo "$stats" | awk '{print $2}' | sed 's/%//')
            
            # Warning thresholds
            if (( $(echo "$cpu_percent > 80" | bc -l 2>/dev/null) )); then
                warn "$service high CPU usage: ${cpu_percent}%"
            fi
            
            if (( $(echo "$memory_percent > 85" | bc -l 2>/dev/null) )); then
                warn "$service high memory usage: ${memory_percent}%"
            fi
        fi
    fi
}

# Database connectivity checks
check_postgres() {
    info "Checking PostgreSQL connectivity..."
    
    local db_check
    db_check=$(docker-compose exec -T postgres pg_isready -U storm 2>/dev/null || echo "failed")
    
    if [[ "$db_check" == *"accepting connections"* ]]; then
        success "PostgreSQL is accepting connections"
    else
        error "PostgreSQL is not accepting connections"
        return 1
    fi
    
    # Check database size and connections
    if [[ "$VERBOSE" == true ]]; then
        local db_stats
        db_stats=$(docker-compose exec -T postgres psql -U storm -d storm -c "
            SELECT 
                pg_database_size('storm') as db_size,
                (SELECT count(*) FROM pg_stat_activity WHERE datname='storm') as active_connections;
        " 2>/dev/null || echo "Query failed")
        
        info "Database stats: $db_stats"
    fi
}

check_redis() {
    info "Checking Redis connectivity..."
    
    local redis_check
    redis_check=$(docker-compose exec -T redis redis-cli ping 2>/dev/null || echo "failed")
    
    if [[ "$redis_check" == "PONG" ]]; then
        success "Redis is responding"
    else
        error "Redis is not responding"
        return 1
    fi
    
    # Check Redis memory usage
    if [[ "$VERBOSE" == true ]]; then
        local redis_info
        redis_info=$(docker-compose exec -T redis redis-cli info memory | grep "used_memory_human" 2>/dev/null || echo "Info failed")
        info "Redis memory usage: $redis_info"
    fi
}

# Application endpoint checks
check_backend_api() {
    info "Checking backend API endpoints..."
    
    local base_url="http://localhost:8000"
    
    # Health endpoint
    local endpoint="/health"
    if [[ -n "$SPECIFIC_ENDPOINT" ]]; then
        endpoint="$SPECIFIC_ENDPOINT"
    fi
    
    local full_url="${base_url}${endpoint}"
    local response_time
    response_time=$(measure_response_time "$full_url")
    
    if check_http_status "$full_url" "200"; then
        success "Backend API health endpoint is responding"
        
        if (( $(echo "$response_time > $MAX_RESPONSE_TIME" | bc -l 2>/dev/null) )); then
            warn "Backend API slow response time: ${response_time}s (threshold: ${MAX_RESPONSE_TIME}s)"
        else
            success "Backend API response time: ${response_time}s"
        fi
    else
        error "Backend API health endpoint is not responding"
        return 1
    fi
    
    # Test additional critical endpoints
    if [[ -z "$SPECIFIC_ENDPOINT" ]]; then
        local endpoints=("/api/health" "/api/projects" "/docs")
        
        for ep in "${endpoints[@]}"; do
            if check_http_status "${base_url}${ep}" "200"; then
                success "Endpoint $ep is responding"
            else
                warn "Endpoint $ep is not responding properly"
            fi
        done
    fi
}

check_frontend() {
    info "Checking frontend application..."
    
    local base_url="http://localhost:3000"
    
    # Main page
    local response_time
    response_time=$(measure_response_time "$base_url/")
    
    if check_http_status "$base_url/" "200"; then
        success "Frontend application is responding"
        
        if (( $(echo "$response_time > $MAX_RESPONSE_TIME" | bc -l 2>/dev/null) )); then
            warn "Frontend slow response time: ${response_time}s (threshold: ${MAX_RESPONSE_TIME}s)"
        else
            success "Frontend response time: ${response_time}s"
        fi
    else
        error "Frontend application is not responding"
        return 1
    fi
    
    # Check if Next.js health endpoint exists
    if check_http_status "$base_url/api/health" "200"; then
        success "Frontend health endpoint is responding"
    fi
}

check_nginx() {
    info "Checking Nginx proxy..."
    
    local base_url="http://localhost"
    
    if check_http_status "$base_url/health" "200"; then
        success "Nginx proxy is responding"
    else
        error "Nginx proxy is not responding"
        return 1
    fi
    
    # Test proxy routing
    if check_http_status "$base_url/api/health" "200"; then
        success "Nginx API proxy routing is working"
    else
        warn "Nginx API proxy routing may have issues"
    fi
}

# WebSocket connectivity check
check_websocket() {
    info "Checking WebSocket connectivity..."
    
    # Simple WebSocket test using curl (if server supports it)
    local ws_test
    ws_test=$(curl -s -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" http://localhost:8000/ws/ 2>/dev/null || echo "failed")
    
    if [[ "$ws_test" == *"101"* ]] || [[ "$ws_test" == *"upgrade"* ]]; then
        success "WebSocket endpoint is accessible"
    else
        warn "WebSocket endpoint may not be properly configured"
    fi
}

# System resource checks
check_system_resources() {
    info "Checking system resources..."
    
    # Disk space
    local disk_usage
    disk_usage=$(df /opt/storm-ui 2>/dev/null | awk 'NR==2 {print $(NF-1)}' | sed 's/%//' || echo "unknown")
    
    if [[ "$disk_usage" != "unknown" ]] && [[ "$disk_usage" -gt 85 ]]; then
        warn "High disk usage: ${disk_usage}%"
    else
        success "Disk usage is acceptable: ${disk_usage}%"
    fi
    
    # Memory usage
    if command -v free > /dev/null 2>&1; then
        local memory_usage
        memory_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
        
        if [[ "$memory_usage" -gt 85 ]]; then
            warn "High memory usage: ${memory_usage}%"
        else
            success "Memory usage is acceptable: ${memory_usage}%"
        fi
    fi
    
    # Load average
    if command -v uptime > /dev/null 2>&1; then
        local load_avg
        load_avg=$(uptime | awk -F'load average:' '{print $2}' | cut -d, -f1 | xargs)
        info "System load average: $load_avg"
    fi
}

# Security checks
check_security() {
    info "Running basic security checks..."
    
    # Check for exposed ports
    local exposed_ports
    exposed_ports=$(docker-compose ps --format json 2>/dev/null | jq -r '.Publishers[]?.PublishedPort' 2>/dev/null | sort -u || echo "")
    
    if [[ "$VERBOSE" == true ]] && [[ -n "$exposed_ports" ]]; then
        info "Exposed ports: $(echo "$exposed_ports" | tr '\n' ' ')"
    fi
    
    # Check SSL certificates (if applicable)
    if [[ -f "/etc/ssl/certs/storm-ui.com.crt" ]]; then
        local cert_expiry
        cert_expiry=$(openssl x509 -in /etc/ssl/certs/storm-ui.com.crt -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
        
        if [[ "$cert_expiry" != "unknown" ]]; then
            local days_until_expiry
            days_until_expiry=$(( ( $(date -d "$cert_expiry" +%s) - $(date +%s) ) / 86400 ))
            
            if [[ "$days_until_expiry" -lt 30 ]]; then
                warn "SSL certificate expires in $days_until_expiry days"
            else
                success "SSL certificate is valid for $days_until_expiry days"
            fi
        fi
    fi
}

# Attempt to fix common issues
auto_fix_issues() {
    if [[ "$AUTO_FIX" != true ]]; then
        return 0
    fi
    
    info "Attempting to fix detected issues..."
    
    # Restart unhealthy services
    for service in "${CRITICAL_SERVICES[@]}"; do
        local container_status
        container_status=$(docker-compose ps -q "$service" | xargs -I {} docker inspect -f '{{.State.Status}}' {} 2>/dev/null || echo "not_found")
        
        if [[ "$container_status" != "running" ]]; then
            warn "Restarting $service service..."
            docker-compose restart "$service" || warn "Failed to restart $service"
            sleep 10
        fi
    done
    
    # Clean up disk space if needed
    local disk_usage
    disk_usage=$(df /opt/storm-ui 2>/dev/null | awk 'NR==2 {print $(NF-1)}' | sed 's/%//' || echo "0")
    
    if [[ "$disk_usage" -gt 90 ]]; then
        warn "Cleaning up Docker resources to free disk space..."
        docker system prune -f || warn "Failed to clean up Docker resources"
    fi
}

# Send alerts
send_alert() {
    local message="$1"
    local severity="${2:-warning}"
    
    if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
        local payload
        payload=$(cat << EOF
{
    "text": "STORM UI Health Alert",
    "attachments": [
        {
            "color": "${severity}",
            "fields": [
                {
                    "title": "Message",
                    "value": "$message",
                    "short": false
                },
                {
                    "title": "Timestamp",
                    "value": "$(date)",
                    "short": true
                },
                {
                    "title": "Server",
                    "value": "$(hostname)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )
        
        curl -s -X POST -H 'Content-type: application/json' \
            --data "$payload" "$ALERT_WEBHOOK_URL" > /dev/null 2>&1 || \
            warn "Failed to send alert webhook"
    fi
}

# Generate JSON output
generate_json_output() {
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    local failed_checks_json
    failed_checks_json=$(printf '%s\n' "${FAILED_CHECKS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
    
    local warnings_json
    warnings_json=$(printf '%s\n' "${WARNINGS[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
    
    cat << EOF
{
    "timestamp": "$timestamp",
    "status": "$HEALTH_STATUS",
    "failed_checks": $failed_checks_json,
    "warnings": $warnings_json,
    "total_checks": $((${#FAILED_CHECKS[@]} + ${#WARNINGS[@]}))
}
EOF
}

# Main health check function
run_health_checks() {
    local start_time
    start_time=$(date +%s)
    
    info "Starting STORM UI health checks..."
    
    # Reset counters
    FAILED_CHECKS=()
    WARNINGS=()
    HEALTH_STATUS="healthy"
    
    # Run checks
    check_command "docker" || return 1
    check_command "docker-compose" || return 1
    
    check_docker || return 1
    check_docker_compose || return 1
    
    # Service-specific checks
    for service in "${CRITICAL_SERVICES[@]}"; do
        check_service_health "$service"
    done
    
    check_postgres
    check_redis
    check_backend_api
    check_frontend
    
    # Optional checks
    if docker-compose ps nginx | grep -q "Up" 2>/dev/null; then
        check_nginx
    fi
    
    check_websocket
    check_system_resources
    check_security
    
    # Auto-fix if enabled
    auto_fix_issues
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Summary
    info "Health check completed in ${duration}s"
    
    if [[ "$HEALTH_STATUS" == "healthy" ]]; then
        if [[ ${#WARNINGS[@]} -eq 0 ]]; then
            success "All health checks passed!"
        else
            warn "Health checks passed with ${#WARNINGS[@]} warning(s)"
        fi
    else
        error "Health check failed with ${#FAILED_CHECKS[@]} error(s) and ${#WARNINGS[@]} warning(s)"
        
        if [[ "$QUIET" != true ]]; then
            echo
            echo "Failed checks:"
            for check in "${FAILED_CHECKS[@]}"; do
                echo "  - $check"
            done
        fi
        
        # Send alert for critical failures
        send_alert "Health check failed with ${#FAILED_CHECKS[@]} errors" "danger"
    fi
    
    # JSON output
    if [[ "$JSON_OUTPUT" == true ]]; then
        generate_json_output
    fi
    
    # Return appropriate exit code
    if [[ "$HEALTH_STATUS" == "healthy" ]]; then
        return 0
    else
        return 1
    fi
}

# Continuous monitoring
continuous_monitoring() {
    info "Starting continuous health monitoring (interval: ${INTERVAL}s)"
    
    while true; do
        run_health_checks
        
        if [[ "$CONTINUOUS" == true ]]; then
            sleep "$INTERVAL"
        else
            break
        fi
    done
}

# Main execution
main() {
    if [[ "$CONTINUOUS" == true ]]; then
        continuous_monitoring
    else
        run_health_checks
    fi
}

# Trap signals for graceful shutdown
trap 'info "Health check interrupted"; exit 130' INT TERM

# Execute main function
main "$@"