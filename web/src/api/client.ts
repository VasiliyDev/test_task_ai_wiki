// Транспортный слой: тонкая обёртка над fetch + SSE. Никакой UI/состояния здесь нет.
import type {
  Article,
  ArticleListItem,
  CommentItem,
  Conversation,
  ConversationMessage,
  GenerationStatus,
  Prompt,
  PromptKind,
  PromptStatus,
} from "./types";

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  status: () => http<{ generation: GenerationStatus }>("/status"),

  listArticles: () => http<ArticleListItem[]>("/articles"),
  getArticle: (slug: string) => http<Article>(`/articles/${slug}`),
  addComment: (slug: string, author: string, body: string) =>
    http<CommentItem>(`/articles/${slug}/comments`, {
      method: "POST",
      body: JSON.stringify({ author, body }),
    }),

  listConversations: () => http<Conversation[]>("/conversations"),
  createConversation: () => http<Conversation>("/conversations", { method: "POST" }),
  conversationMessages: (id: number) =>
    http<ConversationMessage[]>(`/conversations/${id}/messages`),
  deleteConversation: (id: number) => http<void>(`/conversations/${id}`, { method: "DELETE" }),

  listPrompts: (kind?: PromptKind) => http<Prompt[]>(`/prompts${kind ? `?kind=${kind}` : ""}`),
  getPrompt: (id: number) => http<Prompt>(`/prompts/${id}`),
  createPrompt: (kind: PromptKind, body: string, label?: string, status?: PromptStatus) =>
    http<Prompt>("/prompts", { method: "POST", body: JSON.stringify({ kind, body, label, status }) }),
  updatePrompt: (id: number, patch: { body?: string; label?: string }) =>
    http<Prompt>(`/prompts/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  setPromptStatus: (id: number, status: PromptStatus) =>
    http<Prompt>(`/prompts/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  deletePrompt: (id: number) => http<void>(`/prompts/${id}`, { method: "DELETE" }),
};

// SSE-стрим «хода мысли» в рамках чата. EventSource надёжен в т.ч. в Safari.
export function chatStream(q: string, conversationId: number): EventSource {
  return new EventSource(
    `/api/chat/stream?q=${encodeURIComponent(q)}&conversationId=${conversationId}`
  );
}
