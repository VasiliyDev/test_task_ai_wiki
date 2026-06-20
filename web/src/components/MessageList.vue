<script setup lang="ts">
import { marked } from "marked";
import { RouterLink } from "vue-router";
import type { ChatMsg } from "@/chat/types";

defineProps<{ messages: ChatMsg[] }>();
const md = (s: string): string => marked.parse(s) as string;
</script>

<template>
  <div class="flex flex-col gap-3 p-1">
    <p v-if="!messages.length" class="muted mt-10 text-center">
      Задайте вопрос — получите статью, на которую можно сослаться.
    </p>

    <div
      v-for="m in messages"
      :key="m.id"
      class="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm break-words"
      :class="m.sender === 'me' ? 'self-end bg-sky-600 text-white' : 'self-start bg-zinc-800 text-zinc-100'"
    >
      <!-- живой пузырь «думаю» -->
      <template v-if="m.pending">
        <div v-if="m.content" class="whitespace-pre-wrap text-zinc-300">{{ m.content }}</div>
        <div class="mt-1.5 flex items-center gap-1" aria-label="Думаю">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </template>

      <template v-else>
        <div v-if="m.sender === 'bot'" class="prose-article" v-html="md(m.content)"></div>
        <div v-else class="whitespace-pre-wrap">{{ m.content }}</div>
        <RouterLink
          v-if="m.articleSlug"
          :to="{ name: 'article', params: { slug: m.articleSlug } }"
          class="mt-2 inline-block text-sky-300 underline"
        >
          Открыть полную статью →
        </RouterLink>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #a1a1aa;
  display: inline-block;
  animation: blink 1s infinite;
}
.dot:nth-child(2) {
  animation-delay: 0.15s;
}
.dot:nth-child(3) {
  animation-delay: 0.3s;
}
@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
</style>
