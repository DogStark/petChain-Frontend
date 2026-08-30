# Frontend / Backend Workspace Boundaries

This repository intentionally **mixes two independently configured Node applications** in a single repo: the Next.js frontend at the repository root and the NestJS backend under `backend/`. They must never be treated as one workspace, because root tooling can accidentally consume backend artifacts and cross-compile in ways that break both builds.

## The Two Workspaces

| Aspect | Frontend (root) | Backend (`backend/`) |
|--------|-----------------|----------------------|
| Framework | Next.js (React + TypeScript) | NestJS (Node + TypeScript) |
| Manifest | root `package.json` | `backend/package.json` |
| TypeScript | root `tsconfig.json`, `tsconfig.app.json`, `tsconfig.test.json` | `backend/tsconfig*.json` |
| Tests | `jest.config.js` (Jest), `tests/e2e` (Playwright) | backend test suite |
| Artifacts | `.next/`, `out/` at root | `backend/dist/` |
| Caches | root `node_modules`, `.turbo` | `backend/node_modules` |

## Isolation Rules

1. **Do not add backend dependencies to the root `package.json`.** Backend packages belong in `backend/package.json`; installing them at the root bloats the frontend and mixes manifests.
2. **Do not import backend code from frontend source.** Frontend talks to the backend only over HTTP at `NEXT_PUBLIC_API_URL`; it never `import`s `backend/` modules.
3. **Do not cross-compile.** The root TypeScript build must never include `backend/` sources, and the backend build must never pull root `src/`. Each workspace has its own tsconfig `rootDir`/`include` and its own build command.
4. **Keep scripts and caches separate.** Root scripts operate only on root files; backend scripts run scoped with `npm --prefix backend run <script>`. Each app keeps its own `node_modules` and build output.
5. **Root validation orchestrates, not compiles.** Root-level validation (lint, type-check, tests, build) should coordinate both workspaces by invoking each workspace's own commands, not by mixing their tooling or artifacts.

## Verification

Run each from its own workspace with its own manifest:

```bash
# Frontend
npm ci
npm run type-check
npm run test:unit
npm run build

# Backend
cd backend
npm ci
npm run build
npm test
```

If you change tooling (ESLint, tsconfig, Jest, scripts) in one workspace, verify you have not altered the other workspace's configuration.
