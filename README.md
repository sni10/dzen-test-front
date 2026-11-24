# dzen-test-front

Frontend for the "Comments" SPA test assignment: tree comments with sorting, pagination, CAPTCHA,
markup toolbar with preview, attachments with a lightbox, live updates over WebSocket, moderation.

Stack: Vue 3, TypeScript, Vite, Pinia, Vue Router, Tailwind CSS 4, Vitest.
Backend: [dzen-test-back](https://github.com/sni10/dzen-test-back) (Django, GraphQL + REST).

> Work in progress.

## Run

Start the backend first (`dzen-test-back`: `cp .env.example .env && docker compose up --build`, API on
http://localhost:8000). The two repositories are expected side by side.

**Docker** (built SPA in nginx):

```bash
git clone https://github.com/sni10/dzen-test-front.git
cd dzen-test-front
docker compose up --build
```

Open http://localhost:8080.

**Development** (Node 24):

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
