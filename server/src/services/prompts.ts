import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Prompt, type PromptKind, type PromptStatus } from "../models/prompt";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "../../../prompts");

// Сид: две ветки generate (soft=active, rigid=test) + рубрикатор + оценщик.
const SEED: { kind: PromptKind; file: string; label: string; status: PromptStatus }[] = [
  { kind: "generate", file: "generate.md", label: "soft", status: "active" },
  { kind: "generate", file: "generate-rigid.md", label: "rigid", status: "test" },
  { kind: "classify", file: "classify.md", label: "v1", status: "active" },
  { kind: "verify", file: "verify.md", label: "v1", status: "active" },
];
export const KINDS: PromptKind[] = ["generate", "classify", "verify"];

export async function seedPrompts(): Promise<void> {
  for (const s of SEED) {
    if (await Prompt.findOne({ where: { kind: s.kind, label: s.label } })) continue;
    let body = "";
    try {
      body = await readFile(join(PROMPTS_DIR, s.file), "utf8");
    } catch {
      body = "";
    }
    await Prompt.create({ kind: s.kind, label: s.label, status: s.status, body });
  }
}

export async function getActive(kind: PromptKind): Promise<Prompt> {
  const p = await Prompt.findOne({ where: { kind, status: "active" }, order: [["createdAt", "DESC"]] });
  if (!p) throw new Error(`Нет активной версии промта «${kind}»`);
  return p;
}
export async function getActiveBody(kind: PromptKind): Promise<string> {
  return (await getActive(kind)).body;
}

// Тест-прогонная версия generate (rigid-ветка для 3-way сравнения). Может отсутствовать.
export async function getGenerateTest(): Promise<Prompt | null> {
  return Prompt.findOne({ where: { kind: "generate", status: "test" }, order: [["createdAt", "DESC"]] });
}

export async function getPrompt(id: number): Promise<Prompt> {
  const p = await Prompt.findByPk(id);
  if (!p) throw new Error("Промт не найден");
  return p;
}

export async function listPrompts(kind?: PromptKind): Promise<Prompt[]> {
  return Prompt.findAll({
    where: kind ? { kind } : {},
    order: [
      ["kind", "ASC"],
      ["createdAt", "DESC"],
    ],
  });
}

export async function createVersion(
  kind: PromptKind,
  body: string,
  label: string,
  status: PromptStatus = "inactive"
): Promise<Prompt> {
  const p = await Prompt.create({ kind, label, body, status: "inactive" });
  if (status !== "inactive") await setStatus(p.id, status);
  await p.reload();
  return p;
}

export async function updatePrompt(id: number, patch: { body?: string; label?: string }): Promise<Prompt> {
  const p = await Prompt.findByPk(id);
  if (!p) throw new Error("Промт не найден");
  if (typeof patch.body === "string") p.body = patch.body;
  if (typeof patch.label === "string" && patch.label.trim()) p.label = patch.label.trim();
  await p.save();
  return p;
}

// active — одна на вид; test/inactive — сколько угодно.
export async function setStatus(id: number, status: PromptStatus): Promise<Prompt> {
  const p = await Prompt.findByPk(id);
  if (!p) throw new Error("Промт не найден");
  if (status === "active") {
    await Prompt.update({ status: "inactive" }, { where: { kind: p.kind, status: "active" } });
  }
  p.status = status;
  await p.save();
  return p;
}

export async function deletePrompt(id: number): Promise<void> {
  const p = await Prompt.findByPk(id);
  if (!p) throw new Error("Промт не найден");
  if (p.status === "active") throw new Error("Нельзя удалить активную версию — сначала назначьте другую активной");
  await p.destroy();
}
