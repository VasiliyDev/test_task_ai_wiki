import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import { sequelize, connectWithRetry } from "./models";
import { seedPrompts } from "./services/prompts";
import { articles } from "./routes/articles";
import { chat } from "./routes/chat";
import { conversations } from "./routes/conversations";
import { prompts } from "./routes/prompts";
import { meta } from "./routes/meta";
import { analysis } from "./routes/analysis";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));
app.use("/api", meta); // /api/status
app.use("/api/articles", articles);
app.use("/api/conversations", conversations);
app.use("/api/prompts", prompts);
app.use("/api/chat", chat);
app.use("/api/analysis", analysis);

// Единый обработчик ошибок.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Внутренняя ошибка" });
});

async function start(): Promise<void> {
  await connectWithRetry();
  // Для теста гипотезы sync() достаточно; миграции заведём, когда схема устаканится.
  await sequelize.sync();
  await seedPrompts(); // наполняем промты из файлов при первом запуске
  app.listen(PORT, () => console.log(`API на http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Не удалось запустить сервер:", err);
  process.exit(1);
});
