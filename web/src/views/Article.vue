<script setup lang="ts">
import { computed, ref } from "vue";
import { marked } from "marked";
import { useArticle, useAddComment } from "@/queries/articles";

const props = defineProps<{ slug: string }>();

const { data: article, isPending, error } = useArticle(() => props.slug);
const addComment = useAddComment(() => props.slug);

const html = computed(() =>
  article.value ? (marked.parse(article.value.contentMarkdown) as string) : ""
);

const author = ref("");
const body = ref("");

async function submitComment(): Promise<void> {
  if (!body.value.trim() || addComment.isPending.value) return;
  await addComment.mutateAsync({ author: author.value, body: body.value });
  body.value = "";
}
</script>

<template>
  <p v-if="error" class="error">{{ error?.message }}</p>
  <p v-else-if="isPending" class="muted">Загрузка…</p>

  <template v-else-if="article">
    <article class="prose-article" v-html="html"></article>

    <p class="muted mt-4 text-[13px]">
      Сгенерировано: {{ article.model }} · промт: {{ article.promptLabel || "—" }} · запрос:
      «{{ article.query }}»
    </p>

    <section class="comments">
      <h2 class="text-base font-semibold">Комментарии ({{ article.comments?.length || 0 }})</h2>
      <div v-for="c in article.comments" :key="c.id" class="comment">
        <div class="text-sm font-semibold">{{ c.author }}</div>
        <div>{{ c.body }}</div>
      </div>

      <form class="mt-4 grid gap-2.5" @submit.prevent="submitComment">
        <input v-model="author" class="field" placeholder="Имя (необязательно)" />
        <textarea v-model="body" rows="3" class="field" placeholder="Ваш комментарий…"></textarea>
        <div>
          <button class="btn" :disabled="addComment.isPending.value || !body.trim()">
            {{ addComment.isPending.value ? "Отправка…" : "Отправить" }}
          </button>
        </div>
      </form>
    </section>
  </template>
</template>
