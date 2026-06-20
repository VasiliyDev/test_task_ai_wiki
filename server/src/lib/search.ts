import { Op, type WhereOptions, type InferAttributes } from "sequelize";
import { Article } from "../models";

// Детерминированный поиск существующей статьи — без LLM, чтобы не жечь токены.

export function normalize(q: string): string {
  return q
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywords(q: string): string[] {
  return normalize(q)
    .split(" ")
    .filter((w) => w.length >= 4);
}

// Если задан promptId — ищем только статью, сделанную этой версией промта
// (так на другую версию промта генерится отдельная версия статьи).
export async function findExisting(query: string, promptId?: number): Promise<Article | null> {
  const norm = normalize(query);
  const base: WhereOptions<InferAttributes<Article>> = promptId ? { promptId } : {};

  if (norm) {
    const exact = await Article.findOne({ where: { ...base, queryNorm: norm } });
    if (exact) return exact;
  }

  const kws = keywords(query);
  if (!kws.length) return null;

  const candidates = await Article.findAll({
    where: { ...base, [Op.or]: kws.map((k) => ({ queryNorm: { [Op.like]: `%${k}%` } })) },
    limit: 50,
  });

  let best: Article | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const cset = new Set(keywords(c.query));
    const overlap = kws.filter((k) => cset.has(k)).length;
    const score = overlap / Math.max(kws.length, cset.size || 1);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 0.6 ? best : null;
}
