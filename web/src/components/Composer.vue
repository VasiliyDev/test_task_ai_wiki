<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(defineProps<{ disabled?: boolean; placeholder?: string }>(), {
  placeholder: "Спросите что-нибудь…",
});
const emit = defineEmits<{ send: [text: string] }>();

const text = ref("");

function submit(): void {
  const t = text.value.trim();
  if (!t || props.disabled) return;
  emit("send", t);
  text.value = "";
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <form class="flex items-end gap-2 border-t border-zinc-800 pt-2" @submit.prevent="submit">
    <textarea
      v-model="text"
      rows="1"
      :disabled="disabled"
      class="field max-h-32 flex-1 resize-none"
      :placeholder="placeholder"
      @keydown="onKeydown"
    ></textarea>
    <button class="btn" :disabled="disabled || !text.trim()" aria-label="Отправить">→</button>
  </form>
</template>
