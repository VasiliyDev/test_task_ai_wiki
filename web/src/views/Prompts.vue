<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Prompt, PromptKind, PromptStatus } from "@/api/types";
import {
  useCreatePrompt,
  useDeletePrompt,
  usePrompts,
  useSetPromptStatus,
  useUpdatePrompt,
} from "@/queries/prompts";

const KINDS: PromptKind[] = ["generate", "baseline", "classify", "verify"];

const { data: prompts, error } = usePrompts();
const update = useUpdatePrompt();
const setStatus = useSetPromptStatus();
const create = useCreatePrompt();
const del = useDeletePrompt();

const selectedId = ref<number | null>(null);
const body = ref("");
const label = ref("");
const note = ref("");

const grouped = computed(() => {
  const m = new Map<PromptKind, Prompt[]>();
  for (const k of KINDS) m.set(k, []);
  for (const p of prompts.value ?? []) m.get(p.kind)?.push(p);
  return m;
});
const selected = computed(() => (prompts.value ?? []).find((p) => p.id === selectedId.value) ?? null);
const busy = computed(
  () =>
    update.isPending.value || setStatus.isPending.value || create.isPending.value || del.isPending.value
);

const STATUS_LABEL: Record<PromptStatus, string> = {
  active: "активна",
  test: "тест",
  inactive: "неактивна",
};
const statusClass = (s: PromptStatus): string =>
  s === "active" ? "bg-sky-400 text-zinc-950" : s === "test" ? "bg-amber-400 text-zinc-950" : "bg-zinc-700 text-zinc-200";

function select(p: Prompt): void {
  selectedId.value = p.id;
  body.value = p.body;
  label.value = p.label;
  note.value = "";
}

watch(
  prompts,
  (list) => {
    if (list?.length && !selected.value) select(list[0]);
  },
  { immediate: true }
);

async function save(): Promise<void> {
  if (!selected.value) return;
  await update.mutateAsync({ id: selected.value.id, body: body.value, label: label.value });
  note.value = "Сохранено";
}
async function changeStatus(status: PromptStatus): Promise<void> {
  if (!selected.value) return;
  await setStatus.mutateAsync({ id: selected.value.id, status });
  note.value = `Статус: ${STATUS_LABEL[status]}`;
}
async function createVersion(): Promise<void> {
  if (!selected.value) return;
  const p = await create.mutateAsync({
    kind: selected.value.kind,
    body: body.value,
    label: `${label.value}-копия`,
    status: "inactive",
  });
  select(p);
  note.value = "Создана новая версия (неактивная)";
}
async function remove(): Promise<void> {
  if (!selected.value || selected.value.status === "active") return;
  if (!confirm(`Удалить версию «${selected.value.label}»?`)) return;
  const id = selected.value.id;
  selectedId.value = null;
  await del.mutateAsync(id);
  note.value = "Удалено";
}
</script>

<template>
  <h2 class="text-lg font-semibold">Промты</h2>
  <p class="muted text-[13px]">
    Версии хранятся в БД. На каждый вид — одна активная (боевая); остальные можно держать как
    тест-прогонные или неактивные.
  </p>
  <p v-if="error" class="error">{{ error?.message }}</p>

  <div class="mt-3 grid gap-3 md:grid-cols-[260px_1fr]">
    <!-- список версий -->
    <div class="card">
      <div v-for="k in KINDS" :key="k" class="mb-2.5">
        <div class="muted text-xs uppercase">{{ k }}</div>
        <button
          v-for="p in grouped.get(k)"
          :key="p.id"
          class="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border bg-zinc-950 px-2.5 py-2 text-left text-sm"
          :class="p.id === selectedId ? 'border-sky-500' : 'border-zinc-800'"
          @click="select(p)"
        >
          <span class="truncate">{{ p.label }}</span>
          <span class="badge shrink-0" :class="statusClass(p.status)">{{ STATUS_LABEL[p.status] }}</span>
        </button>
      </div>
    </div>

    <!-- редактор -->
    <div v-if="selected" class="card">
      <div class="mb-2 flex flex-wrap items-center gap-2.5">
        <strong>{{ selected.kind }}</strong>
        <input v-model="label" class="field max-w-60" placeholder="метка версии" />
        <span class="badge" :class="statusClass(selected.status)">{{ STATUS_LABEL[selected.status] }}</span>
      </div>
      <textarea v-model="body" rows="18" class="field font-mono text-[13px]"></textarea>
      <div class="mt-2.5 flex flex-wrap gap-2">
        <button class="btn" :disabled="busy" @click="save">Сохранить</button>
        <button class="btn" :disabled="busy || selected.status === 'active'" @click="changeStatus('active')">
          Сделать активной
        </button>
        <button
          class="btn btn-secondary"
          :disabled="busy || selected.status === 'test'"
          @click="changeStatus('test')"
        >
          Пометить тестом
        </button>
        <button
          class="btn btn-secondary"
          :disabled="busy || selected.status === 'inactive'"
          @click="changeStatus('inactive')"
        >
          В неактивные
        </button>
        <button class="btn btn-secondary" :disabled="busy" @click="createVersion">Создать версию</button>
        <button
          class="btn bg-red-600 text-white"
          :disabled="busy || selected.status === 'active'"
          :title="selected.status === 'active' ? 'Активную версию удалить нельзя' : ''"
          @click="remove"
        >
          Удалить
        </button>
      </div>
      <p v-if="note" class="muted mt-2">{{ note }}</p>
    </div>
  </div>
</template>
