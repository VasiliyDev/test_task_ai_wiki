import { writeFile, readdir, readFile } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { marked } from "marked";
import type { Article, Variant } from "../models/article";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../../../out");

// Папки по категориям: и в файлах (out/), и логически совпадают с разделами сайта.
const FOLDERS: Record<string, string> = { Люди: "люди", Товары: "товары" };
const folderFor = (cat: string | null): string => FOLDERS[cat ?? ""] ?? "прочее";
const CAT_ORDER: { name: string; folder: string }[] = [
  { name: "Люди", folder: "люди" },
  { name: "Товары", folder: "товары" },
  { name: "Прочее", folder: "прочее" },
];
const REJECTED_DIR = "остальное";

const VARIANT_LABEL: Record<Variant, string> = {
  soft: "SOFT — мягкий промт",
  rigid: "RIGID — жёсткий вики-отзовик",
  raw: "RAW — без промта",
};
const sideLabel = (s: string): string =>
  s === "soft" ? "SOFT" : s === "rigid" ? "RIGID" : s === "raw" ? "RAW" : "≈";

function variantBody(a: Article, v: Variant): string | null {
  if (v === "soft") return a.contentMarkdown;
  if (v === "raw") return a.rawMarkdown ?? null;
  return a.rigidMarkdown ?? null;
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const renderMd = (md: string): string => marked.parse(md, { async: false }) as string;
const fence = (md: string): string => "````markdown\n" + md.trim() + "\n````";

interface Block {
  heading: string;
  md: string;
}

function verdictMd(a: Article): string {
  const ver = a.verification;
  if (!ver) return "_Оценка не сохранена._";
  const rank = ver.ranking.map((v, i) => `${i + 1}. ${sideLabel(v)}`).join(" → ");
  const crit = ver.criteria
    ? "\n\n| Критерий | Лучший | Заметка |\n|---|---|---|\n" +
      Object.entries(ver.criteria)
        .map(([k, c]) => `| ${k} | ${sideLabel(c.best)} | ${c.note.replace(/\|/g, "/")} |`)
        .join("\n")
    : "";
  const halls = ver.hallucinations.length
    ? "\n\n**Галлюцинации:**\n" + ver.hallucinations.map((h) => `- [${sideLabel(h.side)}] ${h.claim}`).join("\n")
    : "";
  return `**Рейтинг:** ${rank}\n\n${ver.summary}${crit}${halls}`;
}

// Файл-сравнения в папке категории: MD (код-блоки) и самодостаточный HTML (кнопки копирования).
export async function writeComparison(a: Article): Promise<void> {
  const folder = folderFor(a.category);
  const dir = join(OUT, folder);
  mkdirSync(dir, { recursive: true });
  const ver = a.verification;

  const order: Variant[] = ([...(ver?.ranking ?? []), "soft", "raw", "rigid"] as Variant[]).filter(
    (v, i, arr) => arr.indexOf(v) === i && variantBody(a, v)
  );
  const blocks: Block[] = [
    { heading: "Вердикт оценщика", md: verdictMd(a) },
    ...order.map((v, i) => ({ heading: `${i + 1} место — ${VARIANT_LABEL[v]}`, md: variantBody(a, v) as string })),
  ];

  const metaLine =
    `**Запрос:** ${a.query}\n\n` +
    `**Категория:** ${a.category || "—"} · **Промты:** soft=${a.promptLabel || "—"}, ` +
    `rigid=${a.rigidLabel || "—"} · **Модель:** ${a.model || "—"}`;

  const md =
    `# ${a.title}\n\n${metaLine}\n\n[← ко всем сравнениям](../index.html)\n\n` +
    blocks.map((b) => `## ${b.heading}\n\n${fence(b.md)}\n`).join("\n");
  await writeFile(join(dir, `${a.slug}.md`), md, "utf8");

  const sections = blocks
    .map(
      (b) =>
        `<section>\n<div class="bar"><h2>${esc(b.heading)}</h2>` +
        `<button class="copy" onclick="cp(this)">Копировать markdown</button></div>\n` +
        `<pre class="src" hidden>${esc(b.md)}</pre>\n` +
        `<div class="rendered">${renderMd(b.md)}</div>\n</section>`
    )
    .join("\n");
  const body =
    `<h1>${esc(a.title)}</h1>\n<p class="meta">${renderMd(metaLine)}</p>\n` +
    `<p><a href="../index.html">← ко всем сравнениям</a></p>\n${sections}`;
  await writeFile(join(dir, `${a.slug}.html`), htmlPage(a.title, body), "utf8");

  await rebuildIndex();
}

// Запрос, отсеянный рубрикатором (вне темы) — попадает в раздел «Остальное».
export async function recordRejected(query: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  let list: string[] = [];
  try {
    list = JSON.parse(await readFile(join(OUT, "_rejected.json"), "utf8"));
  } catch {
    /* нет файла — ок */
  }
  if (!list.includes(query)) list.push(query);
  await writeFile(join(OUT, "_rejected.json"), JSON.stringify(list, null, 2), "utf8");
  await rebuildIndex();
}

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
  main { max-width: 820px; margin: 0 auto; padding: 24px 18px 80px; }
  a { color: #38bdf8; }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: .2em 0 .5em; }
  h2 { font-size: 1.3rem; margin: 0; }
  h3 { font-size: 1.1rem; margin: 1.2em 0 .4em; }
  p, li { color: #d4d4d8; }
  .meta { color: #a1a1aa; font-size: .95rem; }
  section { border: 1px solid #27272a; border-radius: 10px; padding: 4px 16px 16px; margin: 18px 0; background: #0c0c0f; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    position: sticky; top: 0; background: #0c0c0f; padding: 12px 0 8px; border-bottom: 1px solid #1f1f23; }
  .copy { cursor: pointer; border: 1px solid #3f3f46; background: #18181b; color: #e4e4e7;
    border-radius: 7px; padding: 6px 11px; font-size: .85rem; white-space: nowrap; }
  .copy:hover { background: #27272a; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .95rem; display: block; overflow-x: auto; }
  th, td { border: 1px solid #27272a; padding: 7px 10px; text-align: left; vertical-align: top; }
  th { background: #18181b; }
  code { background: #18181b; padding: .1em .35em; border-radius: 4px; font-size: .9em; }
  pre { background: #18181b; padding: 12px; border-radius: 8px; overflow-x: auto; }
  blockquote { border-left: 3px solid #3f3f46; margin: 1em 0; padding: .2em 1em; color: #a1a1aa; }
  strong { color: #f4f4f5; }
  ul.idx { line-height: 1.8; list-style: none; padding-left: 0; }
  ul.idx li { margin: 8px 0; }
  ul.idx .md { color: #71717a; font-size: .85em; margin-left: .5em; }
  ul.idx .q { color: #71717a; font-size: .82em; margin-top: 2px; }
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

interface IdxItem {
  slug: string;
  title: string;
  query: string;
}

async function readFolder(folder: string): Promise<IdxItem[]> {
  let files: string[];
  try {
    files = await readdir(join(OUT, folder));
  } catch {
    return [];
  }
  const slugs = files.filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")).sort();
  const items: IdxItem[] = [];
  for (const slug of slugs) {
    let md = "";
    try {
      md = await readFile(join(OUT, folder, `${slug}.md`), "utf8");
    } catch {
      continue;
    }
    items.push({
      slug,
      title: md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug,
      query: md.match(/\*\*Запрос:\*\*\s*(.+)/)?.[1]?.trim() ?? "",
    });
  }
  return items;
}

async function rebuildIndex(): Promise<void> {
  let rejected: string[] = [];
  try {
    rejected = JSON.parse(await readFile(join(OUT, "_rejected.json"), "utf8"));
  } catch {
    /* нет */
  }

  const intro =
    "Три варианта на каждый запрос (RAW без промта · SOFT мягкий · RIGID жёсткий вики-отзовик) + " +
    "слепой вердикт оценщика. Разложено по разделам; «Остальное» — запросы, которые рубрикатор " +
    "отсеял как вне темы. Каждый блок удобно копировать (в MD — код-блок, в HTML — кнопка).";

  const mdParts: string[] = ["# Сравнения: RAW vs SOFT vs RIGID", "", intro, ""];
  let html = `<h1>Сравнения: RAW vs SOFT vs RIGID</h1>\n<p class="meta">${esc(intro)}</p>\n`;

  for (const cat of CAT_ORDER) {
    const items = await readFolder(cat.folder);
    if (!items.length) continue;
    mdParts.push(`## ${cat.name}`, "");
    html += `<h2>${esc(cat.name)}</h2>\n<ul class="idx">\n`;
    for (const it of items) {
      mdParts.push(
        `- [${it.title}](./${cat.folder}/${it.slug}.html) · [md](./${cat.folder}/${it.slug}.md)` +
          (it.query ? ` — _запрос: «${it.query}»_` : "")
      );
      html +=
        `<li><a href="./${esc(cat.folder)}/${esc(it.slug)}.html">${esc(it.title)}</a> ` +
        `<a href="./${esc(cat.folder)}/${esc(it.slug)}.md" class="md">md</a>` +
        (it.query ? `<div class="q">запрос: «${esc(it.query)}»</div>` : "") +
        `</li>\n`;
    }
    mdParts.push("");
    html += `</ul>\n`;
  }

  if (rejected.length) {
    mdParts.push(`## Остальное (отсеяно рубрикатором как «вне темы»)`, "");
    html += `<h2>Остальное (отсеяно как «вне темы»)</h2>\n<ul class="idx">\n`;
    for (const q of rejected) {
      mdParts.push(`- «${q}» — рубрикатор вернул \`other\`, статья не создавалась`);
      html += `<li>«${esc(q)}» <span class="md">other → не создавалось</span></li>\n`;
    }
    mdParts.push("");
    html += `</ul>\n`;
  }

  mkdirSync(OUT, { recursive: true });
  await writeFile(join(OUT, "README.md"), mdParts.join("\n"), "utf8");
  await writeFile(join(OUT, "index.html"), htmlPage("Сравнения статей", html), "utf8");
}
