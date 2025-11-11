#!/bin/bash
set -e

# Remove environment files
echo "🗑️ Removing environment files..."
rm -f api/.env
rm -f db/.env

echo "✅ Teardown complete! Your Meerkat environment has been cleaned up."
