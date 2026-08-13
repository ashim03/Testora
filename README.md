# Testora — IELTS & PTE Test Preparation Platform

A production-ready, monorepo web platform for IELTS and PTE test preparation and assessment.
It handles registered users, exam authoring, secure timed attempts, automatic and manual grading,
results, analytics, and role-based dashboards for **Super Admins**, **Teachers**, and **Students**.

> **Important:** All scores produced by this platform are **practice estimates only** and are
> **not** official IELTS or PTE results. The UI labels them as:
> - **IELTS Practice Band**
> - **Estimated PTE Practice Score**
> - **Teacher-Assessed Score**

## Tech Stack

| Layer    | Stack |
|----------|-------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn-style custom UI, TanStack Query, Zustand, React Hook Form + Zod, Sonner, Recharts |
| Backend  | Node, Express, TypeScript, Mongoose, JWT (access + httpOnly refresh), bcryptjs, Helmet, CORS, express-rate-limit, Multer, Zod |
| Shared   | TypeScript package (`@testora-platform/shared`) holding types, constants, and Zod validators |

## Project Structure

```
ielts_pte/
├── client/            # React SPA (Vite)
│   └── src/
│       ├── api/       # axios client + refresh-token interceptor
│       ├── store/     # Zustand stores (auth, cache)
│       ├── hooks/     # useTheme, etc.
│       ├── components/ui  # reusable UI primitives
│       ├── components/layout
│       ├── config/    # role-based navigation
│       ├── pages/     # auth / admin / teacher / student screens
│       └── routes/    # auth + role route guards
├── server/            # Express API
│   └── src/
│       ├── config/    # env-led config
│       ├── models/    # Mongoose models
│       ├── middleware/ # auth, error, upload, rate-limit, sanitize
│       ├── services/  # business logic (auth, exam, grading, reports, ...)
│       ├── controllers/
│       ├── routes/
│       ├── jobs/      # auto-submit job
│       └── seed/      # sample data
└── shared/
    ├── src/constants/ # roles, question types, disclaimers
    ├── src/types/     # shared types
    └── src/validators/# Zod schemas
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Cloudinary account (optional; falls back to local upload storage)

### 1. Configure environment
```bash
# Server
cp server/.env.example server/.env
# edit server/.env with real MongoDB URI + secrets

# Client (optional)
cp client/.env.example client/.env
```

### 2. Install and seed
```bash
npm install
npm run build          # builds shared, server, and client
npm run seed           # create demo data (admin/teacher/students/exams)
# npm run seed:reset  # drops the database first, then seeds
```

### 3. Run in development
```bash
npm run dev            # starts server (port 5000) and client (port 5173)
```
Open http://localhost:5173

## Demo Accounts

| Role     | Email                     | Password       |
|----------|---------------------------|----------------|
| Admin    | `admin@example.com`       | `Admin@12345`  |
| Teacher  | `teacher@example.com`     | `Teacher@12345`|
| Student  | `student@example.com`     | `Student@12345`|

## Common scripts

| Command               | Description                    |
|-----------------------|--------------------------------|
| `npm run dev`         | Run server + client (dev)      |
| `npm run build`       | Build all workspaces           |
| `npm run lint`        | Lint all workspaces            |
| `npm run test`        | Run tests in all workspaces    |
| `npm run seed`        | Seed the database              |

Workspace-specific scripts mirror these (e.g. `npm run dev -w server`).

## Environment Variables (server)

See `server/.env.example` for the full commented list. Required at startup:
`MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `CLIENT_URL`.

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` must be strong random strings
(e.g. produce with `openssl rand -hex 32`). Never store secrets in version control.

## Security & Compliance

- JWT access tokens (short-lived) + rotating refresh tokens stored in httpOnly cookies.
- Passwords hashed with bcrypt (no plaintext ever stored or logged).
- Login/token/submit endpoints protected by rate limiting.
- Helmet security headers, CORS allow-list, request sanitization.
- RBAC: routes enforce role permissions; teachers can only access their own students/exams.
- Deliberate **practice-score disclaimers** and field labeling to avoid implying official results.

## Notes

- Scores shown (bands / PTE estimates / percentages) are practice estimates computed by the
  server and are not affiliated with, or endorsed by, IELTS or PTE official bodies.
