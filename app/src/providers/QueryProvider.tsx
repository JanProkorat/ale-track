import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
     defaultOptions: {
          queries: {
               staleTime: 1000 * 60 * 2, // 2 minutes
               retry: false,
               refetchOnWindowFocus: false,
          },
     },
});

export { queryClient };

export default function QueryProvider({ children }: { children: React.ReactNode }) {
     return (
          <QueryClientProvider client={queryClient}>
               {children}
               <ReactQueryDevtools initialIsOpen={false} />
          </QueryClientProvider>
     );
}
