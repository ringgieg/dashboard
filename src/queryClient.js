import { QueryClient } from '@tanstack/vue-query'

// Singleton QueryClient shared by:
// - VueQueryPlugin (component hooks)
// - Imperative API calls via queryClient.fetchQuery()
// This ensures in-flight de-dupe and caching are consistent across the app.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep defaults conservative; per-request retry/backoff is set in API modules.
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    }
  }
})
