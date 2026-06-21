# Контекст сборки — корень репозитория (нужен доступ к prompts/).
FROM node:20-slim

WORKDIR /app

# Зависимости отдельным слоем для кэширования. tsx — в dependencies, поэтому
# доступен в проде и запускает TypeScript напрямую (без отдельной сборки).
COPY server/package.json server/package-lock.json* ./
# sqlite3 не всегда находит prebuilt-бинарь и собирается из исходников через node-gyp,
# которому нужен тулчейн (python3/make/g++). Ставим его только на время install и
# вычищаем — рантайму он не нужен, образ остаётся лёгким.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && npm install --omit=dev \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

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
