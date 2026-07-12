# AleTrack

Monorepo for the AleTrack project.

| Path   | Description                                    | Stack                       |
|--------|------------------------------------------------|-----------------------------|
| `api/` | Backend REST API                               | .NET 8, FastEndpoints       |
| `app/` | Frontend web app                               | React, Vite, TypeScript     |

The frontend consumes the backend's OpenAPI spec — the API client in
`app/src/generated/api-client.ts` is generated from the running backend via
`yarn generate-api` (see `app/nswag.json`). Backend contract changes and their
frontend consumption belong in the same commit.

## Getting started

```bash
# Backend
cd api/AleTrack && dotnet run

# Frontend (expects backend on http://localhost:8080)
cd app && yarn install && yarn dev:local
```

Local config (`.env*`, `appsettings.*.json`, IDE folders) is git-ignored and
lives only on your machine.
