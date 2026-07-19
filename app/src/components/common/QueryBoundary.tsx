import { type ReactNode } from 'react';
import { Box, CircularProgress, Alert, Button } from '@mui/material';
import { apiErrorMessage } from 'src/api/errors';
import { EmptyState } from './EmptyState';

interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch?: () => void;
}

/** Renders loading / error / empty / data states for a react-query result so
 * every module handles them the same way. `children` receives the loaded data. */
export function QueryBoundary<T>({
  query,
  children,
  isEmpty,
  emptyState,
  minHeight = 240,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyState?: ReactNode;
  minHeight?: number;
}) {
  const { data, isLoading, isError, error, refetch } = query;

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || data === undefined) {
    return (
      <Alert
        severity="error"
        sx={{ my: 2 }}
        action={
          refetch && (
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Zkusit znovu
            </Button>
          )
        }
      >
        {apiErrorMessage(error, 'Data se nepodařilo načíst.')}
      </Alert>
    );
  }

  if (isEmpty?.(data)) {
    return <>{emptyState ?? <EmptyState title="Zatím tu nic není" />}</>;
  }

  return <>{children(data)}</>;
}
