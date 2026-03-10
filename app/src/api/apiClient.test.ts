// ---------------------------------------------------------------------------
// Tests for core logic patterns in apiClient.ts
//
// The real module has side effects (reads import.meta.env, creates singleton),
// so we replicate the pure logic here and test it in isolation.
// ---------------------------------------------------------------------------

// ---- Replicated helpers ------------------------------------------------

let _token: string | null = null;
const _dictParamsQueue: (Record<string, string> | null)[] = [];

function buildFetchArgs(input: RequestInfo | URL, init?: RequestInit): [string, RequestInit] {
     const headers = new Headers(init?.headers);

     if (_token) {
          headers.set('Authorization', `Bearer ${_token}`);
     }

     let url = typeof input === 'string' ? input : (input as Request).url;

     const pendingParams = _dictParamsQueue.shift() ?? null;
     if (pendingParams) {
          const urlObj = new URL(url);
          urlObj.searchParams.delete('Parameters');
          for (const [key, value] of Object.entries(pendingParams)) {
               urlObj.searchParams.set(key, value);
          }
          url = urlObj.toString();
     }

     return [url, { ...init, headers }];
}

function detectDictArg(args: unknown[]): Record<string, string> | undefined {
     return args.find(
          (a): a is Record<string, string> =>
               a !== null &&
               a !== undefined &&
               typeof a === 'object' &&
               Object.prototype.toString.call(a) === '[object Object]',
     );
}

function matchesEndpointMethod(prop: unknown, value: unknown): boolean {
     return typeof prop === 'string' && prop.includes('Endpoint') && typeof value === 'function';
}

// ---- Tests --------------------------------------------------------------

beforeEach(() => {
     _token = null;
     _dictParamsQueue.length = 0;
});

describe('buildFetchArgs', () => {
     const BASE = 'https://api.example.com';

     it('adds Bearer token when token is set', () => {
          _token = 'my-jwt-token';
          const [, opts] = buildFetchArgs(`${BASE}/endpoint`);
          const headers = new Headers(opts.headers);
          expect(headers.get('Authorization')).toBe('Bearer my-jwt-token');
     });

     it('does not add Authorization header when token is null', () => {
          _token = null;
          const [, opts] = buildFetchArgs(`${BASE}/endpoint`);
          const headers = new Headers(opts.headers);
          expect(headers.has('Authorization')).toBe(false);
     });

     it('preserves existing headers from init', () => {
          _token = 'tok';
          const [, opts] = buildFetchArgs(`${BASE}/endpoint`, {
               headers: { 'Content-Type': 'application/json', 'X-Custom': 'hello' },
          });
          const headers = new Headers(opts.headers);
          expect(headers.get('Content-Type')).toBe('application/json');
          expect(headers.get('X-Custom')).toBe('hello');
          expect(headers.get('Authorization')).toBe('Bearer tok');
     });

     it('rewrites URL when dict params are queued — removes Parameters and adds individual key-value pairs', () => {
          _dictParamsQueue.push({ Name: 'test', Status: 'active' });
          const inputUrl = `${BASE}/items?Parameters=%5Bobject%20Object%5D&PageSize=10`;

          const [url] = buildFetchArgs(inputUrl);
          const parsed = new URL(url);

          expect(parsed.searchParams.has('Parameters')).toBe(false);
          expect(parsed.searchParams.get('Name')).toBe('test');
          expect(parsed.searchParams.get('Status')).toBe('active');
          // Other params are preserved
          expect(parsed.searchParams.get('PageSize')).toBe('10');
     });

     it('consumes dict params from queue (second call is unaffected)', () => {
          _dictParamsQueue.push({ Key: 'value' });

          buildFetchArgs(`${BASE}/first`);
          expect(_dictParamsQueue.length).toBe(0);

          // Second call should NOT rewrite URL
          const [url2] = buildFetchArgs(`${BASE}/second?Parameters=foo`);
          const parsed2 = new URL(url2);
          expect(parsed2.searchParams.get('Parameters')).toBe('foo');
     });

     it('returns URL unchanged when queue is empty', () => {
          const inputUrl = `${BASE}/items?PageSize=10&Parameters=whatever`;
          const [url] = buildFetchArgs(inputUrl);
          expect(url).toBe(inputUrl);
     });

     it('handles Request input by extracting its url', () => {
          _token = 'tok';
          const request = new Request(`${BASE}/from-request`);
          const [url, opts] = buildFetchArgs(request);
          expect(url).toBe(`${BASE}/from-request`);
          const headers = new Headers(opts.headers);
          expect(headers.get('Authorization')).toBe('Bearer tok');
     });
});

describe('dict-param detection logic', () => {
     it('detects plain objects as dict args', () => {
          const result = detectDictArg([1, 'str', { Name: 'test' }]);
          expect(result).toEqual({ Name: 'test' });
     });

     it('does not detect null', () => {
          const result = detectDictArg([null, { Name: 'test' }]);
          expect(result).toEqual({ Name: 'test' });

          const resultOnlyNull = detectDictArg([null]);
          expect(resultOnlyNull).toBeUndefined();
     });

     it('does not detect undefined', () => {
          const result = detectDictArg([undefined]);
          expect(result).toBeUndefined();
     });

     it('does not detect AbortSignal instances', () => {
          const controller = new AbortController();
          const result = detectDictArg([controller.signal]);
          expect(result).toBeUndefined();
     });

     it('does not detect arrays', () => {
          const result = detectDictArg([['a', 'b']]);
          expect(result).toBeUndefined();
     });

     it('detects empty objects (truthy — copies to empty object)', () => {
          const dictArg = detectDictArg([{}]);
          expect(dictArg).toBeDefined();
          expect(dictArg).toEqual({});

          // Simulating what the proxy does: dictArg ? { ...dictArg } : null
          const pending = dictArg ? { ...dictArg } : null;
          expect(pending).toEqual({});
     });

     it('finds the first plain object when multiple are present', () => {
          const result = detectDictArg([{ A: '1' }, { B: '2' }]);
          expect(result).toEqual({ A: '1' });
     });
});

describe('proxy method matching', () => {
     const fn = () => {};

     it('matches method names containing "Endpoint" when value is a function', () => {
          expect(matchesEndpointMethod('getProductsListEndpoint', fn)).toBe(true);
     });

     it('matches method names like getProductsByClientHistoryEndpoint', () => {
          expect(matchesEndpointMethod('getProductsByClientHistoryEndpoint', fn)).toBe(true);
     });

     it('does not match method names without "Endpoint"', () => {
          expect(matchesEndpointMethod('someOtherMethod', fn)).toBe(false);
     });

     it('does not match when prop is not a string (e.g. symbol)', () => {
          expect(matchesEndpointMethod(Symbol('Endpoint'), fn)).toBe(false);
     });

     it('does not match when value is not a function', () => {
          expect(matchesEndpointMethod('baseUrlEndpoint', 'https://example.com')).toBe(false);
     });

     it('does not match non-function properties even with "Endpoint" in name', () => {
          expect(matchesEndpointMethod('getEndpointConfig', 42)).toBe(false);
     });
});
