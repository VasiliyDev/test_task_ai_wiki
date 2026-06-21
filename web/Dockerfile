# --- сборка ---
# slim (glibc), а не alpine (musl): на musl npm не ставит нативные optional-deps
# rollup/lightningcss/tailwind-oxide из lock-файла и сборка падает. glibc совпадает
# с lock (он сгенерён на linux-x64-gnu) → vite-сборка проходит без ручных доустановок.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# --- отдача статики + прокси на API ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
