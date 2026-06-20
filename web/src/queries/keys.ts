import type { PromptKind } from "@/api/types";

// Единая фабрика query-ключей — чтобы инвалидация и кэш были консистентны.
export const qk = {
  status: ["status"] as const,
  conversations: ["conversations"] as const,
  conversationMessages: (id: number) => ["conversation", id, "messages"] as const,
  articles: ["articles"] as const,
  article: (slug: string) => ["article", slug] as const,
  prompts: (kind?: PromptKind) => (kind ? (["prompts", kind] as const) : (["prompts"] as const)),
  prompt: (id: number) => ["prompt", id] as const,
};
