// Доменные типы (контракт с бэкендом).

export interface ArticleListItem {
  id: number;
  slug: string;
  query: string;
  title: string;
  category: string | null;
  model: string | null;
  createdAt: string;
}

export interface CommentItem {
  id: number;
  author: string;
  body: string;
  createdAt: string;
}

export type Variant = "raw" | "soft" | "rigid";
export type Side = Variant | "similar";

export interface Verification {
  ranking: Variant[]; // лучший → худший
  criteria?: Record<string, { best: Side; note: string }>;
  hallucinations: { side: string; claim: string }[];
  summary: string;
}

export interface Article extends ArticleListItem {
  contentMarkdown: string; // SOFT
  rawMarkdown: string | null;
  rigidMarkdown: string | null;
  verification: Verification | null;
  promptId: number | null;
  promptLabel: string | null;
  rigidLabel: string | null;
  comments?: CommentItem[];
}

export interface GenerationStatus {
  available: boolean;
  provider: string;
  mode: string;
}

export type PromptKind = "generate" | "baseline" | "classify" | "verify";

export type PromptStatus = "active" | "test" | "inactive";

export interface Prompt {
  id: number;
  kind: PromptKind;
  label: string;
  status: PromptStatus;
  body: string;
  createdAt: string;
}

export interface Conversation {
  id: number;
  title: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  sender: "me" | "bot";
  content: string;
  articleSlug: string | null;
  createdAt: string;
}

// События SSE-стрима чата.
export interface ChatStatusEvent {
  stage: string;
  message: string;
}
export interface ChatResultEvent {
  slug: string;
  title: string;
  reused: boolean;
  summary: string;
}
