<script setup lang="ts">
import { computed, ref } from "vue";
import { marked } from "marked";
import type { Article, Variant } from "@/api/types";
import { useArticle, useArticles } from "@/queries/articles";

const selected = ref("");
const { data: articles } = useArticles();
const { data: article, isFetching, error } = useArticle(selected);

const VARIANT_LABEL: Record<Variant, string> = {
  soft: "SOFT — мягкий промт",
  rigid: "RIGID — жёсткий промт",
  raw: "RAW — без промта",
};
const sideLabel = (s: string): string =>
  s === "soft" ? "SOFT" : s === "rigid" ? "RIGID" : s === "raw" ? "RAW" : "≈";

function body(a: Article, v: Variant): string | null {
  if (v === "soft") return a.contentMarkdown;
  if (v === "raw") return a.rawMarkdown;
  return a.rigidMarkdown;
}

// Три варианта в порядке ранжирования (лучший → худший), пустые пропускаем.
const orderedVariants = computed(() => {
  const a = article.value;
  if (!a) return [];
  const order = [...(a.verification?.ranking ?? []), "soft", "raw", "rigid"] as Variant[];
  return order
    .filter((v, i, arr) => arr.indexOf(v) === i && body(a, v))
    .map((v) => ({ variant: v, label: VARIANT_LABEL[v], html: marked.parse(body(a, v) as string) as string }));
});
const criteria = computed(() => Object.entries(article.value?.verification?.criteria ?? {}));
</script>

<template>
  <h2 class="text-lg font-semibold">Сравнение (RAW · SOFT · RIGID)</h2>

  <select v-model="selected" class="field mt-2 max-w-xl">
    <option value="">— выберите статью —</option>
    <option v-for="a in articles ?? []" :key="a.id" :value="a.slug">{{ a.title }}</option>
  </select>

  <p v-if="error" class="error mt-2">{{ error?.message }}</p>
  <p v-if="isFetching" class="muted mt-2">Загрузка…</p>

  <template v-if="article">
    <!-- Критическая оценка -->
    <div v-if="article.verification" class="card my-3.5">
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
    <p v-else class="muted my-2 text-[13px]">Оценка для этой статьи не сохранена.</p>

    <!-- Три варианта друг под другом, ранжированные -->
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
