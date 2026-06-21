<script setup lang="ts">
import { computed, ref } from "vue";
import { marked } from "marked";
import type { Article, Variant } from "@/api/types";
import { useArticle, useAddComment } from "@/queries/articles";

const props = defineProps<{ slug: string }>();

const { data: article, isPending, error } = useArticle(() => props.slug);
const addComment = useAddComment(() => props.slug);

// Режим просмотра: сама статья (SOFT) или сравнение трёх вариантов с вердиктом критика.
type Mode = "article" | "compare";
const mode = ref<Mode>("article");

const html = computed(() =>
  article.value ? (marked.parse(article.value.contentMarkdown) as string) : ""
);

// --- Сравнение вариантов (раньше было отдельной страницей /compare) ---
const VARIANT_LABEL: Record<Variant, string> = {
  soft: "SOFT — мягкий промт",
  rigid: "RIGID — жёсткий промт",
  raw: "RAW — без промта",
};
const sideLabel = (s: string): string =>
  s === "soft" ? "SOFT" : s === "rigid" ? "RIGID" : s === "raw" ? "RAW" : "≈";

function variantBody(a: Article, v: Variant): string | null {
  if (v === "soft") return a.contentMarkdown;
  if (v === "raw") return a.rawMarkdown;
  return a.rigidMarkdown;
}

// Варианты в порядке ранжирования (лучший → худший), пустые пропускаем.
const orderedVariants = computed(() => {
  const a = article.value;
  if (!a) return [];
  const order = [...(a.verification?.ranking ?? []), "soft", "raw", "rigid"] as Variant[];
  return order
    .filter((v, i, arr) => arr.indexOf(v) === i && variantBody(a, v))
    .map((v) => ({ variant: v, label: VARIANT_LABEL[v], html: marked.parse(variantBody(a, v) as string) as string }));
});
const criteria = computed(() => Object.entries(article.value?.verification?.criteria ?? {}));
const hasComparison = computed(() => orderedVariants.value.length > 1 || !!article.value?.verification);

// --- Комментарии ---
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
    <!-- Переключатель: статья ↔ сравнение (без отдельных страниц) -->
    <div v-if="hasComparison" class="mb-3 flex gap-2">
      <button class="btn" :class="mode === 'article' ? '' : 'opacity-50'" @click="mode = 'article'">
        Статья
      </button>
      <button class="btn" :class="mode === 'compare' ? '' : 'opacity-50'" @click="mode = 'compare'">
        Сравнение
      </button>
    </div>

    <!-- Режим: статья -->
    <template v-if="mode === 'article'">
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

    <!-- Режим: сравнение -->
    <template v-else>
      <div v-if="article.verification" class="card mb-3.5">
        <div class="flex flex-wrap items-center gap-2">
          <strong>Рейтинг:</strong>
          <span
            v-for="(v, i) in article.verification.ranking"
            :key="v"
            class="badge"
            :class="i === 0 ? 'bg-sky-400 text-zinc-950' : 'bg-zinc-700 text-zinc-200'"
          >
            {{ i + 1 }}. {{ sideLabel(v) }}
          </span>
          <span class="muted">промты: soft={{ article.promptLabel || "—" }}, rigid={{ article.rigidLabel || "—" }}</span>
        </div>
        <p v-if="article.verification.summary" class="mt-2">{{ article.verification.summary }}</p>

        <table v-if="criteria.length" class="mt-3 w-full text-left text-[13px]">
          <thead class="muted">
            <tr><th class="py-1 pr-3">Критерий</th><th class="py-1 pr-3">Лучший</th><th class="py-1">Заметка</th></tr>
          </thead>
          <tbody>
            <tr v-for="[k, c] in criteria" :key="k" class="border-t border-zinc-800">
              <td class="py-1 pr-3 align-top">{{ k }}</td>
              <td class="py-1 pr-3 align-top"><span class="badge bg-zinc-700 text-zinc-200">{{ sideLabel(c.best) }}</span></td>
              <td class="py-1 align-top">{{ c.note }}</td>
            </tr>
          </tbody>
        </table>

        <ul v-if="article.verification.hallucinations.length" class="mt-3 list-disc pl-5">
          <li v-for="(h, i) in article.verification.hallucinations" :key="i">
            <span class="muted">[{{ sideLabel(h.side) }}]</span> {{ h.claim }}
          </li>
        </ul>
      </div>
      <p v-else class="muted mb-2 text-[13px]">Оценка для этой статьи не сохранена.</p>

      <div class="grid gap-3">
        <div
          v-for="(item, i) in orderedVariants"
          :key="item.variant"
          class="card"
          :class="i === 0 ? 'border-sky-700' : ''"
        >
          <div class="muted mb-1.5 text-xs uppercase">{{ i + 1 }} место — {{ item.label }}</div>
          <div class="prose-article" v-html="item.html"></div>
        </div>
      </div>
    </template>
  </template>
</template>
