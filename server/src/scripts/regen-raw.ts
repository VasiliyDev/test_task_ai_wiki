// Точечная пересборка RAW для уже сгенерированных статей.
//
// Зачем: раньше RAW получал голую тему ("Cristiano Ronaldo") и локальный ассистент
// переспрашивал вместо ответа. Теперь тема оборачивается в естественный вопрос
// (rawQuestion). Этот скрипт перегенерирует ТОЛЬКО RAW по новой формулировке,
// заново прогоняет слепого критика (рейтинг меняется — RAW теперь настоящая статья),
// сохраняет в БД и переписывает файлы-сравнения в out/.
//
// SOFT и RIGID не трогаются — берутся из БД как есть.
//
// Запуск:  cd server && LLM_PROVIDER=claude-cli npx tsx src/scripts/regen-raw.ts

import { Article, connectWithRetry, sequelize } from "../models";
import { complete } from "../services/llm";
import { rawQuestion, type RubricType } from "../services/generator";
import { verifyTrio } from "../services/verify";
import { writeComparison } from "../services/comparison";

const typeOf = (category: string | null): RubricType =>
  category === "Товары" ? "product" : "person";

async function main(): Promise<void> {
  await connectWithRetry();
  const articles = await Article.findAll({ order: [["id", "ASC"]] });
  console.log(`Статей к пересборке RAW: ${articles.length}\n`);

  for (const a of articles) {
    const type = typeOf(a.category);
    const q = rawQuestion(a.query, type);
    process.stdout.write(`• [${a.category}] «${a.query}» → RAW-запрос: ${q}\n`);

    const raw = await complete({ system: "", user: q });
    const verification = await verifyTrio(a.query, raw, a.contentMarkdown, a.rigidMarkdown);

    a.rawMarkdown = raw;
    a.verification = verification;
    await a.save();
    await writeComparison(a);

    const rank = verification?.ranking?.map((v) => v.toUpperCase()).join(" → ") ?? "—";
    console.log(`  ✓ RAW обновлён, новый рейтинг: ${rank}\n`);
  }

  await sequelize.close();
  console.log("Готово.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
