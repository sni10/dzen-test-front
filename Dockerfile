# SPA: build static files with Node, serve them with nginx (no Node at runtime)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# No API address in the bundle: the SPA calls relative URLs (/api, /graphql, /ws) and the proxy in front of it
# (Caddy) routes them to the backend on the same origin. .env is not copied into the image (.dockerignore).
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build-only

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
