import { Router, type Request, type Response } from "express";
import { findOrCreateArticle } from "../services/pipeline";
import { generationStatus } from "../services/llm";
import { Conversation, Message } from "../models";
import { DEFAULT_TITLE } from "../models/conversation";

export const chat: Router = Router();

// Краткий ответ для чата = лид статьи (текст после H1 до первого подзаголовка).
// Полная статья остаётся на своей странице. Без лишнего вызова LLM.
function extractSummary(markdown: string): string {
  const noH1 = markdown.replace(/^#\s+.*$/m, "");
  const lead = noH1.split(/\n#{1,6}\s/)[0].trim();
  const text = lead || markdown.trim();
  return text.length > 700 ? `${text.slice(0, 700).trimEnd()}…` : text;
}

// SSE-стрим «хода мысли» в рамках конкретного чата. EventSource (GET) — надёжно в Safari.
// События: status {stage, message} → result {slug, title, reused} | error {error}.
// Сообщения (вопрос пользователя + финальный ответ бота) персистятся; «ход мысли» — нет.
chat.get("/stream", async (req: Request, res: Response) => {
  const query = String(req.query.q ?? "").trim();
  const conversationId = Number(req.query.conversationId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (!query) return void (send("error", { error: "Пустой запрос" }), res.end());
  if (!conversationId) return void (send("error", { error: "conversationId обязателен" }), res.end());
  if (!generationStatus().available) {
    return void (send("error", { error: "Генерация недоступна: нет ни API-ключа, ни локального Claude CLI." }), res.end());
  }

  const conv = await Conversation.findByPk(conversationId);
  if (!conv) return void (send("error", { error: "Чат не найден" }), res.end());

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  try {
    await Message.create({ conversationId, sender: "me", content: query });
    // Заголовок чата — из первого вопроса.
    if (conv.title === DEFAULT_TITLE) {
      conv.title = query.slice(0, 60);
      await conv.save();
    }

    const { article, reused, rejected } = await findOrCreateArticle(query, (stage, message) => {
      if (!closed) send("status", { stage, message });
    });

    // Рубрикатор отсеял запрос (не товар и не живой человек).
    if (rejected || !article) {
      const msg = "Портал про товары и живых людей — этот запрос вне темы, статью не делаю.";
      await Message.create({ conversationId, sender: "bot", content: msg });
      if (!closed) send("rejected", { message: msg, conversationId });
      return;
    }

    // В чат — краткий ответ (выжимка), полная статья — на странице по ссылке.
    const summary = extractSummary(article.contentMarkdown);
    await Message.create({ conversationId, sender: "bot", content: summary, articleSlug: article.slug });

    if (!closed) {
      send("result", { slug: article.slug, title: article.title, reused, summary, conversationId });
    }
  } catch (err) {
    if (!closed) send("error", { error: (err as Error).message });
  } finally {
    if (!closed) res.end();
  }
});
