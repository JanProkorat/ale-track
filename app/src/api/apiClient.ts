import { Client } from 'src/generated/api-client';

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

let _token: string | null = null;

export function setApiToken(token: string | null) {
     _token = token;
}

export function getApiToken(): string | null {
     return _token;
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

const authorizedFetch: typeof window.fetch = (input, init) => {
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

     return window.fetch(url, { ...init, headers });
};

// ---------------------------------------------------------------------------
// Singleton API client
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!BASE_URL) {
     throw new Error('VITE_API_BASE_URL is not defined. Check your .env file.');
}

const rawClient = new Client(BASE_URL, { fetch: authorizedFetch });

// Proxy intercepts *ListEndpoint calls to capture the dict argument
// so authorizedFetch can rebuild the URL with proper query params.
export const apiClient = new Proxy(rawClient, {
     get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);

          if (
               typeof prop === 'string' &&
               prop.includes('Endpoint') &&
               prop.includes('List') &&
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
