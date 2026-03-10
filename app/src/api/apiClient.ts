import { Client, RefreshTokenDto } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

let _token: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<boolean> | null = null;

/** Called when tokens should be updated (login, refresh) or cleared (logout). */
let _onTokenRefreshed: ((accessToken: string, refreshToken: string) => void) | null = null;
let _onAuthFailed: (() => void) | null = null;

export function setApiToken(token: string | null) {
     _token = token;
}

export function getApiToken(): string | null {
     return _token;
}

export function setRefreshToken(token: string | null) {
     _refreshToken = token;
}

/** Register callbacks so the fetch layer can update AuthProvider state. */
export function setAuthCallbacks(
     onRefreshed: (accessToken: string, refreshToken: string) => void,
     onFailed: () => void,
) {
     _onTokenRefreshed = onRefreshed;
     _onAuthFailed = onFailed;
}

// ---------------------------------------------------------------------------
// NSwag dict-parameter fix
// ---------------------------------------------------------------------------
// The generated Client serialises Dictionary<string,string> parameters as a
// single `Parameters=[object Object]` query-param instead of individual
// key-value pairs. We intercept calls to *ListEndpoint methods via a Proxy,
// capture the dict argument, and rewrite the URL inside the fetch wrapper.

let _pendingDictParams: Record<string, string> | null = null;

// ---------------------------------------------------------------------------
// Authorized fetch — injects JWT Bearer header + fixes dict params
// ---------------------------------------------------------------------------

function buildFetchArgs(input: RequestInfo | URL, init?: RequestInit): [string, RequestInit] {
     const headers = new Headers(init?.headers);

     if (_token) {
          headers.set('Authorization', `Bearer ${_token}`);
     }

     let url = typeof input === 'string' ? input : (input as Request).url;

     // Fix NSwag dict-parameter serialization
     if (_pendingDictParams) {
          const params = _pendingDictParams;
          _pendingDictParams = null;

          const urlObj = new URL(url);
          urlObj.searchParams.delete('Parameters');
          for (const [key, value] of Object.entries(params)) {
               urlObj.searchParams.set(key, value);
          }
          url = urlObj.toString();
     }

     return [url, { ...init, headers }];
}

/** Try to refresh the access token. Returns true on success. */
async function tryRefresh(): Promise<boolean> {
     if (!_refreshToken) return false;

     try {
          const dto = new RefreshTokenDto();
          dto.refreshToken = _refreshToken;

          const body = JSON.stringify(dto.toJSON());
          const res = await window.fetch(`${BASE_URL}/ale-track/refresh`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
               body,
          });

          if (!res.ok) return false;

          const data = await res.json();
          const newAccess = data.accessToken as string | undefined;
          const newRefresh = data.refreshToken as string | undefined;

          if (!newAccess || !newRefresh) return false;

          _token = newAccess;
          _refreshToken = newRefresh;
          _onTokenRefreshed?.(newAccess, newRefresh);
          return true;
     } catch {
          return false;
     }
}

const authorizedFetch: typeof window.fetch = async (input, init) => {
     const [url, opts] = buildFetchArgs(input, init);
     const response = await window.fetch(url, opts);

     // Don't try refresh for the refresh endpoint itself
     if (response.status !== 401 || url.includes('/ale-track/refresh')) {
          return response;
     }

     // 401 — attempt silent refresh (deduplicate concurrent attempts)
     if (!_refreshPromise) {
          _refreshPromise = tryRefresh().finally(() => {
               _refreshPromise = null;
          });
     }

     const refreshed = await _refreshPromise;

     if (refreshed) {
          // Retry the original request with the new token
          const [retryUrl, retryOpts] = buildFetchArgs(input, init);
          return window.fetch(retryUrl, retryOpts);
     }

     // Refresh failed — force logout
     _onAuthFailed?.();
     return response;
};

// ---------------------------------------------------------------------------
// Singleton API client
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!BASE_URL) {
     throw new Error('VITE_API_BASE_URL is not defined. Check your .env file.');
}

const rawClient = new Client(BASE_URL, { fetch: authorizedFetch });

// Proxy intercepts *Endpoint calls that receive a dict argument to capture it
// so authorizedFetch can rebuild the URL with proper query params.
export const apiClient = new Proxy(rawClient, {
     get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);

          if (
               typeof prop === 'string' &&
               prop.includes('Endpoint') &&
               typeof value === 'function'
          ) {
               return (...args: unknown[]) => {
                    // Find the dictionary argument (plain object, not AbortSignal)
                    const dictArg = args.find(
                         (a): a is Record<string, string> =>
                              a !== null &&
                              a !== undefined &&
                              typeof a === 'object' &&
                              Object.prototype.toString.call(a) === '[object Object]',
                    );
                    _pendingDictParams = dictArg ? { ...dictArg } : null;
                    return (value as (...a: unknown[]) => unknown).apply(target, args);
               };
          }

          if (typeof value === 'function') return value.bind(target);
          return value;
     },
});
