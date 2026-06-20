import { complete, MODEL } from "./llm";
import { getActive, getActiveBody, getGenerateTest } from "./prompts";

function extractTitle(markdown: string, fallback: string): string {
  const m = markdown.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

export type RubricType = "product" | "person" | "other";

// Рубрикатор: товар / живой человек / вне темы. При ошибке — other (безопасный отсев).
export async function rubricate(query: string): Promise<RubricType> {
  try {
    const out = (await complete({ system: await getActiveBody("classify"), user: query, maxTokens: 12 })).toLowerCase();
    // other в приоритете: развёрнутый отказ модели часто упоминает «product/person»,
    // делая вывод «other» — иначе подстрока ложно срабатывала бы на product/person.
    if (out.includes("other")) return "other";
    if (out.includes("product")) return "product";
    if (out.includes("person")) return "person";
    return "other";
  } catch {
    return "other";
  }
}

export interface Variants {
  title: string;
  raw: string; // голый запрос без промта
  soft: string; // мягкая ветка (активный промт)
  rigid: string | null; // жёсткая ветка (тест-версия), если есть
  softPromptId: number;
  softLabel: string;
  rigidLabel: string | null;
  model: string;
}

// RAW мимикрирует «голый» чат, но реальный пользователь не шлёт одно слово в пустоту —
// от голой темы ассистент переспрашивает («что вы хотите узнать?») вместо ответа.
// Поэтому тему оборачиваем в естественный вопрос; готовый вопрос оставляем целиком.
export function rawQuestion(query: string, type: RubricType): string {
  const q = query.trim();
  if (q.includes("?")) return q; // уже вопрос — передаём как есть
  if (type === "person") return `Кто такой "${q}"?`;
  if (type === "product") return `Что такое "${q}"?`;
  return `Расскажи про "${q}".`;
}

// Три варианта на один запрос: RAW + SOFT + RIGID.
export async function generateVariants(query: string, type: RubricType = "other"): Promise<Variants> {
  const soft = await getActive("generate");
  const test = await getGenerateTest();
  const [raw, softMd, rigidMd] = await Promise.all([
    complete({ system: "", user: rawQuestion(query, type) }), // RAW — голый запрос, но как естественный вопрос
    complete({ system: soft.body, user: query, maxTokens: 4096 }),
    test
      ? complete({ system: test.body, user: query, maxTokens: 4096 })
      : Promise.resolve<string | null>(null),
  ]);
  return {
    title: extractTitle(softMd, query),
    raw,
    soft: softMd,
    rigid: rigidMd,
    softPromptId: soft.id,
    softLabel: soft.label,
    rigidLabel: test?.label ?? null,
    model: MODEL,
  };
}
