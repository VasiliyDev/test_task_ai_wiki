import { complete } from "./llm";
import { getActiveBody } from "./prompts";
import type { Verification, Variant, Side, CriterionVerdict } from "../models/article";

const VARIANTS: Variant[] = ["raw", "soft", "rigid"];
const isVariant = (v: unknown): v is Variant => VARIANTS.includes(v as Variant);
const LETTERS = ["A", "B", "C"];

// Слепая оценка: варианты подаются анонимно (Вариант A/B/C) в случайном порядке,
// оценщик не знает, что есть что. Затем буквы разворачиваем обратно в raw/soft/rigid.
export async function verifyTrio(
  query: string,
  raw: string,
  soft: string,
  rigid: string | null
): Promise<Verification | null> {
  try {
    const present = (
      [
        ["raw", raw],
        ["soft", soft],
        ["rigid", rigid],
      ] as [Variant, string | null][]
    ).filter((p): p is [Variant, string] => Boolean(p[1]));

    // Перемешиваем, чтобы порядок не подсказывал источник.
    for (let i = present.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [present[i], present[j]] = [present[j], present[i]];
    }

    // Буква (как видит оценщик) → реальный вариант.
    const letterToVariant: Record<string, Variant> = {};
    present.forEach(([key], i) => (letterToVariant[LETTERS[i]] = key));

    const parts = [
      `Вопрос: ${query}`,
      ...present.map(([, text], i) => `=== Вариант ${LETTERS[i]} ===\n${text}`),
    ];
    const out = await complete({
      system: await getActiveBody("verify"),
      user: parts.join("\n\n"),
      maxTokens: 1200,
    });
    return parse(out, letterToVariant);
  } catch {
    return null;
  }
}

// Разворачивает букву (A/B/C) или "similar" в реальный вариант.
function deanon(v: unknown, map: Record<string, Variant>): Side | undefined {
  if (v === "similar") return "similar";
  const key = String(v ?? "").trim().toUpperCase();
  return map[key];
}

// В свободном тексте (summary, заметки) меняем буквы вариантов на RAW/SOFT/RIGID.
const remap = (s: string, map: Record<string, Variant>): string =>
  s.replace(/\b([ABC])\b/g, (m, L: string) => (map[L] ? map[L].toUpperCase() : m));

function parse(raw: string, map: Record<string, Variant>): Verification | null {
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

    const ranking = Array.isArray(obj.ranking)
      ? (obj.ranking as unknown[]).map((v) => deanon(v, map)).filter(isVariant)
      : [];
    if (!ranking.length) return null;

    const criteria: Record<string, CriterionVerdict> = {};
    if (obj.criteria && typeof obj.criteria === "object") {
      for (const [k, v] of Object.entries(obj.criteria as Record<string, unknown>)) {
        const c = v as { best?: unknown; note?: unknown };
        const best = deanon(c?.best, map);
        if (best) criteria[k] = { best, note: remap(String(c?.note ?? ""), map) };
      }
    }

    const hallucinations = Array.isArray(obj.hallucinations)
      ? (obj.hallucinations as { side?: unknown; claim?: unknown }[])
          .filter((h) => h && typeof h.claim === "string")
          .map((h) => ({ side: deanon(h.side, map) ?? "?", claim: String(h.claim) }))
      : [];

    return {
      ranking,
      criteria: Object.keys(criteria).length ? criteria : undefined,
      hallucinations,
      summary: typeof obj.summary === "string" ? remap(obj.summary, map) : "",
    };
  } catch {
    return null;
  }
}
