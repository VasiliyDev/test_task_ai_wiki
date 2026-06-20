export interface ChatMsg {
  id: string;
  sender: "me" | "bot";
  content: string;
  articleSlug?: string | null;
  pending?: boolean; // «думаю…» — живой пузырь стрима
}
