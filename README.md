# dzen-test-front

Frontend for the "Comments" SPA test assignment: tree comments with sorting, pagination, CAPTCHA,
markup toolbar with preview, attachments with a lightbox, live updates over WebSocket, moderation.

Stack: Vue 3, TypeScript, Vite, Pinia, Vue Router, Tailwind CSS 4, Vitest.
Backend: [dzen-test-back](https://github.com/sni10/dzen-test-back) (Django, GraphQL + REST).

> Work in progress.

## How it talks to the backend

The SPA and the API share **one origin**: the code calls relative URLs (`/graphql`, `/api/...`, `/ws/...`,
`/media/...`) and a proxy routes them to Django. No API address is baked into the build, so one image runs on any
host and no CORS is needed.

| Where | Proxy |
|---|---|
| Production / full local stack | Caddy (from `dzen-test-back`): `/api`, `/graphql`, `/ws`, `/media`, `/admin` → Django, everything else → this SPA (nginx) |
| `npm run dev` | the Vite dev server proxies the same paths to `API_PROXY_TARGET` (default http://localhost:8000) |

## Run

**Everything in Docker** — clone both repositories side by side and start the backend's compose, which builds this
SPA too:

```bash
git clone https://github.com/sni10/dzen-test-back.git
git clone https://github.com/sni10/dzen-test-front.git
cd dzen-test-back
cp .env.example .env
docker compose up --build      # http://localhost:8080
```

**Development** (Node 24) — the backend running (`docker compose up` in `dzen-test-back`), then:

```bash
cp .env.example .env
npm ci
npm run dev        # http://localhost:5173
```

| Command | What |
|---|---|
| `npm run lint` / `npm run lint:check` | oxlint + ESLint (fix / check only) |
| `npm run type-check` | vue-tsc |
| `npm run test:unit` | Vitest (watch) |
| `npm run build` | type check + production build |

## Git and releases

- `main` — releases, `dev` — integration, `feature/*` / `fix/*` — work branches merged into `dev` by pull request.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (checked in CI).
- CI: commit lint, lint, type check, tests, build on every push / PR to `main` and `dev`; on push to `main` —
  semantic version tag `vX.Y.Z`, GitHub Release and the image `ghcr.io/sni10/dzen-test-front:<sha>` / `:vX.Y.Z`.
