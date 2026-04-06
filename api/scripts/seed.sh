#!/bin/bash
set -e

psql "$DATABASE_URL" -f ./seed.sql