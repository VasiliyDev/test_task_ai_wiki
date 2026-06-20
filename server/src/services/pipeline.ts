import { Article } from "../models";
import { findExisting, normalize } from "../lib/search";
import { slugify } from "../lib/slug";
import { generateVariants, rubricate, type RubricType } from "./generator";
import { getActive } from "./prompts";
import { verifyTrio } from "./verify";
import { writeComparison, recordRejected } from "./comparison";

export type Stage = (key: string, message: string) => void;
const noop: Stage = () => {};

const GEN_MSGS = ["Пишу варианты статьи…", "Думаю и формулирую…"];
const VERIFY_MSGS = ["Сравниваю варианты, ищу галлюцinaции…", "Оцениваю и ранжирую…"];
const pick = (a: string[]): string => a[Math.floor(Math.random() * a.length)];

export interface PipelineResult {
  article: Article | null;
  reused: boolean;
  rejected?: boolean; // запрос вне темы (не товар/человек)
  type?: RubricType;
}

export async function findOrCreateArticle(query: string, onStage: Stage = noop): Promise<PipelineResult> {
  onStage("rubricate", "Определяю тип запроса…");
  const type = await rubricate(query);
  if (type === "other") {
    await recordRejected(query).catch(() => {});
    return { article: null, reused: false, rejected: true, type };
  }

  onStage("search", "Проверяю, не писали ли мы такое…");
  const activeSoft = await getActive("generate");
  const existing = await findExisting(query, activeSoft.id);
  if (existing) {
    onStage("found", "Нашёл готовую статью — открываю.");
    return { article: existing, reused: true, type };
  }

  onStage("generate", pick(GEN_MSGS));
  const v = await generateVariants(query, type);

  onStage("verify", pick(VERIFY_MSGS));
  const verification = await verifyTrio(query, v.raw, v.soft, v.rigid);

  onStage("save", "Сохраняю статью…");
  let slug = slugify(v.title || query);
  if (await Article.findOne({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;

  const article = await Article.create({
    slug,
    query,
    queryNorm: normalize(query),
    title: v.title,
    contentMarkdown: v.soft,
    rawMarkdown: v.raw,
    rigidMarkdown: v.rigid,
    verification,
    category: type === "product" ? "Товары" : "Люди",
    promptId: v.softPromptId,
    promptLabel: v.softLabel,
    rigidLabel: v.rigidLabel,
    model: v.model,
  });

  onStage("report", "Готовлю файл-сравнение…");
  try {
    await writeComparison(article);
  } catch {
    // не критично
  }

  return { article, reused: false, type };
}
