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

echo "Building workspace packages..."
pnpm -r build

echo "Running database migrations..."
cd api
pnpm migrate
# On a fresh Supabase project also apply scripts/supabase-policies.sql (RLS,
# realtime policies, publication) — not run here because it needs Supabase's
# supabase_realtime publication and anon/authenticated roles.

echo "Seeding database..."
./scripts/seed.sh
cd ..

echo "Setup complete!"
