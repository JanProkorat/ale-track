import { type IClient } from 'src/generated/api-client';
import { api } from './apiClient';

/** The live API client. The former demo/live data-source seam was removed — the
 * app always talks to the real backend. Kept as a thin accessor so module hooks
 * don't each import `api` directly. */
export function useDataSource(): IClient {
  return api;
}
