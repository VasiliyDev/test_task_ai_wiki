import Anthropic from "@anthropic-ai/sdk";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

// Движок генерации с двумя режимами за единым интерфейсом complete():
//  - "anthropic"  — по API-ключу (ANTHROPIC_API_KEY), модель Opus 4.8 и т.п.;
//  - "claude-cli" — локально запущенный Claude (headless `claude -p`) — «крутящийся» агент,
//                   удобно тестировать без покупки API-плана.
// Авто-выбор: есть ключ → anthropic, иначе → claude-cli. Можно зафиксировать LLM_PROVIDER.
type Provider = "anthropic" | "claude-cli";

function resolveProvider(): Provider {
  const explicit = process.env.LLM_PROVIDER;
  if (explicit === "anthropic" || explicit === "claude-cli") return explicit;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "claude-cli";
}

const PROVIDER: Provider = resolveProvider();

export const MODEL: string =
  process.env.LLM_MODEL ?? (PROVIDER === "anthropic" ? "claude-opus-4-8" : "claude-cli (local)");

export interface CompleteParams {
  system: string;
  user: string;
  maxTokens?: number;
}

// Один запрос: system-промт + сообщение пользователя -> текст ответа.
export async function complete(params: CompleteParams): Promise<string> {
  return PROVIDER === "anthropic" ? completeViaApi(params) : completeViaCli(params);
}

// Доступна ли генерация: для anthropic нужен ключ, для claude-cli — найденный бинарь.
// Если нет ни ключа, ни CLI — генерация выключена (чат блокируется), но БД читается.
export interface GenerationStatus {
  available: boolean;
  provider: Provider;
  mode: string;
}

let cliAvail: boolean | null = null;
function isCliAvailable(): boolean {
  if (cliAvail !== null) return cliAvail;
  const bin = (process.env.LLM_CLI_CMD || "claude").trim().split(/\s+/)[0];
  const r = spawnSync("sh", ["-c", `command -v ${bin}`], { stdio: "ignore" });
  cliAvail = r.status === 0;
  return cliAvail;
}

export function generationStatus(): GenerationStatus {
  if (PROVIDER === "anthropic") {
    return { available: Boolean(process.env.ANTHROPIC_API_KEY), provider: PROVIDER, mode: "API-ключ" };
  }
  return { available: isCliAvailable(), provider: PROVIDER, mode: "локальный Claude CLI" };
}

// --- режим 1: Anthropic API (по ключу) ---
let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не задан — положите ключ в .env");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

async function completeViaApi({ system, user, maxTokens = 4096 }: CompleteParams): Promise<string> {
  // Пустой system → RAW: голый запрос без системного промта.
  const resp = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: user }],
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// --- режим 2: локальный Claude CLI (headless) ---
// Команду можно переопределить через LLM_CLI_CMD. Промт передаётся в stdin.
function completeViaCli({ system, user }: CompleteParams): Promise<string> {
  const cmd = process.env.LLM_CLI_CMD || "claude -p --output-format text";
  // Пустой system → RAW: шлём только запрос (как будто открыл чат и ввёл его).
  // Иначе system + user нейтрально — формат диктует сам системный промт.
  const prompt = system ? `${system}\n\n---\n\n${user}` : user;

  return new Promise<string>((resolve, reject) => {
    // cwd вне репозитория: иначе `claude -p` подхватывает CLAUDE.md и контекст проекта
    // и начинает «мета-комментировать» пайплайн вместо чистой генерации.
    const child = spawn(cmd, { shell: true, cwd: tmpdir() });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) =>
      reject(new Error(`Не удалось запустить локальный Claude CLI (${cmd}): ${e.message}`))
    );
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`Claude CLI вернул код ${code}: ${(err || out).trim()}`));
    });
    child.stdin?.write(prompt);
    child.stdin?.end();
  });
}
