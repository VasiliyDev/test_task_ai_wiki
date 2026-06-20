import { Router, type Request, type Response } from "express";
import { Conversation, Message } from "../models";

export const conversations: Router = Router();

// Список чатов (свежие сверху).
conversations.get("/", async (_req: Request, res: Response) => {
  const list = await Conversation.findAll({
    attributes: ["id", "title", "updatedAt"],
    order: [["updatedAt", "DESC"]],
  });
  res.json(list);
});

// Создать новый чат.
conversations.post("/", async (_req: Request, res: Response) => {
  const c = await Conversation.create({});
  res.status(201).json(c);
});

// Сообщения чата (по возрастанию времени).
conversations.get("/:id/messages", async (req: Request, res: Response) => {
  const msgs = await Message.findAll({
    where: { conversationId: Number(req.params.id) },
    order: [["createdAt", "ASC"]],
  });
  res.json(msgs);
});

// Удалить чат вместе с сообщениями.
conversations.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await Message.destroy({ where: { conversationId: id } });
  await Conversation.destroy({ where: { id } });
  res.status(204).end();
});
