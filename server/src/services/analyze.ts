import { writeFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { marked } from "marked";
import { Article } from "../models";
import type { Variant } from "../models/article";
import { complete, MODEL } from "./llm";
import { getActiveBody } from "./prompts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../../../out");

const VARIANTS: Variant[] = ["raw", "soft", "rigid"];
const VLABEL: Record<Variant, string> = { raw: "RAW", soft: "SOFT", rigid: "RIGID" };
// Порядок и человекочитаемые подписи критериев слепого критика.
const CRITERIA: { key: string; label: string }[] = [
  { key: "accuracy", label: "Достоверность" },
  { key: "humanFriendliness", label: "Человечность" },
  { key: "googleRisk", label: "Риск санкций поиска" },
  { key: "addedValue", label: "Добавочная ценность" },
  { key: "citability", label: "Цитируемость" },
  { key: "usefulness", label: "Полезность" },
  { key: "trust", label: "Доверие (E-E-A-T)" },
];
const sideLabel = (s: string): string =>
  s === "soft" ? "SOFT" : s === "rigid" ? "RIGID" : s === "raw" ? "RAW" : s === "similar" ? "вровень" : "—";

type VCount = Record<Variant, number>;
const zero = (): VCount => ({ raw: 0, soft: 0, rigid: 0 });

export interface AnalysisStats {
  total: number; // всего статей
  evaluated: number; // из них с сохранённой оценкой критика
  firstPlace: VCount; // сколько раз вариант был 1-м
  points: VCount; // очки: 1-е=3, 2-е=2, 3-е=1
  avgPlace: Record<Variant, number | null>; // среднее место (1 — лучшее)
  criteria: Record<string, Record<string, number>>; // критерий → {raw,soft,rigid,similar} победы
  byCategory: Record<string, VCount>; // категория → 1-е места по вариантам
  hallucinations: VCount; // помеченные галлюцинации по вариантам
}

interface QueryDigest {
  query: string;
  category: string;
  ranking: string[]; // RAW/SOFT/RIGID лучший→худший
  criteriaWinners: Record<string, string>; // критерий → победитель
  summary: string;
}

// Собирает детерминированную статистику и поразборный дайджест по всем статьям с оценкой.
export function aggregate(articles: Article[]): { stats: AnalysisStats; digest: QueryDigest[] } {
  const stats: AnalysisStats = {
    total: articles.length,
    evaluated: 0,
    firstPlace: zero(),
    points: zero(),
    avgPlace: { raw: null, soft: null, rigid: null },
    criteria: Object.fromEntries(CRITERIA.map((c) => [c.key, { raw: 0, soft: 0, rigid: 0, similar: 0 }])),
    byCategory: {},
    hallucinations: zero(),
  };
  const placeSum = zero();
  const placeCnt = zero();
  const digest: QueryDigest[] = [];

  for (const a of articles) {
    const ver = a.verification;
    if (!ver?.ranking?.length) continue;
    stats.evaluated++;
    const cat = a.category || "Прочее";
    stats.byCategory[cat] ??= zero();

    ver.ranking.forEach((v, i) => {
      if (!VARIANTS.includes(v)) return;
      placeSum[v] += i + 1;
      placeCnt[v] += 1;
      stats.points[v] += Math.max(0, ver.ranking.length - i); // 3/2/1 при трёх вариантах
      if (i === 0) {
        stats.firstPlace[v] += 1;
        stats.byCategory[cat][v] += 1;
      }
    });

    const criteriaWinners: Record<string, string> = {};
    for (const c of CRITERIA) {
      const best = ver.criteria?.[c.key]?.best;
      if (!best) continue;
      if (best in stats.criteria[c.key]) stats.criteria[c.key][best] += 1;
      criteriaWinners[c.label] = sideLabel(best);
    }

    for (const h of ver.hallucinations ?? []) {
      if (VARIANTS.includes(h.side as Variant)) stats.hallucinations[h.side as Variant] += 1;
    }

    digest.push({
      query: a.query,
      category: cat,
      ranking: ver.ranking.map((v) => VLABEL[v] ?? v),
      criteriaWinners,
      summary: (ver.summary || "").trim(),
    });
  }

  for (const v of VARIANTS) {
    stats.avgPlace[v] = placeCnt[v] ? Math.round((placeSum[v] / placeCnt[v]) * 100) / 100 : null;
  }
  return { stats, digest };
}

