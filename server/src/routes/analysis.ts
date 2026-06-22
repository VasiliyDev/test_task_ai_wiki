import { Router, type Request, type Response, type NextFunction } from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Article } from "../models";
import { generationStatus } from "../services/llm";
import { runAnalysis } from "../services/analyze";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANALYSIS_MD = join(__dirname, "../../../out/_analysis.md");

export const analysis: Router = Router();

// Готовый отчёт рецензента (markdown). Источник — out/_analysis.md, который пишет
// финальный анализатор. Если его ещё не считали — 404 с подсказкой.
analysis.get("/", async (_req: Request, res: Response) => {
  try {
    const markdown = await readFile(ANALYSIS_MD, "utf8");
    res.json({ markdown });
  } catch {
    res.status(404).json({ error: "Рецензия ещё не построена — запустите пересчёт." });
  }
});

// Пересчитать рецензию по всем статьям (после правки промта analyze). Один вызов LLM.
analysis.post("/run", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!generationStatus().available) {
      return res.status(503).json({ error: "Генерация недоступна: нет ни API-ключа, ни локального Claude CLI." });
    }
    const articles = await Article.findAll({ order: [["id", "ASC"]] });
    const { fullMarkdown, stats } = await runAnalysis(articles);
    res.json({ markdown: fullMarkdown, evaluated: stats.evaluated, total: stats.total });
  } catch (err) {
    next(err);
  }
});
