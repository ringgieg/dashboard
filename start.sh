#!/bin/bash
# Shell script to start Loki Viewer stack

set -e

echo "Starting Loki Viewer stack..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker."
    exit 1
fi

# Build and start containers
echo "Building and starting containers..."
docker-compose up -d --build

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 10

# Check container status
echo ""
echo "Container Status:"
docker-compose ps

# Display access information
echo ""
echo "=================================="
echo "Loki Viewer is ready!"
echo "=================================="
echo "Viewer URL:  http://localhost:8080"
echo "Loki API:    http://localhost:3100"
echo "Health:      http://localhost:8080/health"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f loki-viewer"
echo ""
echo "To stop:"
echo "  docker-compose down"
echo "=================================="
echo ""