// Детерминированный блок-приложение с таблицами (источник истины по цифрам).
function statsMarkdown(s: AnalysisStats): string {
  const rank = [...VARIANTS].sort((a, b) => s.points[b] - s.points[a]);
  const ratingRows = rank
    .map(
      (v) =>
        `| ${VLABEL[v]} | ${s.firstPlace[v]} | ${s.points[v]} | ${s.avgPlace[v] ?? "—"} |`
    )
    .join("\n");

  const critRows = CRITERIA.map((c) => {
    const row = s.criteria[c.key];
    const leader = (["raw", "soft", "rigid"] as Variant[]).reduce((a, b) => (row[b] > row[a] ? b : a), "raw");
    const lead = row[leader] === 0 ? "—" : VLABEL[leader];
    return `| ${c.label} | RAW ${row.raw} · SOFT ${row.soft} · RIGID ${row.rigid} · вровень ${row.similar} | ${lead} |`;
  }).join("\n");

  const catRows = Object.entries(s.byCategory)
    .map(([cat, c]) => `| ${cat} | ${c.raw} | ${c.soft} | ${c.rigid} |`)
    .join("\n");

  return [
    `## Статистика побед (детерминированно)`,
    ``,
    `_Посчитано по ${s.evaluated} из ${s.total} статей напрямую из вердиктов критика — источник истины по цифрам._`,
    ``,
    `### Итоговый рейтинг`,
    ``,
    `| Промт | 1-е места | Очки (3/2/1) | Среднее место |`,
    `|---|---|---|---|`,
    ratingRows,
    ``,
    `### Победы по критериям`,
    ``,
    `| Критерий | Счёт (RAW · SOFT · RIGID · вровень) | Лидер |`,
    `|---|---|---|`,
    critRows,
    ``,
    `### Первые места по категориям`,
    ``,
    `| Категория | RAW | SOFT | RIGID |`,
    `|---|---|---|---|`,
    catRows,
    ``,
    `### Помеченные галлюцинации`,
    ``,
    `RAW — ${s.hallucinations.raw} · SOFT — ${s.hallucinations.soft} · RIGID — ${s.hallucinations.rigid}`,
    ``,
  ].join("\n");
}

// Компактный дайджест для модели: цифры + поразборный список (критик уже всё оценил).
function buildUserPayload(stats: AnalysisStats, digest: QueryDigest[]): string {
  const lines = digest.map((d) => {
    const crit = Object.entries(d.criteriaWinners)
      .map(([k, v]) => `${k}:${v}`)
      .join(", ");
    return `- «${d.query}» [${d.category}] — рейтинг: ${d.ranking.join(" → ")}. Критерии: ${crit}. Вердикт: ${d.summary}`;
  });
  return [
    `СТАТИСТИКА (детерминированная, источник истины по числам):`,
    JSON.stringify(stats, null, 2),
    ``,
    `ПОРАЗБОРНО ПО ${digest.length} ЗАПРОСАМ:`,
    ...lines,
  ].join("\n");
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function htmlPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #09090b; color: #e4e4e7;
    font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 860px; margin: 0 auto; padding: 24px 18px 80px; }
  a { color: #38bdf8; }
  h1 { font-size: 1.8rem; line-height: 1.25; margin: .2em 0 .5em; }
  h2 { font-size: 1.35rem; margin: 1.4em 0 .4em; }
  h3 { font-size: 1.1rem; margin: 1.1em 0 .4em; }
  p, li { color: #d4d4d8; }
  .meta { color: #a1a1aa; font-size: .95rem; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .95rem; display: block; overflow-x: auto; }
  th, td { border: 1px solid #27272a; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: #18181b; }
  code { background: #18181b; padding: .1em .35em; border-radius: 4px; font-size: .9em; }
  pre { background: #18181b; padding: 12px; border-radius: 8px; overflow-x: auto; }
  blockquote { border-left: 3px solid #3f3f46; margin: 1em 0; padding: .2em 1em; color: #a1a1aa; }
  strong { color: #f4f4f5; }
</style>
</head>
<body><main>
${bodyHtml}
</main></body>
</html>`;
}

export interface AnalysisResult {
  stats: AnalysisStats;
  reportMarkdown: string; // только AI-часть
  fullMarkdown: string; // AI-часть + детерминированное приложение
}

// Прогоняет рецензента по всем статьям и пишет out/_analysis.md + out/analysis.html.
export async function runAnalysis(articles: Article[]): Promise<AnalysisResult> {
  const { stats, digest } = aggregate(articles);
  if (!stats.evaluated) throw new Error("Нет статей с оценкой критика — нечего анализировать.");

  const system = await getActiveBody("analyze");
  const report = await complete({
    system,
    user: buildUserPayload(stats, digest),
    maxTokens: 4096,
  });

  const intro =
    `> Финальный разбор всего прогона: рецензент-ИИ собрал слепые вердикты критика по ${stats.evaluated} ` +
    `запросам и сделал вывод, какой промт где выигрывает. Модель: ${MODEL}. ` +
    `[← ко всем сравнениям](./index.html) · [промты](./prompts/index.html)\n`;

  const fullMarkdown = `${intro}\n${report.trim()}\n\n---\n\n${statsMarkdown(stats)}`;

  mkdirSync(OUT, { recursive: true });
  await writeFile(join(OUT, "_analysis.md"), fullMarkdown, "utf8");
  const bodyHtml =
    `<p class="meta"><a href="./index.html">← ко всем сравнениям</a> · ` +
    `<a href="./prompts/index.html">промты</a></p>\n` +
    (marked.parse(`${report.trim()}\n\n---\n\n${statsMarkdown(stats)}`, { async: false }) as string);
  await writeFile(join(OUT, "analysis.html"), htmlPage("Финальный разбор: RAW vs SOFT vs RIGID", bodyHtml), "utf8");

  return { stats, reportMarkdown: report.trim(), fullMarkdown };
}
