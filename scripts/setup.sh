#!/bin/bash
set -e

echo "Starting Meerkat setup..."

# Install pnpm if not already available. Node 26 dropped corepack, so use pnpm's
# own installer (https://pnpm.io/installation). pnpm then switches itself to the
# version pinned in "packageManager".
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm..."
  # SHELL tells the installer which rc file to update; it aborts without it.
  curl -fsSL https://get.pnpm.io/install.sh | env SHELL="${SHELL:-$(command -v bash)}" sh -
  # That only edits the rc file, so put pnpm on PATH for the rest of this run.
  for dir in "$PNPM_HOME" "$HOME/Library/pnpm" "$HOME/.local/share/pnpm"; do
    if [ -n "$dir" ] && [ -x "$dir/bin/pnpm" ]; then
      export PNPM_HOME="$dir"
      export PATH="$PNPM_HOME/bin:$PATH"
      break
    fi
  done
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
