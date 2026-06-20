import { Router, type Request, type Response, type NextFunction } from "express";
import { Article, Comment } from "../models";
import { findOrCreateArticle } from "../services/pipeline";

export const articles: Router = Router();

// Список статей (без тел — для каталога/дерева). Включает категорию.
articles.get("/", async (_req: Request, res: Response) => {
  const list = await Article.findAll({
    attributes: ["id", "slug", "query", "title", "category", "model", "createdAt"],
    order: [["createdAt", "DESC"]],
  });
  res.json(list);
});

// Одна статья по slug: обогащённый + baseline + проверка + комментарии.
articles.get("/:slug", async (req: Request, res: Response) => {
  const article = await Article.findOne({
    where: { slug: req.params.slug },
    include: [{ model: Comment, as: "comments" }],
    order: [[{ model: Comment, as: "comments" }, "createdAt", "ASC"]],
  });
  if (!article) return res.status(404).json({ error: "Статья не найдена" });
  res.json(article);
});

// Генерация без стриминга (для экрана «Сравнение»): поиск → если нет, двойной прогон.
articles.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query: string = (req.body?.query ?? "").trim();
    if (!query) return res.status(400).json({ error: "Поле query обязательно" });
    const { article, reused, rejected } = await findOrCreateArticle(query);
    if (rejected || !article) {
      return res.status(422).json({ error: "Вне темы портала (только товары и живые люди)", rejected: true });
    }
    res.status(reused ? 200 : 201).json({ article, reused });
  } catch (err) {
    next(err);
  }
});

// Добавить комментарий к статье.
articles.post("/:slug/comments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const article = await Article.findOne({ where: { slug: req.params.slug } });
    if (!article) return res.status(404).json({ error: "Статья не найдена" });

    const body: string = (req.body?.body ?? "").trim();
    if (!body) return res.status(400).json({ error: "Поле body обязательно" });
    const author: string = (req.body?.author ?? "").trim() || "Аноним";

    const comment = await Comment.create({ articleId: article.id, author, body });
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
});
