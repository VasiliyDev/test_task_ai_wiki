import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { api } from "@/api/client";
import { qk } from "./keys";

export function useArticles() {
  return useQuery({ queryKey: qk.articles, queryFn: api.listArticles });
}

export function useArticle(slug: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => qk.article(toValue(slug))),
    queryFn: () => api.getArticle(toValue(slug)),
    enabled: computed(() => Boolean(toValue(slug))),
  });
}

export function useAddComment(slug: MaybeRefOrGetter<string>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { author: string; body: string }) =>
      api.addComment(toValue(slug), input.author, input.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.article(toValue(slug)) }),
  });
}
