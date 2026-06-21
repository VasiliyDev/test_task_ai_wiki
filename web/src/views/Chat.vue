<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import type { ConversationMessage } from "@/api/types";
import type { ChatMsg } from "@/chat/types";
import { useGenerationStatus } from "@/queries/status";
import {
  useConversations,
  useConversationMessages,
  useCreateConversation,
  useDeleteConversation,
} from "@/queries/conversations";
import { qk } from "@/queries/keys";
import { startStream, streamState, clearStream } from "@/chat/stream";
import ChatSidebar from "@/components/ChatSidebar.vue";
import MessageList from "@/components/MessageList.vue";
import Composer from "@/components/Composer.vue";

const qc = useQueryClient();
const { data: generation, isPending: statusPending } = useGenerationStatus();
const available = computed(() => generation.value?.available === true);

const { data: conversations } = useConversations();
const createConversation = useCreateConversation();
const deleteConversation = useDeleteConversation();

// activeId === null → черновик «нового чата» (в БД пока нет).
const activeId = ref<number | null>(null);
const { data: serverMessages } = useConversationMessages(activeId);
const sending = ref(false);

const rooms = computed(() =>
  (conversations.value ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    busy: streamState(c.id)?.busy ?? false,
  }))
);

function toChatMsg(m: ConversationMessage): ChatMsg {
  return { id: String(m.id), sender: m.sender, content: m.content, articleSlug: m.articleSlug };
}

// История из БД + живой оверлей стрима (вопрос-оптимистик + «думаю»).
const messages = computed<ChatMsg[]>(() => {
  const cid = activeId.value;
  if (cid === null) return [];
  const list = (serverMessages.value ?? []).map(toChatMsg);
  const s = streamState(cid);
  if (s?.busy) {
    if (!list.some((m) => m.sender === "me" && m.content === s.question)) {
      list.push({ id: "__q__", sender: "me", content: s.question });
    }
    list.push({ id: "__thinking__", sender: "bot", pending: true, content: s.lines.map((l) => `• ${l}`).join("\n") });
  }
  return list;
});

// Автоскролл вниз при новых сообщениях.
const scrollEl = ref<HTMLElement | null>(null);
watch(
  () => messages.value.length,
  () => nextTick(() => scrollEl.value && (scrollEl.value.scrollTop = scrollEl.value.scrollHeight))
);

function selectRoom(id: number): void {
  activeId.value = id;
}
function newChat(): void {
  activeId.value = null;
}
async function removeRoom(id: number): Promise<void> {
  if (!confirm("Удалить этот чат вместе с историей?")) return;
  clearStream(id);
  await deleteConversation.mutateAsync(id);
  if (activeId.value === id) activeId.value = null;
}

async function send(text: string): Promise<void> {
  if (sending.value) return;
  sending.value = true;
  try {
    let cid = activeId.value;
    if (cid === null) {
      cid = (await createConversation.mutateAsync()).id;
      activeId.value = cid;
    }
    if (streamState(cid)?.busy) return;

    const target = cid;
    startStream(target, text, () => {
      void (async () => {
        await qc.invalidateQueries({ queryKey: qk.conversationMessages(target) });
        void qc.invalidateQueries({ queryKey: qk.conversations });
        void qc.invalidateQueries({ queryKey: qk.articles });
        clearStream(target);
      })();
    });
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <p v-if="statusPending" class="muted">Проверяю доступность генерации…</p>

  <!-- Генерация может быть недоступна (нет токена): чаты и история всё равно
       показываются для чтения, недоступна только отправка новых сообщений. -->
  <div v-else class="chat-wrap flex flex-col gap-3 md:grid md:grid-cols-[260px_1fr]">
    <ChatSidebar
      class="max-h-44 md:max-h-none md:h-full"
      :rooms="rooms"
      :active-id="activeId"
      @select="selectRoom"
      @create="newChat"
      @remove="removeRoom"
    />

    <div class="flex min-h-0 flex-col">
      <div ref="scrollEl" class="flex-1 overflow-y-auto">
        <MessageList :messages="messages" />
      </div>
      <p v-if="!available" class="muted mb-1 text-sm">
        Генерация сейчас недоступна (нет токена) — историю можно читать, но отправлять новые
        сообщения нельзя.
      </p>
      <Composer
        :disabled="sending || !available"
        :placeholder="available ? undefined : 'Отправка отключена — генерация недоступна'"
        @send="send"
      />
    </div>
  </div>
</template>
