import { Router, type Request, type Response, type NextFunction } from "express";
import type { PromptKind, PromptStatus } from "../models/prompt";
import {
  listPrompts,
  getPrompt,
  createVersion,
  updatePrompt,
  setStatus,
  deletePrompt,
  KINDS,
} from "../services/prompts";

export const prompts: Router = Router();

const STATUSES: PromptStatus[] = ["active", "test", "inactive"];
const asKind = (v: unknown): PromptKind | undefined =>
  KINDS.includes(v as PromptKind) ? (v as PromptKind) : undefined;
const asStatus = (v: unknown): PromptStatus | undefined =>
  STATUSES.includes(v as PromptStatus) ? (v as PromptStatus) : undefined;

// Список версий (опц. ?kind=).
prompts.get("/", async (req: Request, res: Response) => {
  res.json(await listPrompts(asKind(req.query.kind)));
});

// Конкретная версия.
prompts.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getPrompt(Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

// Новая версия (по умолчанию неактивная). status: active | test | inactive.
prompts.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kind = asKind(req.body?.kind);
    const body: string = req.body?.body ?? "";
    if (!kind || !body.trim()) return res.status(400).json({ error: "kind и body обязательны" });
    const label: string = (req.body?.label ?? "").trim() || `v${Date.now().toString(36)}`;
    const status = asStatus(req.body?.status) ?? "inactive";
    res.status(201).json(await createVersion(kind, body, label, status));
  } catch (err) {
    next(err);
  }
});

// Редактирование версии (тело и/или метка).
prompts.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updatePrompt(Number(req.params.id), { body: req.body?.body, label: req.body?.label }));
  } catch (err) {
    next(err);
  }
});

// Сменить статус: active (боевая, одна на вид) | test (тест-прогонная) | inactive.
prompts.post("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = asStatus(req.body?.status);
    if (!status) return res.status(400).json({ error: "status: active | test | inactive" });
    res.json(await setStatus(Number(req.params.id), status));
  } catch (err) {
    next(err);
  }
});

// Удалить версию (активную нельзя).
prompts.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deletePrompt(Number(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
