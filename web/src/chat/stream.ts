import { reactive } from "vue";
import { chatStream } from "@/api/client";
import type { ChatResultEvent, ChatStatusEvent } from "@/api/types";

// Модульный (singleton) стор активных стримов генерации, по conversationId.
// Живёт вне компонента → «ход мысли» не теряется при уходе со страницы и возврате.

export interface StreamState {
  question: string;
  lines: string[]; // статусные строки «хода мысли»
  busy: boolean;
  result: { slug: string; title: string; summary: string } | null;
  error: string | null;
}

const states = reactive<Record<number, StreamState>>({});
const sources: Record<number, EventSource> = {};

export function streamState(cid: number): StreamState | undefined {
  return states[cid];
}

// onDone вызывается по завершении (успех/ошибка) — даже если компонент уже размонтирован.
export function startStream(cid: number, question: string, onDone?: () => void): void {
  if (sources[cid]) return; // для этого чата уже идёт
  states[cid] = { question, lines: [], busy: true, result: null, error: null };
  const st = states[cid];
  const es = chatStream(question, cid);
  sources[cid] = es;

  const stop = (): void => {
    es.close();
    delete sources[cid];
    onDone?.();
  };

  es.addEventListener("status", (ev) => {
    st.lines.push((JSON.parse((ev as MessageEvent).data) as ChatStatusEvent).message);
  });
  es.addEventListener("result", (ev) => {
    const d = JSON.parse((ev as MessageEvent).data) as ChatResultEvent;
    st.result = { slug: d.slug, title: d.title, summary: d.summary };
    st.busy = false;
    stop();
  });
  // Рубрикатор отсеял запрос: ответ бота уже сохранён на сервере, просто завершаем.
  es.addEventListener("rejected", () => {
    st.busy = false;
    stop();
  });
  es.addEventListener("error", (ev) => {
    const raw = (ev as MessageEvent).data;
    st.error = raw ? (JSON.parse(raw) as { error: string }).error : "Соединение прервано";
    st.busy = false;
    stop();
  });
}

export function clearStream(cid: number): void {
  sources[cid]?.close();
  delete sources[cid];
  delete states[cid];
}
