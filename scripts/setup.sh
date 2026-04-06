#!/bin/bash
set -e

echo "Starting Meerkat setup..."

# Enable corepack and install pnpm if not already available
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm via corepack..."
  corepack enable
  corepack prepare --activate
fi

echo "Setting up environment files..."
cp api/.env.example api/.env

echo "Installing dependencies..."
pnpm install

echo "Running database migrations..."
cd api
pnpm migrate

echo "Seeding database..."
./scripts/seed.sh
cd ..

echo "Setup complete!"
