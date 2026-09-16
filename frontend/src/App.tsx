import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
      {/* Vercel Web Analytics + Speed Insights: no-ops outside a Vercel deployment. */}
      <Analytics />
      <SpeedInsights />
    </QueryClientProvider>
  );
}
