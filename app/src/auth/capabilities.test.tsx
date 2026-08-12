import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { capabilitiesFromClaims, roleOfRoles, ROLE_CLAIM_LABELS } from './capabilities';
import { type UserRole } from './types';
import { AuthProvider, useAuth } from './AuthProvider';

describe('capabilitiesFromClaims', () => {
  it('allows everything when no capability is hidden', () => {
    const caps = capabilitiesFromClaims(['Manager'], []);
    expect(Object.values(caps).every(Boolean)).toBe(true);
  });

  it('hides exactly the keys the token names', () => {
    expect(capabilitiesFromClaims(['Driver'], ['Invoicing'])).toEqual({
      Invoicing: false,
      LoadingBreakdown: true,
    });
  });

  it('ignores an unknown claim key', () => {
    expect(capabilitiesFromClaims(['Driver'], ['Wizardry']).Invoicing).toBe(true);
  });

  // Money is in the backend Capability enum but not in the frontend registry (nothing
  // consumes it), so a claim naming it must be ignored the same as any other unknown key.
  it('ignores a Money claim key, since Money is not in the registry', () => {
    expect(capabilitiesFromClaims(['Driver'], ['Money'])).toEqual({
      Invoicing: true,
      LoadingBreakdown: true,
    });
  });

  it('lets Admin override any hidden key', () => {
    expect(capabilitiesFromClaims(['Admin'], ['Invoicing']).Invoicing).toBe(true);
  });

  // The backend matches capability_key case-insensitively (RoleCapabilityPolicy folds it with
  // OrdinalIgnoreCase) because nothing pins its casing to the enum name — a row written by a
  // direct DB edit or a seed, not just the admin screen, could carry any casing. The `cap`
  // claim carries that same string verbatim, so a case-sensitive match here would silently
  // un-hide a capability the backend is actively hiding and 403ing.
  it('hides a capability whose claim key differs only in casing', () => {
    expect(capabilitiesFromClaims(['Driver'], ['invoicing']).Invoicing).toBe(false);
  });
});

describe('roleOfRoles', () => {
  it.each<UserRole>(['Admin', 'Manager', 'Driver'])('resolves a single %s role to itself', (role) => {
    expect(roleOfRoles([role])).toBe(role);
  });

  // Regression guard for the Sidebar/AccountMenu bug this helper fixed: a driver must
  // never resolve to Manager, regardless of which order the claims arrive in. This would
  // fail if a future rewrite picked roles[0] (or any order-dependent strategy) instead of
  // an explicit Driver check.
  it.each<UserRole[][]>([[['Driver', 'Manager']], [['Manager', 'Driver']]])(
    'resolves a driver among managers to Driver (%j)',
    (roles) => {
      expect(roleOfRoles(roles)).toBe('Driver');
    }
  );

  // Matches capabilitiesFromClaims's Admin short-circuit — Admin must win even over a role
  // that would otherwise restrict. This fails if the Admin check is ever moved after the
  // Driver check.
  it('resolves Driver+Admin to Admin, not Driver', () => {
    expect(roleOfRoles(['Driver', 'Admin'])).toBe('Admin');
  });

  it('resolves no roles to Manager', () => {
    expect(roleOfRoles([])).toBe('Manager');
  });
});

describe('ROLE_CLAIM_LABELS', () => {
  it.each<[UserRole, string]>([
    ['Admin', 'Administrátor'],
    ['Manager', 'Manažer'],
    ['Driver', 'Řidič'],
  ])('labels %s in Czech as %s', (role, label) => {
    expect(ROLE_CLAIM_LABELS[role]).toBe(label);
  });
});

// A working Storage — see dataTableModel.test.ts's memoryStorage for why this is
// needed: under happy-dom, localStorage/sessionStorage are bare objects whose
// getItem/setItem are undefined, so AuthProvider's unguarded storage reads on
// mount would throw rather than exercise the real derivation.
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
  };
}

const CLAIM_ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/** A token only has to survive jwtDecode — same helper as jwt.test.ts. */
function tokenWith(payload: Record<string, unknown>): string {
  const encode = (part: object) =>
    btoa(JSON.stringify(part)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function seedSession(roles: string | string[]) {
  const token = tokenWith({ [CLAIM_ROLE]: roles, exp: Math.floor(Date.now() / 1000) + 3600 });
  localStorage.setItem('authToken', token);
  localStorage.setItem('refreshToken', 'refresh-token');
}

function DriverScopedProbe() {
  const { isDriverScoped } = useAuth();
  return <span data-testid="scoped">{String(isDriverScoped)}</span>;
}

function renderWithAuth() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <DriverScopedProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('driver scoping', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Exercises AuthProvider's actual isDriverScoped derivation end to end (token →
  // userFromToken → roleOfRoles), rather than asserting roleOfRoles against
  // itself — the frontend half of the driver on/off switch.
  it('scopes a Driver-only account', () => {
    seedSession('Driver');

    renderWithAuth();

    expect(screen.getByTestId('scoped').textContent).toBe('true');
  });

  it('does not scope an admin who also holds Driver', () => {
    seedSession(['Driver', 'Admin']);

    renderWithAuth();

    expect(screen.getByTestId('scoped').textContent).toBe('false');
  });

  it('does not scope a Manager account', () => {
    seedSession('Manager');

    renderWithAuth();

    expect(screen.getByTestId('scoped').textContent).toBe('false');
  });
});
