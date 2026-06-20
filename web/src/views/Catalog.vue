<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import type { ArticleListItem } from "@/api/types";
import { useArticles } from "@/queries/articles";

interface SubGroup {
  name: string;
  items: ArticleListItem[];
}
interface TopGroup {
  name: string;
  direct: ArticleListItem[];
  subs: SubGroup[];
}

const { data: articles, isPending, error } = useArticles();

// Дерево из строки категории «Раздел / Подраздел» (до 2 уровней).
const tree = computed<TopGroup[]>(() => {
  const tops = new Map<string, { direct: ArticleListItem[]; subs: Map<string, ArticleListItem[]> }>();
  for (const a of articles.value ?? []) {
    const parts = (a.category || "Без категории").split("/").map((s) => s.trim()).filter(Boolean);
    const top = parts[0] || "Без категории";
    const sub = parts[1] || "";
    if (!tops.has(top)) tops.set(top, { direct: [], subs: new Map() });
    const node = tops.get(top)!;
    if (sub) {
      if (!node.subs.has(sub)) node.subs.set(sub, []);
      node.subs.get(sub)!.push(a);
    } else {
      node.direct.push(a);
    }
  }
  return [...tops.entries()]
    .map(([name, n]) => ({
      name,
      direct: n.direct,
      subs: [...n.subs.entries()]
        .map(([sname, items]) => ({ name: sname, items }))
        .sort((x, y) => x.name.localeCompare(y.name)),
    }))
    .sort((x, y) => x.name.localeCompare(y.name));
});
</script>

<template>
  <h2 class="text-lg font-semibold">Каталог</h2>

  <p v-if="error" class="error">{{ error?.message }}</p>
  <p v-else-if="isPending" class="muted">Загрузка…</p>
  <p v-else-if="!articles?.length" class="muted">Статей пока нет — создайте в чате.</p>

  <details v-for="g in tree" :key="g.name" open class="card mt-2.5">
    <summary class="cursor-pointer font-semibold">{{ g.name }}</summary>

    <ul v-if="g.direct.length" class="list">
      <li v-for="a in g.direct" :key="a.id">
        <RouterLink :to="{ name: 'article', params: { slug: a.slug } }">{{ a.title }}</RouterLink>
      </li>
    </ul>

    <div v-for="s in g.subs" :key="s.name" class="mt-1.5">
      <div class="muted mt-2 text-[13px]">{{ s.name }}</div>
      <ul class="list">
        <li v-for="a in s.items" :key="a.id">
          <RouterLink :to="{ name: 'article', params: { slug: a.slug } }">{{ a.title }}</RouterLink>
        </li>
      </ul>
    </div>
  </details>
</template>
