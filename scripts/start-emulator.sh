#!/bin/bash

# Appwrite Emulator Startup Script
# Starts Appwrite emulator with required services for Recognition System

set -e

echo "🚀 Starting Appwrite Emulator for Recognition System"
echo "======================================================="

# Configuration
APPWRITE_VERSION="1.4.13"
PROJECT_ID="recognition-dev"
PROJECT_NAME="Recognition System (Dev)"
API_KEY="dev-api-key-recognition-system"

# Ports configuration
APPWRITE_PORT=8080
APPWRITE_PORT_SSL=8443
MARIADB_PORT=3306
REDIS_PORT=6379

echo "📋 Configuration:"
echo "  Appwrite Version: $APPWRITE_VERSION"
echo "  Project ID: $PROJECT_ID" 
echo "  HTTP Port: $APPWRITE_PORT"
echo "  HTTPS Port: $APPWRITE_PORT_SSL"
echo "  MariaDB Port: $MARIADB_PORT"
echo "  Redis Port: $REDIS_PORT"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Appwrite emulator is already running
if docker ps | grep -q "appwrite/appwrite:$APPWRITE_VERSION"; then
    echo "⚠️  Appwrite emulator is already running. Stopping existing instance..."
    docker stop $(docker ps -q --filter ancestor=appwrite/appwrite:$APPWRITE_VERSION) || true
    sleep 2
fi

# Create appwrite directory if it doesn't exist
mkdir -p appwrite-data

# Create docker-compose.yml for emulator
cat > docker-compose.emulator.yml << EOF
version: '3'

