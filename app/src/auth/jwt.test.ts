import { describe, expect, it } from 'vitest';
import { userFromToken } from './jwt';
import { capabilitiesFor } from './capabilities';

const CLAIM_ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const CLAIM_NAME = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name';

/** A token only has to survive jwtDecode, which reads the payload without verifying. */
function tokenWith(payload: Record<string, unknown>): string {
  const encode = (part: object) =>
    btoa(JSON.stringify(part)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('userFromToken', () => {
  it('keeps a Driver role claim', () => {
    const user = userFromToken(tokenWith({ [CLAIM_NAME]: 'novak', [CLAIM_ROLE]: 'Driver' }));

    expect(user?.roles).toEqual(['Driver']);
  });

  // The regression this guards: the role filter used to accept only Admin|Manager, so a
  // Driver claim was dropped and the ['Manager'] fallback took over — the account decoded
  // as unrestricted and every capability check passed. Failing open, silently.
  it('does not let a driver decode as an unrestricted user', () => {
    const user = userFromToken(tokenWith({ [CLAIM_NAME]: 'novak', [CLAIM_ROLE]: 'Driver' }));

    expect(user?.roles).not.toContain('Manager');
    expect(capabilitiesFor(user!.roles).invoicing).toBe(false);
  });

  it('keeps multiple role claims', () => {
    const user = userFromToken(tokenWith({ [CLAIM_ROLE]: ['Manager', 'Driver'] }));

    expect(user?.roles).toEqual(['Manager', 'Driver']);
  });

  it('drops an unrecognised role and falls back to Manager when nothing survives', () => {
    const user = userFromToken(tokenWith({ [CLAIM_ROLE]: 'Wizard' }));

    expect(user?.roles).toEqual(['Manager']);
  });

  it('falls back to Manager for a token carrying the pre-rename User claim', () => {
    const user = userFromToken(tokenWith({ [CLAIM_ROLE]: 'User' }));

    // "User" is no longer a known role, so it is dropped and the fallback applies.
    // That lands old sessions on Manager, which is what they were — no forced re-login.
    expect(user?.roles).toEqual(['Manager']);
  });

  it('returns null for a token it cannot decode', () => {
    expect(userFromToken('not-a-token')).toBeNull();
  });
});
