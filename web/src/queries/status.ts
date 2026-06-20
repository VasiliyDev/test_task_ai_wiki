import { useQuery } from "@tanstack/vue-query";
import { api } from "@/api/client";
import { qk } from "./keys";

// Доступность генерации — для блокировки чата.
export function useGenerationStatus() {
  return useQuery({
    queryKey: qk.status,
    queryFn: api.status,
    select: (data) => data.generation,
    staleTime: 60_000,
  });
}
