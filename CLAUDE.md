# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Starting Development Environment

- `./scripts/setup.sh` - Initial setup (Docker services, env files, deps, DB
  migration/seed, SSL cert)
- `./scripts/dev.sh` - Start development with tmux (API, UI, Verifier in
  separate panes)
- `./scripts/teardown.sh` - Stop and clean development environment

### Individual Services

- **API (Deno)**: `cd api && deno task dev`
  - Lint: `deno lint`
  - Type check: `deno check **/*.ts`
- **UI (React Router)**: `cd ui && npm run dev`
  - Build: `npm run build`
  - Type check: `npm run typecheck`
- **Verifier (Node.js)**: `cd verifier && npm run dev`
  - Build: `npm run build`
- **Database**: `cd db && npm run migrate` (run migrations)

### Database Operations

- Generate migrations: `cd db && npm run generate`
- Run migrations: `cd db && npm run migrate`
- Seed database: `./db/scripts/seed.sh`

## Architecture Overview

Meerkat is a privacy-preserving audience engagement tool with three main
services:

### Core Services

- **API** (`/api/`): Deno-based Hono server handling business logic,
  authentication via Zupass, and database operations
- **UI** (`/ui/`): React Router v7 frontend with Chakra UI, handles conference
  Q&A interface
- **Verifier** (`/verifier/`): Node.js service for cryptographic verification of
  PODs (Proof of Digital Identity)

### Key Technologies

- **Backend**: Deno, Hono framework, Drizzle ORM with PostgreSQL
- **Frontend**: React Router v7, Chakra UI, TypeScript, Vite
- **Authentication**: Zupass PODs (Proof of Digital Identity)
- **Database**: PostgreSQL with Drizzle migrations in `/db/drizzle/`

### Database Schema

Core entities defined in `api/schema.ts`:

- `conferences` - Conference configuration and theming
- `events` - Individual sessions within conferences
- `questions` - Audience Q&A submissions
- `users` - Authenticated users via Zupass
- `conferenceTickets` - Links users to conference roles
  (attendee/speaker/organizer)

### Frontend Architecture

- Routes defined in `ui/app/routes.ts` with nested layouts
- Context providers for Supabase and user state in `ui/app/context/`
- Custom hooks pattern for API calls in `ui/app/hooks/`
- Components organized by feature in `ui/app/components/`

### Development Environment

- Uses tmux for multi-service development
- Docker Compose for database and supporting services
- HTTPS development environment at `https://meerkat.local`
- Environment variables defined in `.env` (copy from `.env.example`)

## Important Paths

- API routes: `/api/routes/`
- Database models: `/api/models/`
- UI components: `/ui/app/components/`
- Database migrations: `/db/drizzle/`
