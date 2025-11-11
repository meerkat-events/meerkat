#!/bin/bash
set -e

echo "Starting Meerkat setup..."

echo "Setting up environment files..."
cp api/.env.example api/.env
cp db/.env.example db/.env

echo "Installing Verifier dependencies..."
cd verifier
npm install
cd ..

echo "Setting up database..."
cd db
npm install
npm run migrate
cd ..

echo "Seeding database..."
cd db
./scripts/seed.sh
cd ..

echo "Setup complete!"
