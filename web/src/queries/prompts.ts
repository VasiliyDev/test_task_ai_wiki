import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "@/api/client";
import type { PromptKind, PromptStatus } from "@/api/types";
import { qk } from "./keys";

export function usePrompts(kind?: MaybeRefOrGetter<PromptKind | undefined>) {
  return useQuery({
    queryKey: computed(() => qk.prompts(toValue(kind))),
    queryFn: () => api.listPrompts(toValue(kind)),
  });
}

export function usePrompt(id: MaybeRefOrGetter<number | null | undefined>) {
  return useQuery({
    queryKey: computed(() => qk.prompt(Number(toValue(id)))),
    queryFn: () => api.getPrompt(Number(toValue(id))),
    enabled: computed(() => Boolean(toValue(id))),
  });
}

// Все мутации промтов инвалидируют общий список — UI обновляется сам.
function usePromptInvalidation() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: qk.prompts() });
}

export function useCreatePrompt() {
  const invalidate = usePromptInvalidation();
  return useMutation({
    mutationFn: (input: { kind: PromptKind; body: string; label?: string; status?: PromptStatus }) =>
      api.createPrompt(input.kind, input.body, input.label, input.status),
    onSuccess: invalidate,
  });
}

export function useUpdatePrompt() {
  const invalidate = usePromptInvalidation();
  return useMutation({
    mutationFn: (input: { id: number; body?: string; label?: string }) =>
      api.updatePrompt(input.id, { body: input.body, label: input.label }),
    onSuccess: invalidate,
  });
}

export function useSetPromptStatus() {
  const invalidate = usePromptInvalidation();
  return useMutation({
    mutationFn: (input: { id: number; status: PromptStatus }) =>
      api.setPromptStatus(input.id, input.status),
    onSuccess: invalidate,
  });
}

export function useDeletePrompt() {
  const invalidate = usePromptInvalidation();
  return useMutation({
    mutationFn: (id: number) => api.deletePrompt(id),
    onSuccess: invalidate,
  });
}
