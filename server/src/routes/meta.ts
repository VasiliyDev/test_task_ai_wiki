import { Router, type Request, type Response } from "express";
import { generationStatus } from "../services/llm";

export const meta: Router = Router();

// Доступна ли генерация (для блокировки чатика на фронте).
meta.get("/status", (_req: Request, res: Response) => {
  res.json({ generation: generationStatus() });
});