services:
  appwrite:
    image: appwrite/appwrite:$APPWRITE_VERSION
    container_name: appwrite-emulator
    restart: unless-stopped
    networks:
      - appwrite
    ports:
      - "$APPWRITE_PORT:80"
      - "$APPWRITE_PORT_SSL:443"
    environment:
      - _APP_ENV=development
      - _APP_LOCALE=en
      - _APP_CONSOLE_WHITELIST_ROOT=enabled
      - _APP_CONSOLE_WHITELIST_EMAILS=
      - _APP_CONSOLE_WHITELIST_IPS=
      - _APP_SYSTEM_EMAIL_NAME=Appwrite
      - _APP_SYSTEM_EMAIL_ADDRESS=team@appwrite.io
      - _APP_SYSTEM_SECURITY_EMAIL_ADDRESS=security@appwrite.io
      - _APP_SYSTEM_RESPONSE_FORMAT=
      - _APP_OPTIONS_ABUSE=enabled
      - _APP_OPTIONS_FORCE_HTTPS=disabled
      - _APP_OPENSSL_KEY_V1=your-secret-key
      - _APP_DOMAIN=localhost
      - _APP_DOMAIN_TARGET=localhost
      - _APP_REDIS_HOST=redis
      - _APP_REDIS_PORT=6379
      - _APP_REDIS_USER=
      - _APP_REDIS_PASS=
      - _APP_DB_HOST=mariadb
      - _APP_DB_PORT=3306
      - _APP_DB_SCHEMA=appwrite
      - _APP_DB_USER=user
      - _APP_DB_PASS=password
      - _APP_SMTP_HOST=
      - _APP_SMTP_PORT=
      - _APP_SMTP_SECURE=
      - _APP_SMTP_USERNAME=
      - _APP_SMTP_PASSWORD=
      - _APP_USAGE_STATS=disabled
      - _APP_STORAGE_LIMIT=30000000
      - _APP_STORAGE_PREVIEW_LIMIT=20000000
      - _APP_STORAGE_ANTIVIRUS=disabled
      - _APP_STORAGE_ANTIVIRUS_HOST=clamav
      - _APP_STORAGE_ANTIVIRUS_PORT=3310
      - _APP_STORAGE_DEVICE=local
      - _APP_STORAGE_S3_ACCESS_KEY=
      - _APP_STORAGE_S3_SECRET=
      - _APP_STORAGE_S3_REGION=us-east-1
      - _APP_STORAGE_S3_BUCKET=
      - _APP_STORAGE_DO_SPACES_ACCESS_KEY=
      - _APP_STORAGE_DO_SPACES_SECRET=
      - _APP_STORAGE_DO_SPACES_REGION=us-east-1
      - _APP_STORAGE_DO_SPACES_BUCKET=
      - _APP_STORAGE_BACKBLAZE_ACCESS_KEY=
      - _APP_STORAGE_BACKBLAZE_SECRET=
      - _APP_STORAGE_BACKBLAZE_REGION=us-west-004
      - _APP_STORAGE_BACKBLAZE_BUCKET=
      - _APP_STORAGE_LINODE_ACCESS_KEY=
      - _APP_STORAGE_LINODE_SECRET=
      - _APP_STORAGE_LINODE_REGION=eu-central-1
      - _APP_STORAGE_LINODE_BUCKET=
      - _APP_STORAGE_WASABI_ACCESS_KEY=
      - _APP_STORAGE_WASABI_SECRET=
      - _APP_STORAGE_WASABI_REGION=eu-central-1
      - _APP_STORAGE_WASABI_BUCKET=
      - _APP_FUNCTIONS_SIZE_LIMIT=30000000
      - _APP_FUNCTIONS_TIMEOUT=900
      - _APP_FUNCTIONS_BUILD_TIMEOUT=900
      - _APP_FUNCTIONS_CONTAINERS=10
      - _APP_FUNCTIONS_CPUS=0
      - _APP_FUNCTIONS_MEMORY=0
      - _APP_FUNCTIONS_MEMORY_SWAP=0
      - _APP_FUNCTIONS_RUNTIMES=node-18.0,node-16.0,php-8.1,python-3.9,ruby-3.1
      - _APP_EXECUTOR_SECRET=your-secret-key
      - _APP_EXECUTOR_HOST=http://appwrite-executor/v1
      - _APP_LOGGING_PROVIDER=
      - _APP_LOGGING_CONFIG=
    volumes:
      - appwrite-uploads:/storage/uploads:rw
      - appwrite-cache:/storage/cache:rw
      - appwrite-config:/storage/config:rw
      - appwrite-certificates:/storage/certificates:rw
      - appwrite-functions:/storage/functions:rw
    depends_on:
      - mariadb
      - redis

  appwrite-realtime:
    image: appwrite/appwrite:$APPWRITE_VERSION
    container_name: appwrite-realtime
    restart: unless-stopped
    networks:
      - appwrite
    command: realtime
    environment:
      - _APP_ENV=development
      - _APP_REDIS_HOST=redis
      - _APP_REDIS_PORT=6379
      - _APP_DB_HOST=mariadb
      - _APP_DB_PORT=3306
      - _APP_DB_SCHEMA=appwrite
      - _APP_DB_USER=user
      - _APP_DB_PASS=password
    depends_on:
      - mariadb
      - redis

  appwrite-executor:
    image: appwrite/appwrite:$APPWRITE_VERSION
    container_name: appwrite-executor
    restart: unless-stopped
    networks:
      - appwrite
    command: executor
    environment:
      - _APP_ENV=development
      - _APP_REDIS_HOST=redis
      - _APP_REDIS_PORT=6379
      - _APP_EXECUTOR_SECRET=your-secret-key
      - _APP_FUNCTIONS_TIMEOUT=900
      - _APP_FUNCTIONS_BUILD_TIMEOUT=900
      - _APP_FUNCTIONS_CONTAINERS=10
      - _APP_FUNCTIONS_CPUS=0
      - _APP_FUNCTIONS_MEMORY=0
      - _APP_FUNCTIONS_MEMORY_SWAP=0
      - _APP_FUNCTIONS_RUNTIMES=node-18.0,node-16.0,php-8.1,python-3.9,ruby-3.1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - appwrite-functions:/storage/functions:rw
      - /tmp:/tmp:rw
    depends_on:
      - mariadb
      - redis

  mariadb:
    image: mariadb:10.7
    container_name: appwrite-mariadb
    restart: unless-stopped
    networks:
      - appwrite
    ports:
      - "$MARIADB_PORT:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=appwrite
      - MYSQL_USER=user
      - MYSQL_PASSWORD=password
    volumes:
      - appwrite-mariadb:/var/lib/mysql:rw
    command: 'mysqld --innodb-flush-method=fsync'

  redis:
    image: redis:7.0-alpine
    container_name: appwrite-redis
    restart: unless-stopped
    networks:
      - appwrite
    ports:
      - "$REDIS_PORT:6379"
    volumes:
      - appwrite-redis:/data:rw

