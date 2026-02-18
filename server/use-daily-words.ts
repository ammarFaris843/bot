import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { DailyWord, InsertDailyWord } from "@shared/schema";

// GET /api/daily-words
export function useDailyWords() {
  return useQuery({
    queryKey: [api.dailyWords.list.path],
    queryFn: async () => {
      const res = await fetch(api.dailyWords.list.path);
      if (!res.ok) throw new Error("Failed to fetch daily words");
      return api.dailyWords.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/daily-words/today
export function useTodayWord() {
  return useQuery({
    queryKey: ["/api/daily-words/today"],
    queryFn: async () => {
      const res = await fetch("/api/daily-words/today");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch today's word");
      return (await res.json()) as DailyWord;
    },
  });
}

// GET /api/daily-words/latest
export function useLatestDailyWord() {
  return useQuery({
    queryKey: [api.dailyWords.getLatest.path],
    queryFn: async () => {
      const res = await fetch(api.dailyWords.getLatest.path);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch latest word");
      return api.dailyWords.getLatest.responses[200].parse(await res.json());
    },
  });
}

// POST /api/daily-words
export function useCreateDailyWord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDailyWord) => {
      const res = await fetch(api.dailyWords.create.path, {
        method: api.dailyWords.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create word");
      }
      return api.dailyWords.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.dailyWords.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dailyWords.getLatest.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-words/today"] });
      toast({ title: "Mission Accomplished", description: "New daily word protocol initiated successfully." });
    },
    onError: (error) => {
      toast({ title: "System Error", description: error.message, variant: "destructive" });
    },
  });
}

// PUT /api/daily-words/:id
export function useUpdateDailyWord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertDailyWord>) => {
      const url = buildUrl(api.dailyWords.update.path, { id });
      const res = await fetch(url, {
        method: api.dailyWords.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update word");
      }
      return api.dailyWords.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.dailyWords.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-words/today"] });
      toast({ title: "Database Updated", description: "Word entry has been modified." });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });
}

// DELETE /api/daily-words/:id
export function useDeleteDailyWord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/daily-words/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete word");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.dailyWords.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-words/today"] });
      toast({ title: "Entry Deleted", description: "Word entry has been removed." });
    },
    onError: (error) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    },
  });
}
