import { Client } from 'src/generated/api-client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!BASE_URL) {
  throw new Error('VITE_API_BASE_URL není definováno — zkopírujte env.example do .env.');
}

// ---- token state (set by AuthProvider) ---------------------------------------
let accessToken: string | null = null;
let refreshToken: string | null = null;
let onAuthFailed: (() => void) | null = null;
let onTokensRefreshed: ((access: string, refresh: string) => void) | null = null;

export function setApiTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
}
export function setAuthFailedHandler(fn: (() => void) | null) {
  onAuthFailed = fn;
}
export function setTokensRefreshedHandler(fn: ((access: string, refresh: string) => void) | null) {
  onTokensRefreshed = fn;
}

// ---- NSwag dictionary-query-param fix ----------------------------------------
// Generated *List* endpoints serialize the filter dict as `Parameters=[object
// Object]`. We stash the real dict on the way in and rebuild the query
// (`Parameters[key]=value`) in the fetch layer. JS is single-threaded and the
// method builds its URL and calls fetch synchronously, so this is call-scoped.
let pendingListParams: Record<string, string> | null = null;

function fixParamsUrl(u: string): string {
  if (pendingListParams && u.includes('Parameters=')) {
    const dict = pendingListParams;
    pendingListParams = null;
    const q = Object.entries(dict)
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `Parameters[${encodeURIComponent(k)}]=${encodeURIComponent(v)}`)
      .join('&');
    return u.replace(/Parameters=[^&]*/, q).replace(/[?&]$/, '');
  }
  return u;
}

// ---- DateOnly query-param fix -------------------------------------------------
// NSwag types the reports' `DateOnly` query params as `Date` and serializes them with
// `toISOString()`, producing a full instant (`2026-07-25T00:00:00.000Z`). `DateOnly.TryParse`
// rejects that, so the report endpoints would fail to bind. Trim them to the calendar day.
// `From`/`To` are emitted only by the three report endpoints, so this rewrite is scoped.
export function fixDateOnlyParams(u: string): string {
  return u.replace(/([?&](?:From|To)=)(\d{4}-\d{2}-\d{2})T[^&]*/g, '$1$2');
}

// ---- silent refresh (deduped) ------------------------------------------------
let refreshPromise: Promise<boolean> | null = null;

function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${BASE_URL}/ale-track/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      onTokensRefreshed?.(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// ---- authorized fetch --------------------------------------------------------
async function authorizedFetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
  const target = fixDateOnlyParams(fixParamsUrl(typeof url === 'string' ? url : (url as Request).url));

  const doFetch = () => {
    const headers = new Headers(init?.headers);
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    // `no-store`: the API sends no cache headers of its own, so nothing but this stops a
    // browser (or anything between us and it) from answering a GET out of the HTTP cache
    // and showing one user another's stale counts after a plain reload. Nothing here is
    // revalidatable anyway — there are no ETags to make a conditional request with.
    return fetch(target, { ...init, headers, cache: 'no-store' });
  };

  let res = await doFetch();
  if (res.status === 401 && refreshToken) {
    const ok = await refreshAccessToken();
    if (ok) {
      res = await doFetch();
    } else {
      onAuthFailed?.();
    }
  }
  return res;
}

// ---- client singleton (proxied for the params fix) ---------------------------
const raw = new Client(BASE_URL, { fetch: authorizedFetch });

export const api = new Proxy(raw, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== 'function') return value;
    // Any endpoint taking a filter dictionary (list endpoints, product history,
    // …) serializes it as `Parameters=[object Object]`. Detect a plain-object
    // arg (DTOs are class instances, so excluded) and stash it for the fetch
    // layer; reset per call so it never leaks to the next request. fixParamsUrl
    // only rewrites when the built URL actually contains `Parameters=`.
    if (typeof prop === 'string' && prop.endsWith('Endpoint')) {
      return (...args: unknown[]) => {
        const dict = args.find(
          (a) => a != null && typeof a === 'object' && (a as object).constructor === Object
        ) as Record<string, string> | undefined;
        pendingListParams = dict ?? null;
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    }
    return value.bind(target);
  },
}) as Client;
