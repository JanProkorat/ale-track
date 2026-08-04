# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a monorepo containing two independently-deployed apps that together form one product:

| Path   | App               | Stack                              | Own guide          |
|--------|-------------------|------------------------------------|--------------------|
| `api/` | Backend REST API  | .NET 10, FastEndpoints, EF Core + PostgreSQL | this file (below) |
| `app/` | Frontend web app  | React 19, Vite 6, TypeScript, MUI  | **`app/CLAUDE.md`** |

The backend solution root is `api/AleTrack/` (`AleTrack.sln`); the API project itself is nested at `api/AleTrack/AleTrack/`.

**Read `app/CLAUDE.md` before touching frontend code** — it documents the API client, auth context, section structure, and testing conventions in detail. This file does not repeat them.

## The frontend ↔ backend contract (most important cross-cutting fact)

The frontend's API client (`app/src/generated/api-client.ts`) is **generated from the backend's OpenAPI spec**, not hand-written. `app/nswag.json` runs NSwag against the backend's live Swagger doc at `http://localhost:8080/swagger/v1/swagger.json`, so regeneration requires the backend running locally:

```bash
# 1. start the backend (see below), then:
cd app && yarn generate-api
```

Consequence: **a backend endpoint/DTO change and its frontend consumption belong in the same commit.** Changing a FastEndpoints request/response shape silently breaks the frontend until the client is regenerated.

## Backend (`api/`)

All commands run from `api/AleTrack/` unless noted.

```bash
dotnet build AleTrack.sln                              # build
dotnet test AleTrack.Tests/AleTrack.Tests.csproj       # run tests (no DB needed — DbContext is mocked via Moq)
dotnet test --filter "FullyQualifiedName~LoginTests"   # run a single test class
dotnet run --project AleTrack --launch-profile Local   # run the API (serves http://localhost:8080)
```

Tests are pure unit tests (xUnit + FluentAssertions + **Moq.EntityFrameworkCore** mocking the DbContext) — they do **not** require a running database.

### Architecture

- **FastEndpoints, vertical-slice / REPR.** Endpoints live under `AleTrack/Features/<Domain>/{Commands,Queries}/<Action>/` — each folder holds the endpoint, request/response DTOs, and validator together. There are no MVC controllers.
- **Persistence** — EF Core + Npgsql. `AleTrackDbContext` and migrations are under `AleTrack/Infrastructure/Persistence/`. DB-connection logic (connection string resolution, migration helper, DbContext registration) is centralized in `Infrastructure/Persistence/DatabaseConnectionExtensions.cs`.
- **Auth** — JWT bearer; password hashing via BCrypt.Net (work factor 13, see `Common/Utils/PasswordHasher.cs`). `JWT_Issuer` and `JWT_Key` come from env vars (set in `launchSettings.json` for local runs).
- **Logging** — Serilog (console), configured from `appsettings`.
- Sibling projects in the solution: `AleTrack.Tests`, `AleTrack.Seeding` (demo data), `AleTrack.ExchangeRateDownloader` (scheduled currency job).

### Configuration & the connection-string trap (read before running locally)

Config is standard ASP.NET layering: `appsettings.json` → `appsettings.{ASPNETCORE_ENVIRONMENT}.json`. The environment name decides which **database** you hit:

- `ASPNETCORE_ENVIRONMENT=Development` → loads `appsettings.Development.json` → points at the **remote Supabase** DB.
- `ASPNETCORE_ENVIRONMENT=Development.Local` → loads `appsettings.Development.Local.json` → points at the **local** DB.

`DatabaseConnectionExtensions.GetConnectionString` treats `Development.Local` specially (uses the string as-is); for any other environment it replaces a `[YOUR-PASSWORD]` placeholder with the `DB_PASSWORD` env var. **The stock `Local`/`Dev` launch profiles set `ASPNETCORE_ENVIRONMENT=Development`, i.e. the remote DB** — set `Development.Local` (or override `ConnectionStrings__AleTrack`) to stay on a local database.

- Runtime config honors env vars, so `ConnectionStrings__AleTrack=...` overrides the JSON at run time.
- The **EF design-time factory** (`AleTrackDbContextFactory`, used by `dotnet ef`) reads *only* appsettings — not env vars. To point migrations at a specific DB, pass `dotnet ef ... --connection "<string>"`.
- **Migrations are NOT auto-applied on startup** — `ApplyMigrationsAsync()` is commented out in `Program.cs`. Apply them manually (below).

### Local database, migrations, seeding

```bash
# From api/AleTrack/ — Postgres 17 (user/pass postgres/postgres, db AleTrack, port 5432):
docker compose up -d

# Apply migrations (from api/AleTrack/AleTrack/); --connection overrides the design-time factory:
dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"

# Seed demo data (3 breweries + ~230 products). The seeder needs an appsettings.json in its own
# directory with a ConnectionStrings:AleTrack entry (it reads appsettings, not env vars):
cd AleTrack.Seeding && dotnet run
```

The **`Init` migration seeds an `admin` user** (with the `Admin` role) so you can log in immediately — its password is a project secret, not stored in this repo. If you don't know it, reset the hash directly in your local DB.

## Ports

- Backend API: **8080** (frontend codegen and `.env.localhost` expect this).
- Frontend dev server: **3039** (hardcoded in `app/vite.config.ts`).

## CI

GitHub Actions live only at the repo root (`.github/workflows/`) and are **path-filtered**: `api-tests.yml` runs on `api/**`, `app-tests.yml` on `app/**`, plus the scheduled `refresh-exchange-rates.yml`. A change under one app does not trigger the other's checks. `required-checks.yml` runs on every PR as a stable branch-protection gate.

## Local secrets (never committed)

Real connection strings and keys live only in git-ignored working-tree files: `api/AleTrack/AleTrack/appsettings.Development*.json`, `appsettings.Production.json`, and `app/.env*`. The committed baselines hold placeholders. This is a **public** repository — keep real secrets out of tracked files.

## Claude: scope → stack

- `api/**` → dotnet
- `app/**` → react
