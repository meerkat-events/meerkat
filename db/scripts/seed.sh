#!/bin/bash
set -e

# Get the absolute path of the script directory
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")

# Execute the Docker command
docker run --rm -v "$SCRIPT_DIR:/mnt" --network meerkat_default postgres:16 psql postgresql://postgres:postgres@postgres:5432/postgres -f /mnt/seed.sql