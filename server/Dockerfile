# Контекст сборки — корень репозитория (нужен доступ к prompts/).
# slim (Debian), а не alpine: нативный модуль sqlite3 ставится из prebuilt без сборки.
FROM node:20-slim

WORKDIR /app

# Зависимости отдельным слоем для кэширования. tsx — в dependencies, поэтому
# доступен в проде и запускает TypeScript напрямую (без отдельной сборки).
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Код сервера (TypeScript) и tsconfig.
COPY server/src ./src
COPY server/tsconfig.json ./

# Промты. generator.ts резолвит ../../../prompts от /app/src/services -> /prompts.
COPY prompts /prompts

# Каталог под файловую БД (в проде монтируется как volume ./data).
RUN mkdir -p /app/data

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
