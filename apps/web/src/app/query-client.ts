import { QueryClient } from "@tanstack/react-query";

/** Shared TanStack Query client factory (used by the app and by tests). */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const queryClient = createQueryClient();
