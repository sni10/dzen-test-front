# dzen-test-front

Фронтенд тестового задания «SPA-комментарии»: древовидные комментарии с сортировкой и пагинацией, CAPTCHA,
панель разметки с предпросмотром, вложения с лайтбоксом, обновления в реальном времени по WebSocket,
голоса и закладки, кабинет, поиск, модерация.

Стек: Vue 3, TypeScript, Vite, Pinia, Vue Router, Tailwind CSS 4, Vitest.
Бэкенд: [dzen-test-back](https://github.com/sni10/dzen-test-back) (Django, GraphQL + REST).

> В работе.

## Ссылки

| Что | Где |
|---|---|
| Рабочий сайт | https://comments.185-233-44-60.sslip.io |
| Документация API, примеры запросов, схема БД | [README бэкенда](https://github.com/sni10/dzen-test-back#readme) |

## Как фронтенд общается с бэкендом

SPA и API живут на **одном адресе**: код обращается по относительным путям (`/graphql`, `/api/...`, `/ws/...`,
`/media/...`), а прокси направляет их в Django. Адрес API не зашит в сборку, поэтому один образ работает на любом
хосте и CORS не нужен.

| Где | Прокси |
|---|---|
| Продакшен / полный локальный стенд | Caddy (из `dzen-test-back`): `/api`, `/graphql`, `/ws`, `/media`, `/admin` → Django, всё остальное → это SPA (nginx) |
| `npm run dev` | dev-сервер Vite проксирует те же пути на `API_PROXY_TARGET` (по умолчанию http://localhost:8000) |

## Запуск

**Всё в Docker** — клонировать оба репозитория рядом и запустить compose бэкенда, он собирает и этот SPA:

```bash
git clone https://github.com/sni10/dzen-test-back.git
git clone https://github.com/sni10/dzen-test-front.git
cd dzen-test-back
cp .env.example .env
docker compose up --build      # http://localhost:8080
```

**Разработка** (Node 24) — при запущенном бэкенде (`docker compose up` в `dzen-test-back`):

```bash
cp .env.example .env
npm ci
npm run dev        # http://localhost:5173
```

| Команда | Что делает |
|---|---|
| `npm run lint` / `npm run lint:check` | oxlint + ESLint (с исправлением / только проверка) |
| `npm run type-check` | vue-tsc |
| `npm run test:unit` | Vitest (в режиме наблюдения) |
| `npm run build` | проверка типов + продакшен-сборка |

## Git и релизы

- `main` — релизы, `dev` — интеграция, `feature/*` / `fix/*` — рабочие ветки, сливаются в `dev` через pull request.
- Сообщения коммитов — по [Conventional Commits](https://www.conventionalcommits.org/) (проверяется в CI).
- CI: проверка коммитов, линтер, проверка типов, тесты и сборка на каждый push / PR в `main` и `dev`; при push в
  `main` — семантический тег `vX.Y.Z`, GitHub Release и образ `ghcr.io/sni10/dzen-test-front:<sha>` / `:vX.Y.Z`.
