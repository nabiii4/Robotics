'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useState } from 'react';
import { Toaster } from './ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <Tooltip.Provider delayDuration={300}>
        {children}
        <Toaster />
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}
