# AI-вики

Пользователь задаёт вопрос → получает **статью**, на которую можно сослаться (а не разовый
чат-ответ). Статьи копятся в базе и со временем приносят органический SEO/GEO-трафик.

## ⚡ Два режима запуска (важно)

Движок генерации выбирается автоматически. **Ключевое отличие — где запущен бэкенд:**

| Режим | Команда | Чем генерит | Что нужно |
|---|---|---|---|
| **Локально (dev)** | `npm run dev` (server + web) | локальный `claude` CLI (твоя подписка), **бесплатно** | установленный и **залогиненный** Claude CLI на этой машине |
| **В контейнерах** | `docker compose up --build` | Anthropic **API по ключу** | `ANTHROPIC_API_KEY` в `.env` |

> **Почему так:** контейнер изолирован — бинаря `claude` с хоста внутри **нет**, поэтому в Docker
> генерация работает только по API-ключу. Локальный запуск (`npm run dev`) видит твой `claude` и
> генерит бесплатно через подписку.
>
> Если генерация недоступна (**ни ключа, ни локального `claude`**) — чат блокируется, но Каталог /
> Сравнение / Промты работают по данным из БД. Так проект можно отдать в репозиторий: ревьюер
> поднимет как захочет.

### Локально (dev) — бесплатно через свой Claude CLI

```bash
cd server && npm install && npm run dev   # API :3000, режим claude-cli (без ключа)
cd web && npm install && npm run dev      # фронт :5173 (или следующий свободный), проксирует /api
# открыть http://localhost:5173
```
БД-файл `data/aiwiki.sqlite` создаётся автоматически, промты сидятся из `prompts/*.md`.

### В контейнерах — по API-ключу

```bash
cp .env.example .env        # впишите ANTHROPIC_API_KEY=sk-ant-api03-...
docker compose up --build
# фронт http://localhost:8080 · API http://localhost:3000/api/health
```

## Архитектура

- **`server/`** — бэкенд на **TypeScript** (Express + Sequelize, **файловая БД SQLite**, запуск
  через `tsx`). Двухрежимный движок (`anthropic` / `claude-cli`), промты в БД с версиями,
  детерминированный поиск дублей, двойной прогон (baseline + статья), субагент-проверяльщик,
  категоризация, SSE-стрим «хода мысли».
- **`web/`** — фронт на **TypeScript**: Vue 3 + Vite + vue-router, **Tailwind v4**, **TanStack
  Query**. Слои: `api/` (транспорт) → `queries/` (server-state, useQuery/useMutation) → `views/`.
  Чат — собственный нативный компонент (sidebar + лента + composer), стрим «мыслей» в модульном
  сторе. Тёмный mobile-first UI. Сборка через `vite build`.
- **`prompts/`** — промты-сид (`generate`, `baseline`, `classify`, `verify`). При первом запуске
  попадают в БД; дальше источник правды — БД (редактируются с фронта, версионируются).
- **`data/`** — файл БД SQLite (коммитится, удобно отдавать).

## API

| Метод | Путь | Назначение |
|------|------|-----------|
| `GET`  | `/api/health` | проверка живости |
| `GET`  | `/api/status` | доступна ли генерация (для блокировки чата) |
| `GET`  | `/api/chat/stream?q=` | SSE «ход мысли» → результат |
| `GET`  | `/api/articles` | список статей (для каталога) |
| `GET`  | `/api/articles/:slug` | статья: enriched + baseline + проверка + комментарии |
| `POST` | `/api/articles/generate` | `{query}` → поиск или генерация (двойной прогон) |
| `POST` | `/api/articles/:slug/comments` | `{author, body}` |
| `GET`  | `/api/conversations` | список чатов |
| `POST` | `/api/conversations` | новый чат |
| `GET`  | `/api/conversations/:id/messages` | сообщения чата |
| `GET`  | `/api/prompts` (`?kind=`) | версии промтов |
| `GET`  | `/api/prompts/:id` | конкретная версия |
| `POST` | `/api/prompts` | новая версия |
| `PATCH`| `/api/prompts/:id` | редактирование версии |
| `POST` | `/api/prompts/:id/activate` | сделать активной |
| `DELETE`| `/api/prompts/:id` | удалить версию (активную нельзя) |

## Конфигурация (env)

- `LLM_PROVIDER` — `anthropic` | `claude-cli`. По умолчанию авто: есть `ANTHROPIC_API_KEY` →
  `anthropic`, иначе `claude-cli`.
- `ANTHROPIC_API_KEY` — ключ для режима `anthropic` (**обязателен в Docker** для генерации).
- `LLM_MODEL` — модель (дефолт `claude-opus-4-8`).
- `LLM_CLI_CMD` — команда локального Claude CLI (дефолт `claude -p --output-format text`).
- `DB_FILE` — путь к SQLite (дефолт `data/aiwiki.sqlite`; в Docker `/app/data/aiwiki.sqlite`).

Ключи — только через `.env` (в `.gitignore`), не в коде.
