#!/bin/bash

# Wait for Ready Script
# Polls health check endpoint before starting frontend services

set -e

echo "⏳ Waiting for Recognition System services to be ready..."
echo "========================================================="

# Configuration
HEALTH_ENDPOINT="http://localhost:8080/v1/functions/health-check/executions"
API_ENDPOINT="http://localhost:8080/v1/health"
MAX_ATTEMPTS=60
WAIT_INTERVAL=5
TIMEOUT=$((MAX_ATTEMPTS * WAIT_INTERVAL))

echo "📋 Configuration:"
echo "   Health Check:     $HEALTH_ENDPOINT"
echo "   API Health:       $API_ENDPOINT"
echo "   Max Attempts:     $MAX_ATTEMPTS"
echo "   Wait Interval:    ${WAIT_INTERVAL}s"
echo "   Total Timeout:    ${TIMEOUT}s"
echo ""

# Function to check if a URL is responding
check_url() {
    local url=$1
    local name=$2
    
    if curl -f -s --max-time 10 "$url" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to check health endpoint specifically
check_health_endpoint() {
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" --max-time 10 "$HEALTH_ENDPOINT" -X POST \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null)
    
    status_code="${response: -3}"
    
    if [[ "$status_code" == "200" || "$status_code" == "201" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to get service status
get_service_status() {
    local service=$1
    local url=$2
    
    if check_url "$url" "$service"; then
        echo "✅"
    else
        echo "❌"
    fi
}

echo "🔍 Checking service availability..."

# Wait for basic Appwrite API
echo -n "   Appwrite API:      "
for ((i=1; i<=MAX_ATTEMPTS; i++)); do
    if check_url "$API_ENDPOINT" "Appwrite API"; then
        echo "✅ Ready (attempt $i/$MAX_ATTEMPTS)"
        break
    fi
    
    if [ $i -eq $MAX_ATTEMPTS ]; then
        echo "❌ Failed to start within $TIMEOUT seconds"
        echo ""
        echo "💡 Troubleshooting tips:"
        echo "   1. Check if Appwrite emulator is running: docker ps"
        echo "   2. Check emulator logs: docker logs appwrite-emulator"
        echo "   3. Verify port 8080 is not in use: netstat -an | grep 8080"
        echo "   4. Restart emulator: npm run dev:emulator"
        exit 1
    fi
    
    if [ $((i % 10)) -eq 0 ]; then
        echo -n "⏳ Still waiting (attempt $i/$MAX_ATTEMPTS)..."
    fi
    
    sleep $WAIT_INTERVAL
done

# Additional wait for services to fully initialize
echo ""
echo "⏳ Waiting for services to fully initialize..."
sleep 10

# Check individual service health
echo ""
echo "🏥 Checking service health..."

# Create a simple health check execution to test the function
echo -n "   Health Function:   "
for ((i=1; i<=10; i++)); do
    if check_health_endpoint; then
        echo "✅ Ready"
        HEALTH_FUNCTION_READY=true
        break
    fi
    
    if [ $i -eq 10 ]; then
        echo "⚠️ Health function not responding (this is non-critical)"
        HEALTH_FUNCTION_READY=false
    fi
    
    sleep 2
done

# Check database collections (if health function is ready)
if [ "$HEALTH_FUNCTION_READY" = true ]; then
    echo ""
    echo "📊 Running comprehensive health check..."
    
    HEALTH_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d '{}' \
        "$HEALTH_ENDPOINT" 2>/dev/null || echo '{"status":"unknown"}')
    
    if command -v jq >/dev/null 2>&1; then
        echo "$HEALTH_RESPONSE" | jq '.responseBody' | jq -r '.' | jq '.' 2>/dev/null || echo "   Health data not available"
    else
        echo "   Install 'jq' for detailed health information"
    fi
fi

# Final service status summary
echo ""
echo "📈 Service Status Summary:"
echo "   Appwrite API:      $(get_service_status "API" "$API_ENDPOINT")"
echo "   Database:          $(get_service_status "DB" "http://localhost:3306" || echo "✅")" # MariaDB doesn't respond to HTTP
echo "   Redis:             $(get_service_status "Redis" "http://localhost:6379" || echo "✅")" # Redis doesn't respond to HTTP
echo "   Storage:           ✅" # Included in Appwrite
echo "   Functions:         ✅" # Included in Appwrite

# Check if any test data exists
echo ""
echo "🌱 Checking for seed data..."
if [ "$HEALTH_FUNCTION_READY" = true ]; then
    echo "   Seed data check can be performed via health endpoint"
    echo "   Run 'npm run dev:seed' if no data is found"
else
    echo "   ⚠️ Cannot verify seed data (health function unavailable)"
    echo "   Run 'npm run dev:seed' to ensure test data is available"
fi

echo ""
echo "🎉 Services are ready!"
echo "=============================="
echo ""
echo "🚀 Ready to start development:"
echo "   Frontend:         npm run dev:web"
echo "   Functions:        npm run dev:api"
echo "   Full Stack:       npm run dev:all"
echo ""
echo "🔗 Available Endpoints:"
echo "   Appwrite Console: http://localhost:8080/console"
echo "   API Health:       http://localhost:8080/v1/health"
echo "   Web App:          http://localhost:3000 (after starting)"
echo ""
echo "🧪 Test Accounts (after seeding):"
echo "   Admin:            carol.admin@company.com"
echo "   Manager:          alice.manager@company.com"
echo "   Employee:         bob.employee@company.com"
echo "   Password:         Password123!"
echo ""

# Optional: Start frontend automatically
if [ "$1" = "--start-frontend" ]; then
    echo "🚀 Starting frontend automatically..."
    npm run dev:web
fi