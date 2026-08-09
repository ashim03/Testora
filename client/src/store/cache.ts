import { create } from "zustand";
import { persist } from "zustand/middleware";

interface QueryState {
  queries: Record<string, number>;
  invalidate: (key: string) => void;
}

export const useQueryInvalidate = create<QueryState>()(
  persist(
    (set) => ({
      queries: {},
      invalidate: (key: string) =>
        set((s) => ({ queries: { ...s.queries, [key]: (s.queries[key] || 0) + 1 } })),
    }),
    { name: "ielts-invalidate" },
  ),
);