networks:
  appwrite:

volumes:
  appwrite-mariadb:
  appwrite-redis:
  appwrite-uploads:
  appwrite-cache:
  appwrite-config:
  appwrite-certificates:
  appwrite-functions:
EOF

echo "🐳 Starting Appwrite emulator containers..."
docker-compose -f docker-compose.emulator.yml up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 15

# Check if services are running
echo "🔍 Checking service health..."
for i in {1..30}; do
    if curl -f -s http://localhost:$APPWRITE_PORT/v1/health > /dev/null 2>&1; then
        echo "✅ Appwrite API is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Appwrite API did not start within 30 attempts"
        exit 1
    fi
    echo "   Attempt $i/30: Waiting for Appwrite API..."
    sleep 2
done

# Install Appwrite CLI if not available
if ! command -v appwrite &> /dev/null; then
    echo "📦 Installing Appwrite CLI..."
    npm install -g appwrite-cli
fi

# Setup project
echo "🏗️ Setting up project..."
appwrite client --endpoint http://localhost:$APPWRITE_PORT/v1 --project-id console --key console-api-key || true

# Create project
echo "📋 Creating project: $PROJECT_NAME"
appwrite projects create \
    --project-id $PROJECT_ID \
    --name "$PROJECT_NAME" \
    --region default \
    || echo "Project may already exist"

# Switch to the project
appwrite client --endpoint http://localhost:$APPWRITE_PORT/v1 --project-id $PROJECT_ID

# Create API key
echo "🔑 Creating API key..."
appwrite projects create-key \
    --project-id $PROJECT_ID \
    --name "Development API Key" \
    --scopes "users.read" "users.write" "teams.read" "teams.write" "databases.read" "databases.write" "collections.read" "collections.write" "documents.read" "documents.write" "files.read" "files.write" "buckets.read" "buckets.write" "functions.read" "functions.write" "execution.read" "execution.write" \
    || echo "API key may already exist"

# Create databases and collections
echo "🗄️ Setting up database schema..."
appwrite databases create \
    --database-id "recognition-db" \
    --name "Recognition Database" \
    || echo "Database may already exist"

# Create collections
COLLECTIONS=(
    "recognitions:Recognitions"
    "users:Users"
    "teams:Teams"
    "abuse-flags:Abuse Flags"
    "audit-log:Audit Log"
)

for collection in "${COLLECTIONS[@]}"; do
    IFS=':' read -r collection_id collection_name <<< "$collection"
    echo "   Creating collection: $collection_name"
    appwrite databases create-collection \
        --database-id "recognition-db" \
        --collection-id "$collection_id" \
        --name "$collection_name" \
        --permissions "read(\"any\")" "write(\"any\")" \
        || echo "Collection $collection_name may already exist"
done

# Create storage bucket
echo "📁 Setting up storage..."
appwrite storage create-bucket \
    --bucket-id "evidence" \
    --name "Evidence Files" \
    --permissions "read(\"any\")" "write(\"any\")" \
    --file-security false \
    --enabled true \
    || echo "Bucket may already exist"

echo ""
echo "🎉 Appwrite Emulator Setup Complete!"
echo "======================================"
echo ""
echo "📡 Service Endpoints:"
echo "   Appwrite API:     http://localhost:$APPWRITE_PORT"
echo "   Appwrite Console: http://localhost:$APPWRITE_PORT/console"
echo "   MariaDB:          localhost:$MARIADB_PORT"
echo "   Redis:            localhost:$REDIS_PORT"
echo ""
echo "🔧 Configuration:"
echo "   Project ID:       $PROJECT_ID"
echo "   Database ID:      recognition-db"
echo "   Storage Bucket:   evidence"
echo ""
echo "💡 Next Steps:"
echo "   1. Copy environment files:"
echo "      cp apps/api/.env.development.example apps/api/.env.development"
echo "      cp apps/web/.env.development.example apps/web/.env.development"
echo ""
echo "   2. Run seed data:"
echo "      npm run dev:seed"
echo ""
echo "   3. Start development servers:"
echo "      npm run dev:all"
echo ""
echo "🚫 To stop the emulator:"
echo "   docker-compose -f docker-compose.emulator.yml down"
echo ""