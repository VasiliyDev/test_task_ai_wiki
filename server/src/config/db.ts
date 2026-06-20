import { Sequelize } from "sequelize";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Файловая БД (SQLite) — один файл, удобно держать в репозитории и отдавать.
// Путь переопределяется через DB_FILE; по умолчанию — <repo>/data/aiwiki.sqlite.
const DEFAULT_DB = join(__dirname, "../../../data/aiwiki.sqlite");
const storage = process.env.DB_FILE
  ? isAbsolute(process.env.DB_FILE)
    ? process.env.DB_FILE
    : join(process.cwd(), process.env.DB_FILE)
  : DEFAULT_DB;

mkdirSync(dirname(storage), { recursive: true });

export const sequelize: Sequelize = new Sequelize({
  dialect: "sqlite",
  storage,
  logging: false,
});

// Оставлено для совместимости с index.ts. Для файловой БД ретраи не нужны —
// просто проверяем, что файл открывается.
export async function connectWithRetry(): Promise<void> {
  await sequelize.authenticate();
}
