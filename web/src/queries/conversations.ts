import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "@/api/client";
import { qk } from "./keys";

export function useConversations() {
  return useQuery({ queryKey: qk.conversations, queryFn: api.listConversations });
}

export function useConversationMessages(id: MaybeRefOrGetter<number | null>) {
  return useQuery({
    queryKey: computed(() => qk.conversationMessages(Number(toValue(id)))),
    queryFn: () => api.conversationMessages(Number(toValue(id))),
    enabled: computed(() => Boolean(toValue(id))),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.createConversation(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.conversations }),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.conversations }),
  });
}
