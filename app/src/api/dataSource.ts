import { type IClient } from 'src/generated/api-client';
import { api } from './apiClient';
import { mockApi } from 'src/mock/mockApi';
import { useAuth } from 'src/auth/AuthProvider';

/** The active data client: the live API for real sessions, the in-memory demo
 * client for demo sessions. Module hooks call this instead of importing `api`
 * directly, so every screen works in both modes with no per-screen branching. */
export function useDataSource(): IClient {
  const { isDemo } = useAuth();
  return isDemo ? mockApi : api;
}
