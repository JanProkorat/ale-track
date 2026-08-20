# AleTrack

Monorepo for the AleTrack project.

| Path   | Description                                    | Stack                       |
|--------|------------------------------------------------|-----------------------------|
| `api/` | Backend REST API                               | .NET 10, FastEndpoints      |
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

## Deployment

Two long-lived branches map to two environments:

| Branch | Environment | Backend (Render)        | Frontend (Netlify)                    |
|--------|-------------|-------------------------|---------------------------------------|
| `dev`  | development | dev service             | `dev` branch deploy → dev API         |
| `main` | production  | production service      | production deploy → prod API          |

- **Deploy to dev**: push/merge to `dev`. **Promote to production**: merge `dev → main`.
- Render's dev service has its Root Directory set to `api/AleTrack`, so a **push
  that only touches `app/` won't rebuild the backend** (and vice-versa).
- The frontend's API URL (`VITE_API_BASE_URL`) is baked in at build time and set
  **per Netlify deploy context**, so each environment's build points at its own
  backend. Changing it requires a rebuild of that context.

