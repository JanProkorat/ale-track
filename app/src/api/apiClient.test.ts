import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { fixDateOnlyParams as FixDateOnlyParams } from './apiClient';

// apiClient.ts throws at module load if VITE_API_BASE_URL is unset (it's the
// real client singleton, not a mockable module) — this repo's test env has no
// .env file, so the env var must be stubbed before the dynamic import below.
let fixDateOnlyParams: typeof FixDateOnlyParams;

beforeAll(async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8080');
  ({ fixDateOnlyParams } = await import('./apiClient'));
});

describe('fixDateOnlyParams', () => {
  it('trims a full ISO instant on From to the calendar day', () => {
    const url = 'http://localhost:8080/ale-track/reports/operations?From=2026-07-25T00%3A00%3A00.000Z';
    expect(fixDateOnlyParams(url)).toBe('http://localhost:8080/ale-track/reports/operations?From=2026-07-25');
  });

  it('leaves a bare YYYY-MM-DD value alone', () => {
    const url = 'http://localhost:8080/ale-track/reports/operations?From=2026-07-25';
    expect(fixDateOnlyParams(url)).toBe(url);
  });

  it('trims both From and To in the same URL', () => {
    const url =
      'http://localhost:8080/ale-track/reports/client-volume?From=2026-04-26T00%3A00%3A00.000Z&To=2026-07-25T00%3A00%3A00.000Z';
    expect(fixDateOnlyParams(url)).toBe(
      'http://localhost:8080/ale-track/reports/client-volume?From=2026-04-26&To=2026-07-25'
    );
  });

  it('does not touch an unrelated query param that merely looks date-like', () => {
    const url = 'http://localhost:8080/ale-track/some-endpoint?Note=2026-07-25T00%3A00%3A00.000Z';
    expect(fixDateOnlyParams(url)).toBe(url);
  });
});
