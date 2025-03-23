#!/bin/bash
set -e

echo "🧹 Starting Meerkat teardown..."

# Stop Docker Compose services
echo "🛑 Stopping Docker Compose services..."
docker compose down -v

# Remove environment files
echo "🗑️ Removing environment files..."
rm -f api/.env
rm -f db/.env

echo "✅ Teardown complete! Your Meerkat environment has been cleaned up."
