#!/usr/bin/env node
// Сборщик демо-репозитория для GitHub Pages.
//
// Источник истины — out/ (сравнения, которые накапливает тул по мере генерации статей)
// и prompts/ (промты пайплайна). Скрипт собирает из них чистый статический сайт в
// сабмодуль ./site и (по флагу) пушит его — GitHub Pages публикует автоматически.
//
// Использование:
//   node scripts/build-demo.mjs           # собрать в ./site
//   node scripts/build-demo.mjs --push    # собрать + закоммитить и запушить сабмодуль (→ Pages)
//
// Накопление: страницы не теряются между запусками — out/ растёт, а site/ каждый раз
// пересобирается из него целиком, поэтому новые статьи просто добавляются на сайт.

import { existsSync, readdirSync, readFileSync, writeFileSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const PROMPTS = join(ROOT, "prompts");
const SITE = join(ROOT, "site");

const PUSH = process.argv.includes("--push");
const GIT_NAME = "Vasiliy";
const GIT_EMAIL = "boosting007@gmail.com";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Проверки ────────────────────────────────────────────────────────────────
if (!existsSync(join(SITE, ".git"))) {
  console.error(
    "✗ Сабмодуль site/ не инициализирован.\n" +
      "  git submodule add https://github.com/VasiliyDev/test_task_ai_wiki_demo.git site\n" +
      "  git submodule update --init"
  );
  process.exit(1);
}
if (!existsSync(OUT)) {
  console.error("✗ Нет out/ — сначала сгенерируй сравнения тулом.");
  process.exit(1);
}

// ── 1. Чистим site/, сохраняя только .git ────────────────────────────────────
for (const entry of readdirSync(SITE)) {
  if (entry === ".git") continue;
  rmSync(join(SITE, entry), { recursive: true, force: true });
}

// ── 2. Копируем out/ в корень site/ (index.html окажется в корне → удобно Pages)
cpSync(OUT, SITE, { recursive: true });

// ── 3. Страница с промтами пайплайна ─────────────────────────────────────────
const PROMPT_TITLES = {
  "classify.md": "Классификатор (рубрикатор: люди / товары / вне темы)",
  "baseline.md": "RAW — без промта (baseline)",
  "generate.md": "SOFT — мягкий промт генерации",
  "generate-rigid.md": "RIGID — жёсткий вики-отзовик",
  "verify.md": "Критик — слепая оценка вариантов",
  "analyze.md": "Рецензент — финальный разбор всего прогона",
};
const PROMPT_ORDER = ["classify.md", "baseline.md", "generate.md", "generate-rigid.md", "verify.md", "analyze.md"];

function buildPromptsPage() {
  if (!existsSync(PROMPTS)) return;
  const dst = join(SITE, "prompts");
  mkdirSync(dst, { recursive: true });
  cpSync(PROMPTS, dst, { recursive: true }); // сырые .md тоже кладём рядом

  const files = readdirSync(PROMPTS).filter((f) => f.endsWith(".md"));
  const ordered = [...PROMPT_ORDER.filter((f) => files.includes(f)), ...files.filter((f) => !PROMPT_ORDER.includes(f))];

  const sections = ordered
    .map((f) => {
      const body = readFileSync(join(PROMPTS, f), "utf8");
      const title = PROMPT_TITLES[f] ?? f;
      return (
        `<section>\n<div class="bar"><h2>${esc(title)}</h2>` +
        `<button class="copy" onclick="cp(this)">Копировать</button></div>\n` +
        `<pre class="src">${esc(body)}</pre>\n` +
        `<p class="meta"><a href="./${esc(f)}">${esc(f)}</a></p>\n</section>`
      );
    })
    .join("\n");

  const body =
    `<h1>Промты пайплайна</h1>\n` +
    `<p class="meta">Цепочка: классификатор → генерация в трёх вариантах (RAW / SOFT / RIGID) → слепой критик → рецензент (финальный разбор). ` +
    `<a href="../index.html">← к сравнениям</a></p>\n${sections}`;
  writeFileSync(join(dst, "index.html"), htmlPage("Промты пайплайна", body), "utf8");
}

// ── 4. Навигация на главной (ссылка на промты) ───────────────────────────────
function injectNav() {
  const idx = join(SITE, "index.html");
  if (!existsSync(idx)) return;
  let html = readFileSync(idx, "utf8");
  const hasAnalysis = existsSync(join(SITE, "analysis.html"));
  const analysisLink = hasAnalysis ? `<a href="./analysis.html">📊 Финальный разбор</a> · ` : "";
  const nav =
    `<body><main>\n<p class="meta">${analysisLink}<a href="./prompts/index.html">↳ Промты пайплайна</a> · ` +
    `<a href="https://github.com/VasiliyDev/test_task_ai_wiki">исходный контур (тул)</a></p>\n`;
  html = html.replace("<body><main>\n", nav);
  writeFileSync(idx, html, "utf8");
}

// ── 5. README демо-репо (витрина + вывод) + .nojekyll ────────────────────────
function writeMeta() {
  writeFileSync(join(SITE, ".nojekyll"), "", "utf8"); // не гонять Jekyll (кириллические папки)
  writeFileSync(join(SITE, "README.md"), README, "utf8");
}

// ── HTML-шаблон (тот же тёмный стиль, что в out/) ────────────────────────────
function htmlPage(title, bodyHtml) {
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
  main { max-width: 820px; margin: 0 auto; padding: 24px 18px 80px; }
  a { color: #38bdf8; }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: .2em 0 .5em; }
  h2 { font-size: 1.3rem; margin: 0; }
  .meta { color: #a1a1aa; font-size: .95rem; }
  section { border: 1px solid #27272a; border-radius: 10px; padding: 4px 16px 16px; margin: 18px 0; background: #0c0c0f; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    position: sticky; top: 0; background: #0c0c0f; padding: 12px 0 8px; border-bottom: 1px solid #1f1f23; }
  .copy { cursor: pointer; border: 1px solid #3f3f46; background: #18181b; color: #e4e4e7;
    border-radius: 7px; padding: 6px 11px; font-size: .85rem; white-space: nowrap; }
  .copy:hover { background: #27272a; }
  pre { background: #18181b; padding: 12px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; }
  strong { color: #f4f4f5; }
</style>
</head>
<body><main>
${bodyHtml}
</main>
<script>
function cp(b){
  var pre=b.closest('section').querySelector('.src');
  var ta=document.createElement('textarea'); ta.value=pre.textContent;
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
  var o=b.textContent; b.textContent='Скопировано ✓';
  setTimeout(function(){ b.textContent=o; }, 1500);
}
</script>
</body>
</html>`;
}

const README = `# AI-вики — демонстрация (RAW vs SOFT vs RIGID)

Чистая витрина результатов: по каждому запросу — три варианта статьи и слепой вердикт
критика. Собирается скриптом \`scripts/build-demo.mjs\` из рабочего контура
([test_task_ai_wiki](https://github.com/VasiliyDev/test_task_ai_wiki)); этот репозиторий —
только результат, без кода.

**Живой сайт:** открой \`index.html\` (GitHub Pages).

## Что сравнивается
- **RAW** — голый запрос в модель без промта (baseline).
- **SOFT** — мягкий промт: структура подбирается под тему.
- **RIGID** — жёсткий вики-отзовик с фиксированной структурой, таблицами, FAQ.
- **Критик** — отдельный агент вслепую ранжирует три варианта по 7 критериям.
- **Рецензент** — финальный агент: собирает вердикты критика по всем запросам и
  делает общий вывод (какой промт где выигрывает) с таблицами побед.

## Вывод
Сводный AI-разбор всего прогона (рейтинг промтов, победы по 7 критериям, разбивка по
категориям «Люди / Товары», рекомендации какую ветку когда применять) — на странице
**\`analysis.html\`** (ссылка «📊 Финальный разбор» на главной). Рядом с AI-выводом —
детерминированная статистика побед, посчитанная напрямую из вердиктов критика.

Подробные вердикты по критериям — внутри каждой статьи.
`;

// ── Прогон ───────────────────────────────────────────────────────────────────
buildPromptsPage();
injectNav();
writeMeta();
console.log("✓ Демо собрано в site/");

if (PUSH) {
  const git = (...args) => execFileSync("git", ["-C", SITE, ...args], { stdio: "inherit" });
  execFileSync("git", ["-C", SITE, "add", "-A"]);
  const changed = execFileSync("git", ["-C", SITE, "status", "--porcelain"]).toString().trim();
  if (!changed) {
    console.log("• Изменений нет — пушить нечего.");
  } else {
    git("-c", `user.name=${GIT_NAME}`, "-c", `user.email=${GIT_EMAIL}`, "commit", "-m", "Пересборка демо из out/ + prompts/");
    git("push", "origin", "HEAD:main");
    console.log("✓ Запушено в демо-репо — GitHub Pages обновит сайт.");
  }
}
