#!/bin/bash
set -e

echo "Starting Meerkat setup..."

# Install pnpm if not already available. Node 26 dropped corepack, so use npm;
# pnpm then switches itself to the version pinned in "packageManager".
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm via npm..."
  npm install -g pnpm
fi

echo "Setting up environment files..."
if [ -f api/.env ]; then
  echo "api/.env already exists, leaving it untouched."
else
  cp api/.env.example api/.env
fi

echo "Installing dependencies..."
pnpm install

echo "Building workspace packages..."
pnpm -r build

echo "Running database migrations..."
cd api
pnpm migrate

echo "Seeding database..."
./scripts/seed.sh
cd ..

echo "Setup complete!"
