#!/bin/bash
set -e

# Remove environment files
echo "🗑️ Removing environment files..."
rm -f api/.env

echo "✅ Teardown complete! Your Meerkat environment has been cleaned up."
