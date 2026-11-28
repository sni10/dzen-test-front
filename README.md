# dzen-test-front

[![CI](https://github.com/sni10/dzen-test-front/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sni10/dzen-test-front/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/sni10/dzen-test-front?sort=semver)](https://github.com/sni10/dzen-test-front/releases)
[![Tests](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsni10%2Fdzen-test-front%2Fbadges%2Ftests.json)](https://github.com/sni10/dzen-test-front/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fsni10%2Fdzen-test-front%2Fbadges%2Fcoverage.json)](https://github.com/sni10/dzen-test-front/actions/workflows/ci.yml)
[![Docker image](https://img.shields.io/badge/image-ghcr.io%2Fsni10%2Fdzen--test--front-2496ED?logo=docker&logoColor=white)](https://github.com/sni10/dzen-test-front/pkgs/container/dzen-test-front)
[![Last commit](https://img.shields.io/github/last-commit/sni10/dzen-test-front)](https://github.com/sni10/dzen-test-front/commits/main)

[![Vue](https://img.shields.io/badge/vue-3.5-4FC08D?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Pinia](https://img.shields.io/badge/pinia-4-FFD859)](https://pinia.vuejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/tailwind_css-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/vitest-4-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Node](https://img.shields.io/badge/node-24-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

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
