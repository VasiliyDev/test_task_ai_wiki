<script setup lang="ts">
interface Room {
  id: number;
  title: string;
  busy: boolean;
}
defineProps<{ rooms: Room[]; activeId: number | null }>();
defineEmits<{ select: [id: number]; create: []; remove: [id: number] }>();
</script>

<template>
  <div class="card flex flex-col gap-1 overflow-auto">
    <button class="btn mb-2" :class="{ 'ring-2 ring-sky-400': activeId === null }" @click="$emit('create')">
      + Новый чат
    </button>

    <button
      v-for="r in rooms"
      :key="r.id"
      class="group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm"
      :class="r.id === activeId ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/50'"
      @click="$emit('select', r.id)"
    >
      <span class="truncate">{{ r.title }}</span>
      <span class="flex shrink-0 items-center gap-1">
        <span v-if="r.busy" class="text-xs text-sky-400">⏳</span>
        <span
          class="px-1 text-zinc-500 hover:text-red-400"
          title="Удалить чат"
          @click.stop="$emit('remove', r.id)"
        >×</span>
      </span>
    </button>

    <p v-if="!rooms.length" class="muted px-1 text-[13px]">Чатов пока нет.</p>
  </div>
</template>
