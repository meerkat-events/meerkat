#!/bin/bash
set -e

psql postgresql://postgres:postgres@localhost:5432/postgres -f ./seed.sql