<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { api } from "@/api/client";

const qc = useQueryClient();

// Готовый отчёт рецензента (markdown) — общий разбор всех статей по 7 критериям.
const { data, isPending, error } = useQuery({
  queryKey: ["analysis"],
  queryFn: () => api.getAnalysis(),
  retry: false,
});

const html = computed(() => (data.value?.markdown ? (marked.parse(data.value.markdown) as string) : ""));

const rerun = useMutation({
  mutationFn: () => api.runAnalysis(),
  onSuccess: (res) => {
    qc.setQueryData(["analysis"], { markdown: res.markdown });
  },
});
</script>

<template>
  <div class="mb-3 flex items-center justify-between gap-3">
    <h1 class="text-lg font-semibold">Общая рецензия</h1>
    <button class="btn" :disabled="rerun.isPending.value" @click="rerun.mutate()">
      {{ rerun.isPending.value ? "Пересчёт…" : "Пересчитать" }}
    </button>
  </div>
  <p class="muted mb-4 text-[13px]">
    Финальный рецензент собирает слепые вердикты критика по всем статьям и делает общий вывод:
    какой промт где выигрывает. Рядом с AI-выводом — детерминированная статистика побед.
  </p>

  <p v-if="rerun.error.value" class="error">{{ rerun.error.value.message }}</p>
  <p v-if="error" class="muted">
    Рецензия ещё не построена. Нажмите «Пересчитать», чтобы агент собрал разбор по всем статьям.
  </p>
  <p v-else-if="isPending" class="muted">Загрузка…</p>
  <article v-else class="prose-article" v-html="html"></article>
</template>
