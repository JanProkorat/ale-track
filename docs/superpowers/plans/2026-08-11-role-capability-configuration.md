# Configurable Role Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move role→capability policy out of code into an editable `role_capabilities` table with an admin screen, and rename `UserRoleType.User` to `Manager`.

**Architecture:** Roles stay a C# enum; what each role may see becomes DB data. `CapabilityHandler` reads that table through a cached reader (authoritative, fresh per request). `JwtService` stamps hidden keys as `cap` claims, so the frontend reads policy from its own token and its hardcoded mirror is deleted. A `/users/roles` screen edits the table.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, React 19, MUI 7, TanStack Query 5, Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-11-role-capability-configuration-design.md`. Phase 1 (`2026-08-10-role-based-content-visibility-design.md`) is already implemented in commit `ee12d1e`.
- **Branch:** work on `feature/role-capability-config` (already checked out). Never commit to `dev`.
- **Czech UI, English code.** Every user-visible string in Czech; comments and identifiers English.
- **Enums are stored as integers** in this database (there is no `HaveConversion<string>()`; `user_roles.type` is `integer`, and the `Init` seed writes `Type = 0`). Renaming an enum member is therefore a code-only change — **no data migration for the rename**.
- **Enums cross the wire as strings** (`JsonStringEnumConverter`, `Program.cs:44`), so backend and frontend must land together and `yarn generate-api` is part of the work.
- **Default-allow:** a missing `role_capabilities` row means visible. `Admin` is never stored and never editable.
- **Never edit `app/src/generated/api-client.ts` by hand** — regenerate it.
- Backend commands run from `api/AleTrack/`; frontend from `app/` with **yarn**.
- Verification: `dotnet build AleTrack.sln`, `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`, `yarn typecheck`, `yarn test:run`, `yarn lint`, `yarn build`. Baseline at the start of this plan: **753 backend tests, 692 frontend tests, 0 lint errors, 4 pre-existing lint warnings** (`react-refresh/only-export-components` on four provider files).

---

### Task 1: Rename `UserRoleType.User` to `Manager`

Pure rename plus two display bugs it exposes: `Sidebar.tsx:197` and `AccountMenu.tsx:46` hardcode `roles.includes('Admin') ? 'Administrátor' : 'Uživatel'`, so a driver currently displays as "Uživatel". Both switch to the shared label table.

**Files:**
- Modify: `api/AleTrack/AleTrack/Common/Enums/UserRoleType.cs`
- Modify: `api/AleTrack/AleTrack/Common/Utils/AuthenticationExtensions.cs:54-55`
- Modify: `api/AleTrack/AleTrack.Tests/Builders/UserBuilder.cs:28,46`
- Modify: `api/AleTrack/AleTrack.Tests/Features/Users/CreateUserTests.cs:28`
- Modify: `api/AleTrack/AleTrack.Tests/Features/Users/UpdateUserTests.cs:24,36`
- Modify: `api/AleTrack/AleTrack.Tests/Features/Users/LoginTests.cs:40`
- Modify: `api/AleTrack/AleTrack.Tests/Common/Authorization/RoleCapabilitiesTests.cs:25`
- Modify: `api/AleTrack/AleTrack.Tests/Common/Authorization/CapabilityHandlerTests.cs:47,66,69`
- Modify: `app/src/auth/types.ts:3`, `app/src/auth/jwt.ts:28,66,75`
- Modify: `app/src/auth/capabilities.ts` (the `UserRole` keys), `app/src/auth/permissions.ts` (stale comment naming "Admin/User roles")
- Modify: `app/src/features/users/permissionModel.ts:76,80,93`
- Modify: `app/src/features/users/UserFormDrawer.tsx:31,53,71`
- Modify: `app/src/features/users/UsersPage.tsx:27,150`
- Modify: `app/src/layout/Sidebar.tsx:197`, `app/src/layout/AccountMenu.tsx:46`
- Modify: `app/src/auth/jwt.test.ts`, `app/src/auth/capabilities.test.ts`, `app/src/features/users/permissionModel.test.ts`
- Regenerate: `app/src/generated/api-client.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `UserRoleType.Manager` (C#, value `1` — unchanged position); `UserRole = 'Admin' | 'Manager' | 'Driver'` (TS); `ROLE_LABELS[UserRoleType.Manager] === 'Manažer'`; `roleOf(user)` unchanged signature, returning `UserRoleType.Manager` as its default.

- [ ] **Step 1: Write the failing frontend tests**

In `app/src/features/users/permissionModel.test.ts`, replace every `UserRoleType.User` with `UserRoleType.Manager` and update the label expectation:

```ts
describe('ROLE_LABELS', () => {
  it('labels every assignable role in Czech', () => {
    expect(ASSIGNABLE_ROLES.map((r) => ROLE_LABELS[r])).toEqual([
      'Administrátor',
      'Manažer',
      'Řidič',
    ]);
  });
});
```

In `app/src/auth/jwt.test.ts`, the old-token transition is worth pinning explicitly — an already-issued token carries the string `"User"`, which is no longer a known role:

```ts
it('falls back to Manager for a token carrying the pre-rename User claim', () => {
  const user = userFromToken(tokenWith({ [CLAIM_ROLE]: 'User' }));

  // "User" is no longer a known role, so it is dropped and the fallback applies.
  // That lands old sessions on Manager, which is what they were — no forced re-login.
  expect(user?.roles).toEqual(['Manager']);
});
```

Also replace `['User']` with `['Manager']` in the existing fallback test and in `capabilities.test.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn --cwd app test:run src/features/users/permissionModel.test.ts src/auth/jwt.test.ts`
Expected: FAIL — `Property 'Manager' does not exist on type 'typeof UserRoleType'`, and `'Manažer'` not matching `'Uživatel'`.

- [ ] **Step 3: Rename on the backend**

In `UserRoleType.cs`, rename the member and fix the `Driver` doc comment that refers to it:

```csharp
    /// <summary>
    /// Represents a standard office user with basic access and permissions.
    /// </summary>
    Manager,

    /// <summary>
    /// A driver in the field. Granted access through the same permission matrix as
    /// <see cref="Manager"/>, but denied the capabilities in
    /// <see cref="Authorization.RoleCapabilities"/> — invoicing, the loading breakdown
    /// and money — so the shipment screen shows only what is needed on the road.
    /// </summary>
    Driver
```

In `AuthenticationExtensions.cs:54-55`:

```csharp
            .AddPolicy(nameof(UserRoleType.Manager), policy =>
                policy.RequireRole(nameof(UserRoleType.Manager), nameof(UserRoleType.Admin)));
```

Then replace `UserRoleType.User` with `UserRoleType.Manager` in the five test files listed above.

- [ ] **Step 4: Verify the backend**

Run: `dotnet build /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.sln`
Expected: 0 errors.

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj`
Expected: 753 passed, 0 failed.

- [ ] **Step 5: Start the backend and regenerate the client**

The generator reads the live swagger doc, so the backend must be listening on **8080** and nothing else may hold that port (an unrelated container on 8080 silently generates the wrong client). `applicationUrl` for both profiles is already 8080.

```bash
dotnet run --project /Users/jan/Projects/ale-track/api/AleTrack/AleTrack --launch-profile Dev
# in another shell:
yarn --cwd /Users/jan/Projects/ale-track/app generate-api
```

Note: `Program.cs` currently calls `ApplyMigrationsAsync()` unconditionally, so the `Dev` profile applies pending migrations to the shared Supabase database on boot. At this task there are none pending; from Task 2 onward there will be, so prefer a local database from then on.

Verify: `grep -n "enum UserRoleType" -A 5 app/src/generated/api-client.ts` shows `Admin = 0, Manager = 1, Driver = 2`.

- [ ] **Step 6: Rename on the frontend**

`app/src/auth/types.ts`:

```ts
export type UserRole = 'Admin' | 'Manager' | 'Driver';
```

`app/src/auth/jwt.ts` — the constant, the comment, and the fallback:

```ts
const KNOWN_ROLES: readonly UserRole[] = ['Admin', 'Manager', 'Driver'];
```

```ts
      roles: roles.length ? roles : ['Manager'],
```

`app/src/features/users/permissionModel.ts`:

```ts
export const ASSIGNABLE_ROLES = [UserRoleType.Admin, UserRoleType.Manager, UserRoleType.Driver] as const;

export const ROLE_LABELS: Record<UserRoleType, string> = {
  [UserRoleType.Admin]: 'Administrátor',
  [UserRoleType.Manager]: 'Manažer',
  [UserRoleType.Driver]: 'Řidič',
};
```

and in `roleOf`, `return UserRoleType.Manager;`.

Update the `UsersPage.tsx` sort comment, which names the old label:

```tsx
      // Sorted by the label on screen: Administrátor, then Manažer, then Řidič.
```

Then fix the two hardcoded labels. `app/src/layout/Sidebar.tsx:197` and `app/src/layout/AccountMenu.tsx:46` both become:

```tsx
{user ? ROLE_LABELS[roleOfRoles(user.roles)] : ''}
```

Add the helper beside `capabilitiesFor` in `app/src/auth/capabilities.ts`, since these two call sites hold `UserRole[]` from the token rather than a `UserListItemDto`:

```ts
/** Most privileged of a claim's roles, matching permissionModel.roleOf for DTOs. */
export function roleOfRoles(roles: readonly UserRole[]): UserRole {
  if (roles.includes('Admin')) return 'Admin';
  if (roles.includes('Driver')) return 'Driver';
  return 'Manager';
}
```

`ROLE_LABELS` is keyed by the numeric `UserRoleType`, so add a string-keyed companion in `capabilities.ts` rather than importing the users feature into the layout:

```ts
export const ROLE_CLAIM_LABELS: Record<UserRole, string> = {
  Admin: 'Administrátor',
  Manager: 'Manažer',
  Driver: 'Řidič',
};
```

and use `ROLE_CLAIM_LABELS[roleOfRoles(user.roles)]` at both call sites.

- [ ] **Step 7: Verify the frontend**

Run: `yarn --cwd app typecheck && yarn --cwd app test:run && yarn --cwd app lint`
Expected: typecheck clean; 693 passed (one new test); 0 lint errors, 4 pre-existing warnings.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Common/Enums/UserRoleType.cs \
        api/AleTrack/AleTrack/Common/Utils/AuthenticationExtensions.cs \
        api/AleTrack/AleTrack.Tests/Builders/UserBuilder.cs \
        api/AleTrack/AleTrack.Tests/Features/Users/CreateUserTests.cs \
        api/AleTrack/AleTrack.Tests/Features/Users/UpdateUserTests.cs \
        api/AleTrack/AleTrack.Tests/Features/Users/LoginTests.cs \
        api/AleTrack/AleTrack.Tests/Common/Authorization/RoleCapabilitiesTests.cs \
        api/AleTrack/AleTrack.Tests/Common/Authorization/CapabilityHandlerTests.cs \
        app/src/generated/api-client.ts app/src/auth app/src/features/users app/src/layout/Sidebar.tsx app/src/layout/AccountMenu.tsx
git commit -m "refactor: rename the User role to Manager"
```

---

### Task 2: `role_capabilities` table

**Files:**
- Create: `api/AleTrack/AleTrack/Entities/RoleCapability.cs`
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/RoleCapabilityConfiguration.cs`
- Modify: `api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs` (add the `DbSet`)
- Create: migration `AddRoleCapabilities` under `api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/`

**Interfaces:**
- Consumes: `UserRoleType.Manager` from Task 1.
- Produces: `RoleCapability { UserRoleType Role; string CapabilityKey; bool IsVisible; }`, `dbContext.RoleCapabilities`, and three seeded `Driver` denial rows (`invoicing`, `loadingBreakdown`, `money`).

- [ ] **Step 1: Write the entity**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;

namespace AleTrack.Entities;

/// <summary>
/// Visibility of one <see cref="Capability"/> for one <see cref="UserRoleType"/>. The table is
/// default-allow: the absence of a row means the capability is visible, so adding a capability
/// cannot accidentally hide it from every role. Admin is never stored — it bypasses capabilities.
/// </summary>
[Table("role_capabilities")]
public sealed class RoleCapability : BaseEntity
{
    /// <summary>
    /// The role this row applies to.
    /// </summary>
    [Column("role")]
    public UserRoleType Role { get; set; }

    /// <summary>
    /// Key of the capability. Matches a <see cref="Capability"/> name for capabilities enforced
    /// server-side, or a frontend-only key for cosmetic ones.
    /// </summary>
    [Required]
    [MaxLength(64)]
    [Column("capability_key")]
    public string CapabilityKey { get; set; } = null!;

    /// <summary>
    /// Whether the role may see it.
    /// </summary>
    [Column("is_visible")]
    public bool IsVisible { get; set; }
}
```

- [ ] **Step 2: Write the configuration**

```csharp
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps <see cref="RoleCapability"/>. One row per (role, capability) at most.
/// </summary>
public sealed class RoleCapabilityConfiguration : IEntityTypeConfiguration<RoleCapability>
{
    public void Configure(EntityTypeBuilder<RoleCapability> builder)
    {
        builder.HasIndex(x => new { x.Role, x.CapabilityKey }).IsUnique();
    }
}
```

Add to `AleTrackDbContext`:

```csharp
    public DbSet<RoleCapability> RoleCapabilities => Set<RoleCapability>();
```

- [ ] **Step 3: Generate the migration**

```bash
dotnet ef migrations add AddRoleCapabilities --project /Users/jan/Projects/ale-track/api/AleTrack/AleTrack
```

- [ ] **Step 4: Add the seed to the generated migration's `Up`**

Seed with raw SQL rather than `HasData`, deliberately: `HasData` needs explicit primary keys, and fixed ids on a table the application also inserts into leave the Postgres identity sequence behind them, so the first user-created row collides. Letting identity assign keeps the sequence correct.

`role` is an **integer** column (this project stores enums as ints), so `2` is `UserRoleType.Driver`.

Keys are **PascalCase, matching the `Capability` enum member names** — `CapabilityHandler`
(Task 3) looks up `requirement.Capability.ToString()`, so any other casing would need a mapping
layer to match:

```csharp
            // Driver's phase-1 denials, so this migration is behaviour-neutral.
            // role = 2 is UserRoleType.Driver; keys match Capability enum names.
            migrationBuilder.Sql(
                """
                INSERT INTO role_capabilities (role, capability_key, is_visible)
                VALUES (2, 'Invoicing', false),
                       (2, 'LoadingBreakdown', false),
                       (2, 'Money', false);
                """);
```

and in `Down`, before the table drop EF generated:

```csharp
            migrationBuilder.Sql("DELETE FROM role_capabilities WHERE role = 2;");
```

- [ ] **Step 5: Read the generated SQL before trusting it**

Run: `dotnet ef migrations script --project /Users/jan/Projects/ale-track/api/AleTrack/AleTrack --from <previous-migration-name>`
Expected: a `CREATE TABLE role_capabilities`, a unique index on `(role, capability_key)`, the three inserts, and **no** `DROP`/`ALTER` touching any other table. If anything else appears, stop and investigate before applying.

- [ ] **Step 6: Apply against a local database and verify**

```bash
dotnet ef database update --project /Users/jan/Projects/ale-track/api/AleTrack/AleTrack \
  --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"
```

Expected: applies cleanly, and `SELECT * FROM role_capabilities;` returns the three `Driver` rows.

- [ ] **Step 7: Verify the build**

Run: `dotnet build /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.sln`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/RoleCapability.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/RoleCapabilityConfiguration.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations
git commit -m "feat: store role capability visibility in the database"
```

---

### Task 3: Read the policy from the database

**Files:**
- Create: `api/AleTrack/AleTrack/Common/Authorization/RoleCapabilityPolicy.cs`
- Create: `api/AleTrack/AleTrack.Tests/Common/Authorization/RoleCapabilityPolicyTests.cs`
- Modify: `api/AleTrack/AleTrack/Common/Authorization/CapabilityHandler.cs`
- Modify: `api/AleTrack/AleTrack/Common/Utils/AuthenticationExtensions.cs:49-50`
- Rewrite: `api/AleTrack/AleTrack.Tests/Common/Authorization/CapabilityHandlerTests.cs`
- Delete: `api/AleTrack/AleTrack/Common/Authorization/RoleCapabilities.cs` and `api/AleTrack/AleTrack.Tests/Common/Authorization/RoleCapabilitiesTests.cs`

**Interfaces:**
- Consumes: `dbContext.RoleCapabilities` (Task 2).
- Produces: `RoleCapabilityPolicy.GetHiddenKeysAsync(UserRoleType role, CancellationToken ct) → Task<IReadOnlySet<string>>`, `RoleCapabilityPolicy.Invalidate()`, and `RoleCapabilityPolicy.CacheKey`. Task 4 and Task 5 both depend on this type.

- [ ] **Step 1: Write the failing policy test**

`AleTrack.Tests` mocks the DbContext with Moq.EntityFrameworkCore (see `UserBuilder` and the existing feature tests for the established shape).

```csharp
using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Common.Authorization;

/// <summary>
/// The cached read of role_capabilities. Default-allow is the load-bearing behaviour: a
/// capability with no row must come back visible.
/// </summary>
public sealed class RoleCapabilityPolicyTests
{
    private static RoleCapabilityPolicy PolicyOver(params RoleCapability[] rows)
    {
        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(rows);

        return new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions()));
    }

    [Fact]
    public async Task GetHiddenKeysAsync_RowIsNotVisible_KeyIsHidden()
    {
        var policy = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None))
            .Should().BeEquivalentTo(["invoicing"]);
    }

    [Fact]
    public async Task GetHiddenKeysAsync_RowIsVisible_KeyIsNotHidden()
    {
        var policy = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = true
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Driver, CancellationToken.None))
            .Should().BeEmpty();
    }

    [Fact]
    public async Task GetHiddenKeysAsync_NoRowsForRole_HidesNothing()
    {
        var policy = PolicyOver(new RoleCapability
        {
            Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false
        });

        (await policy.GetHiddenKeysAsync(UserRoleType.Manager, CancellationToken.None))
            .Should().BeEmpty();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~RoleCapabilityPolicyTests"`
Expected: FAIL — `RoleCapabilityPolicy` does not exist.

- [ ] **Step 3: Write the policy**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AleTrack.Common.Authorization;

/// <summary>
/// The authoritative read of role → hidden capability keys, cached because it is consulted on
/// every gated request and the table is a handful of rows. Default-allow: only rows explicitly
/// marked not visible are returned.
/// </summary>
public sealed class RoleCapabilityPolicy(AleTrackDbContext dbContext, IMemoryCache cache)
{
    /// <summary>
    /// Cache key holding the whole table as a role → hidden-keys map.
    /// </summary>
    public const string CacheKey = "role-capabilities";

    /// <summary>
    /// Capability keys <paramref name="role"/> may not see.
    /// </summary>
    public async Task<IReadOnlySet<string>> GetHiddenKeysAsync(UserRoleType role, CancellationToken ct)
    {
        var map = await GetMapAsync(ct);

        return map.TryGetValue(role, out var hidden) ? hidden : new HashSet<string>();
    }

    /// <summary>
    /// Drops the cached map so the next read reflects a saved change.
    /// </summary>
    public void Invalidate() => cache.Remove(CacheKey);

    private async Task<Dictionary<UserRoleType, HashSet<string>>> GetMapAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey, out Dictionary<UserRoleType, HashSet<string>>? cached) && cached is not null)
        {
            return cached;
        }

        var hiddenRows = await dbContext.RoleCapabilities
            .AsNoTracking()
            .Where(x => !x.IsVisible)
            .Select(x => new { x.Role, x.CapabilityKey })
            .ToListAsync(ct);

        var map = hiddenRows
            .GroupBy(x => x.Role)
            .ToDictionary(g => g.Key, g => g.Select(x => x.CapabilityKey).ToHashSet(StringComparer.Ordinal));

        cache.Set(CacheKey, map);

        return map;
    }
}
```

- [ ] **Step 4: Run the policy tests**

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~RoleCapabilityPolicyTests"`
Expected: 3 passed.

- [ ] **Step 5: Rewrite the handler test against the policy**

Replace the body of `CapabilityHandlerTests.cs`. The `SucceedsAsync` helper now builds a policy over rows instead of relying on a static table; keep every case the old file covered (admin bypass, plain role allowed, driver denied, deny-if-any-denies, admin-wins-over-driver, and no-roles-passes-because-authentication-is-the-policy's-job):

```csharp
    private static async Task<bool> SucceedsAsync(
        Capability capability,
        RoleCapability[] rows,
        params UserRoleType[] roles)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            roles.Select(r => new Claim(ClaimTypes.Role, r.ToString())),
            authenticationType: "Test",
            nameType: ClaimTypes.Name,
            roleType: ClaimTypes.Role));

        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(rows);
        var policy = new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions()));

        var requirement = new CapabilityRequirement(capability);
        var context = new AuthorizationHandlerContext([requirement], principal, resource: null);

        await new CapabilityHandler(policy).HandleAsync(context);

        return context.HasSucceeded;
    }

    private static RoleCapability[] DriverDeniedInvoicing() =>
    [
        new() { Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = false }
    ];
```

Add one case the static table could not express:

```csharp
    /// <summary>
    /// The point of moving policy into the database: a row flipped to visible lets the role
    /// through without a deploy.
    /// </summary>
    [Fact]
    public async Task HandleAsync_DriverRowFlippedToVisible_Succeeds()
    {
        RoleCapability[] rows =
        [
            new() { Role = UserRoleType.Driver, CapabilityKey = nameof(Capability.Invoicing), IsVisible = true }
        ];

        (await SucceedsAsync(Capability.Invoicing, rows, UserRoleType.Driver)).Should().BeTrue();
    }
```

Note the key is `nameof(Capability.Invoicing)` — `"Invoicing"`, matching the enum name. The seed rows use the camelCase frontend keys, so **Task 6 must reconcile the casing**; see its Step 1.

- [ ] **Step 6: Run it to verify it fails**

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~CapabilityHandlerTests"`
Expected: FAIL — `CapabilityHandler` has no constructor taking a `RoleCapabilityPolicy`.

- [ ] **Step 7: Rewrite the handler**

```csharp
using AleTrack.Common.Enums;
using Microsoft.AspNetCore.Authorization;

namespace AleTrack.Common.Authorization;

/// <summary>
/// Grants a <see cref="CapabilityRequirement"/> unless one of the caller's roles is denied the
/// capability by <see cref="RoleCapabilityPolicy"/>. Admin short-circuits to allowed; otherwise
/// the rule is deny-if-any-denies, so an account carrying a restricted role alongside another
/// lands on the restrictive answer.
/// </summary>
public sealed class CapabilityHandler(RoleCapabilityPolicy policy)
    : AuthorizationHandler<CapabilityRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CapabilityRequirement requirement)
    {
        if (context.User.IsInRole(nameof(UserRoleType.Admin)))
        {
            context.Succeed(requirement);
            return;
        }

        var key = requirement.Capability.ToString();

        foreach (var role in Enum.GetValues<UserRoleType>())
        {
            if (!context.User.IsInRole(role.ToString()))
            {
                continue;
            }

            // AuthorizationHandlerContext carries no CancellationToken; the read is cached
            // and in-process, so there is nothing to cancel.
            var hidden = await policy.GetHiddenKeysAsync(role, CancellationToken.None);

            if (hidden.Contains(key))
            {
                context.Fail();
                return;
            }
        }

        context.Succeed(requirement);
    }
}
```

- [ ] **Step 8: Register both as scoped**

`AuthenticationExtensions.cs` — the handler currently registers as a singleton, which cannot hold a scoped `DbContext`:

```csharp
        services.AddSingleton<IAuthorizationHandler, ModulePermissionHandler>();
        services.AddScoped<RoleCapabilityPolicy>();
        services.AddScoped<IAuthorizationHandler, CapabilityHandler>();
```

- [ ] **Step 9: Delete the static table and its test**

```bash
git rm api/AleTrack/AleTrack/Common/Authorization/RoleCapabilities.cs \
       api/AleTrack/AleTrack.Tests/Common/Authorization/RoleCapabilitiesTests.cs
```

Then remove the `<see cref="Authorization.RoleCapabilities"/>` reference from the `Driver` doc comment in `UserRoleType.cs` (a stale `cref` breaks the XML docs build silently):

```csharp
    /// A driver in the field. Granted access through the same permission matrix as
    /// <see cref="Manager"/>, but denied capabilities configured per role in the
    /// role_capabilities table — by default invoicing, the loading breakdown and money.
```

- [ ] **Step 10: Verify**

Run: `dotnet build /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.sln`
Expected: 0 errors, no new warnings.

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass. Count shifts: the 5 `RoleCapabilitiesTests` cases go, 3 policy tests and 1 handler case arrive.

- [ ] **Step 11: Commit**

```bash
git add api/AleTrack
git commit -m "refactor: read capability policy from the database instead of code"
```

---

### Task 4: Stamp hidden keys into the token

**Files:**
- Modify: `api/AleTrack/AleTrack/Common/Utils/JwtService.cs`
- Modify: `api/AleTrack/AleTrack/Common/Utils/IJwtService.cs` (the `GenerateToken` signature becomes async)
- Modify: every `GenerateToken` call site (find with `grep -rn "GenerateToken" api --include="*.cs" | grep -v obj`)
- Create: `api/AleTrack/AleTrack.Tests/Common/Utils/JwtServiceCapabilityClaimTests.cs`

**Interfaces:**
- Consumes: `RoleCapabilityPolicy.GetHiddenKeysAsync` (Task 3).
- Produces: `JwtService.CapabilityClaimType = "cap"`, one claim per hidden key on the issued token. Task 6 reads these claims.

- [ ] **Step 1: Write the failing test**

```csharp
using System.IdentityModel.Tokens.Jwt;
using AleTrack.Common.Authorization;
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Moq;
using Moq.EntityFrameworkCore;

namespace AleTrack.Tests.Common.Utils;

/// <summary>
/// The token carries the role's hidden capability keys, so the frontend reads policy from its
/// own token instead of holding a copy of the backend's table.
/// </summary>
public sealed class JwtServiceCapabilityClaimTests
{
    private static JwtService ServiceOver(params RoleCapability[] rows)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_Issuer"] = "AleTrackAPI",
                ["JWT_Key"] = "eb58baa8f90d76949d7f52f88c97bd916484c08f9d5cd6394602963be325c38b"
            })
            .Build();

        var dbContext = new Mock<AleTrackDbContext>(new DbContextOptions<AleTrackDbContext>());
        dbContext.Setup(x => x.RoleCapabilities).ReturnsDbSet(rows);

        return new JwtService(
            configuration,
            new RoleCapabilityPolicy(dbContext.Object, new MemoryCache(new MemoryCacheOptions())));
    }

    private static User DriverUser() => new()
    {
        UserName = "novak",
        Password = "hash",
        UserRoles = [new UserRole { Type = UserRoleType.Driver }]
    };

    [Fact]
    public async Task GenerateTokenAsync_RoleHasHiddenCapabilities_EmitsOneCapClaimEach()
    {
        var service = ServiceOver(
            new RoleCapability { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false },
            new RoleCapability { Role = UserRoleType.Driver, CapabilityKey = "money", IsVisible = false });

        var token = await service.GenerateTokenAsync(DriverUser(), CancellationToken.None);

        var claims = new JwtSecurityTokenHandler().ReadJwtToken(token).Claims
            .Where(c => c.Type == JwtService.CapabilityClaimType)
            .Select(c => c.Value);

        claims.Should().BeEquivalentTo(["invoicing", "money"]);
    }

    [Fact]
    public async Task GenerateTokenAsync_NothingHidden_EmitsNoCapClaims()
    {
        var service = ServiceOver(
            new RoleCapability { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = true });

        var token = await service.GenerateTokenAsync(DriverUser(), CancellationToken.None);

        new JwtSecurityTokenHandler().ReadJwtToken(token).Claims
            .Should().NotContain(c => c.Type == JwtService.CapabilityClaimType);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~JwtServiceCapabilityClaimTests"`
Expected: FAIL — no `GenerateTokenAsync`, and `JwtService` has no two-argument constructor.

- [ ] **Step 3: Make token generation async and add the claims**

In `IJwtService`, replace `string GenerateToken(User user);` with:

```csharp
    /// <summary>
    /// Issues an access token for <paramref name="user"/>, stamping the capability keys their
    /// roles may not see.
    /// </summary>
    Task<string> GenerateTokenAsync(User user, CancellationToken ct);
```

In `JwtService`, take the policy in the primary constructor, add the claim type constant beside `PermissionClaimType`, and emit the claims:

```csharp
internal sealed class JwtService(IConfiguration configuration, RoleCapabilityPolicy policy) : IJwtService
{
    /// <summary>
    /// Claim type carrying one capability key the caller's roles may not see.
    /// </summary>
    public const string CapabilityClaimType = "cap";
```

```csharp
        // Capabilities the user's roles are denied. Default-allow, so only denials are carried.
        var hidden = new HashSet<string>(StringComparer.Ordinal);
        foreach (var role in user.UserRoles.Select(r => r.Type))
        {
            hidden.UnionWith(await policy.GetHiddenKeysAsync(role, ct));
        }

        claims.AddRange(hidden.Select(key => new Claim(CapabilityClaimType, key)));
```

Guard the Admin case: an admin bypasses capabilities entirely, so emit nothing for them.

```csharp
        if (user.UserRoles.Any(r => r.Type == UserRoleType.Admin))
        {
            hidden.Clear();
        }
```

- [ ] **Step 4: Update the call sites**

Run `grep -rn "GenerateToken" api --include="*.cs" | grep -v obj` and make each `await ...GenerateTokenAsync(user, ct)`. Expect the login and refresh endpoints. Register the policy for them — it is already `AddScoped` from Task 3.

- [ ] **Step 5: Run the tests**

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass, including the existing `LoginTests`.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack
git commit -m "feat: carry denied capability keys in the access token"
```

---

### Task 5: Read and write the policy over HTTP

**Files:**
- Create: `api/AleTrack/AleTrack/Features/RoleCapabilities/RoleCapabilitiesFeatureConfiguration.cs`
- Create: `api/AleTrack/AleTrack/Features/RoleCapabilities/Shared/RoleCapabilityDto.cs`
- Create: `api/AleTrack/AleTrack/Features/RoleCapabilities/Queries/List/GetRoleCapabilitiesEndpoint.cs`, `GetRoleCapabilitiesResponse.cs`
- Create: `api/AleTrack/AleTrack/Features/RoleCapabilities/Commands/Set/SetRoleCapabilitiesEndpoint.cs`, `SetRoleCapabilitiesDto.cs`, `SetRoleCapabilitiesValidator.cs`
- Create: `api/AleTrack/AleTrack/Features/RoleCapabilities/Errors/RoleCapabilityErrorCodes.cs`
- Create: `api/AleTrack/AleTrack.Tests/Features/RoleCapabilities/SetRoleCapabilitiesTests.cs`

**Interfaces:**
- Consumes: `dbContext.RoleCapabilities`, `RoleCapabilityPolicy.Invalidate()`.
- Produces: `GET ale-track/role-capabilities` → `GetRoleCapabilitiesResponse(List<RoleCapabilityDto> Items)`; `PUT ale-track/role-capabilities` taking `SetRoleCapabilitiesDto(List<RoleCapabilityDto> Items)` → 204. `RoleCapabilityDto(UserRoleType Role, string CapabilityKey, bool IsVisible)`. Task 7 consumes both.

- [ ] **Step 1: Write the failing validator test**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.RoleCapabilities.Commands.Set;
using AleTrack.Features.RoleCapabilities.Errors;
using AleTrack.Features.RoleCapabilities.Shared;
using FluentValidation.TestHelper;

namespace AleTrack.Tests.Features.RoleCapabilities;

/// <summary>
/// Admin bypasses capabilities in the handler, so a stored Admin row could only ever be a lie.
/// The validator refuses them rather than letting a client bug write one.
/// </summary>
public sealed class SetRoleCapabilitiesTests
{
    [Fact]
    public void Validate_RowForAdmin_FailsWithCorrectCode()
    {
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Admin, CapabilityKey = "invoicing", IsVisible = false }]
        });

        result.ShouldHaveValidationErrorFor("Items[0].Role")
            .WithErrorCode(RoleCapabilityErrorCodes.AdminIsNotConfigurable);
    }

    [Fact]
    public void Validate_EmptyKey_Fails()
    {
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "", IsVisible = false }]
        });

        result.ShouldHaveValidationErrorFor("Items[0].CapabilityKey");
    }

    [Fact]
    public void Validate_DriverRow_Passes()
    {
        var result = new SetRoleCapabilitiesValidator().TestValidate(new SetRoleCapabilitiesDto
        {
            Items = [new RoleCapabilityDto { Role = UserRoleType.Driver, CapabilityKey = "invoicing", IsVisible = false }]
        });

        result.ShouldNotHaveAnyValidationErrors();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~SetRoleCapabilitiesTests"`
Expected: FAIL — the types do not exist.

- [ ] **Step 3: Write the DTO, error codes, and validator**

```csharp
namespace AleTrack.Features.RoleCapabilities.Errors;

/// <summary>
/// Stable error codes for the role capability slice; the frontend keys messages off them.
/// </summary>
public static class RoleCapabilityErrorCodes
{
    /// <summary>Admin always sees everything, so it cannot be configured.</summary>
    public const string AdminIsNotConfigurable = "RoleCapability.AdminIsNotConfigurable";

    /// <summary>A capability key is required and capped at 64 characters.</summary>
    public const string CapabilityKeyInvalid = "RoleCapability.CapabilityKeyInvalid";
}
```

```csharp
using AleTrack.Common.Enums;

namespace AleTrack.Features.RoleCapabilities.Shared;

/// <summary>
/// Visibility of one capability for one role.
/// </summary>
public sealed record RoleCapabilityDto
{
    /// <summary>The role the row applies to.</summary>
    public UserRoleType Role { get; set; }

    /// <summary>Key of the capability.</summary>
    public string CapabilityKey { get; set; } = null!;

    /// <summary>Whether the role may see it.</summary>
    public bool IsVisible { get; set; }
}
```

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.RoleCapabilities.Errors;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.RoleCapabilities.Commands.Set;

/// <summary>
/// Validates a full replacement of the role capability table.
/// </summary>
internal sealed class SetRoleCapabilitiesValidator : Validator<SetRoleCapabilitiesDto>
{
    public SetRoleCapabilitiesValidator()
    {
        RuleForEach(dto => dto.Items).ChildRules(item =>
        {
            item.RuleFor(x => x.Role)
                .NotEqual(UserRoleType.Admin)
                .WithErrorCode(RoleCapabilityErrorCodes.AdminIsNotConfigurable);

            item.RuleFor(x => x.CapabilityKey)
                .NotEmpty()
                .MaximumLength(64)
                .WithErrorCode(RoleCapabilityErrorCodes.CapabilityKeyInvalid);
        });
    }
}
```

- [ ] **Step 4: Run the validator tests**

Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~SetRoleCapabilitiesTests"`
Expected: 3 passed.

- [ ] **Step 5: Write the feature configuration and both endpoints**

```csharp
namespace AleTrack.Features.RoleCapabilities;

/// <summary>
/// Feature configuration for the role capability slice.
/// </summary>
internal sealed class RoleCapabilitiesFeatureConfiguration : IFeatureConfiguration
{
    /// <summary>
    /// Swagger tag info for this feature.
    /// </summary>
    public FeatureInfo Info => new("RoleCapabilities", "Which components each role may see");

    /// <summary>
    /// No feature-scoped services; RoleCapabilityPolicy is registered with authorization.
    /// </summary>
    public IServiceCollection AddFeatureDependencies(IServiceCollection services, IConfiguration configuration)
        => services;
}
```

The `PUT` replaces the whole set inside a transaction and invalidates the cache. Follow the `Send.*` and `Configure` conventions of the existing endpoints — `Get`/`Put`, `Description(b => b.RequirePermission(...))`, `DontCatchExceptions()`, and a `Summary` documenting every status:

```csharp
    public override void Configure()
    {
        Put("role-capabilities");
        Description(b => b
            .RequirePermission(ModuleType.Users, PermissionLevel.Edit)
            .Produces(StatusCodes.Status204NoContent)
            .WithName(nameof(SetRoleCapabilitiesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Replace which components each role may see";
            s.Responses[StatusCodes.Status204NoContent] = "Saved";
            s.Responses[StatusCodes.Status400BadRequest] = "A row targets Admin, or a key is invalid";
        });
    }

    public override async Task HandleAsync(SetRoleCapabilitiesDto req, CancellationToken ct)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(ct);

        dbContext.RoleCapabilities.RemoveRange(await dbContext.RoleCapabilities.ToListAsync(ct));
        dbContext.RoleCapabilities.AddRange(req.Items.Select(item => new RoleCapability
        {
            Role = item.Role,
            CapabilityKey = item.CapabilityKey,
            IsVisible = item.IsVisible
        }));

        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        // Next request must see the saved policy, not the map cached before this write.
        policy.Invalidate();

        await Send.NoContentAsync(ct);
    }
```

The `GET` projects the table with `AsNoTracking()` and `Select`, gated `RequirePermission(ModuleType.Users, PermissionLevel.View)`.

- [ ] **Step 6: Verify**

Run: `dotnet build /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.sln` — 0 errors.
Run: `dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj` — all pass.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack
git commit -m "feat: read and write role capability visibility over HTTP"
```

---

### Task 6: Frontend registry and capabilities from the token

**Files:**
- Create: `app/src/auth/capabilityRegistry.ts`
- Create: `app/src/auth/capabilityRegistry.test.ts`
- Modify: `app/src/auth/capabilities.ts`, `app/src/auth/capabilities.test.ts`
- Modify: `app/src/auth/types.ts` (`CurrentUser.caps`), `app/src/auth/jwt.ts`, `app/src/auth/jwt.test.ts`
- Modify: `app/src/auth/AuthProvider.tsx`
- Regenerate: `app/src/generated/api-client.ts`

**Interfaces:**
- Consumes: the `cap` claim (Task 4), `Capability` enum and `RoleCapabilityDto` from the regenerated client (Task 5).
- Produces: `CAPABILITY_REGISTRY` (array of `{ key, label, module, guardsData }`), `type Capability = (typeof CAPABILITY_REGISTRY)[number]['key']`, `capabilitiesFromClaims(roles, capClaims) → Capabilities`, and `CurrentUser.caps`. Task 7 consumes the registry.

- [ ] **Step 1: Write the registry**

Keys are PascalCase throughout, matching the `Capability` enum names the server looks up (Task 2
Step 4, Task 3 Step 5). `Capabilities` is keyed by them, so `can('Invoicing')` is the call shape.

```ts
// The single frontend declaration of hideable content. Keys match the backend Capability
// enum name for anything enforced server-side; cosmetic entries are frontend-only, so
// adding one is an entry here plus a can() call — no backend change, no regen.
import { type ModuleKey } from './permissions';

export interface CapabilityMeta {
  key: string;
  /** Czech label shown in the role panel. */
  label: string;
  /** Module whose row it nests under; null = cross-application. */
  module: ModuleKey | null;
  /** True when an endpoint enforces it too, so hiding it is a real boundary. */
  guardsData: boolean;
}

export const CAPABILITY_REGISTRY = [
  { key: 'Invoicing', label: 'Fakturace', module: 'shipments', guardsData: true },
  { key: 'LoadingBreakdown', label: 'Rozpis nakládky', module: 'shipments', guardsData: false },
  { key: 'Money', label: 'Ceny', module: null, guardsData: true },
] as const satisfies readonly CapabilityMeta[];

export type Capability = (typeof CAPABILITY_REGISTRY)[number]['key'];
```

- [ ] **Step 2: Write the failing drift test**

```ts
import { describe, expect, it } from 'vitest';
import { Capability as ApiCapability } from 'src/generated/api-client';
import { CAPABILITY_REGISTRY } from './capabilityRegistry';

describe('capability registry', () => {
  // A guardsData capability is named by RequireCapability on the server. If a rename splits
  // the two, the endpoint stops matching and the gate silently opens — so this fails loudly.
  it('gives every server-enforced capability a key matching the generated enum', () => {
    const apiNames = Object.keys(ApiCapability).filter((k) => Number.isNaN(Number(k)));

    for (const entry of CAPABILITY_REGISTRY.filter((c) => c.guardsData)) {
      expect(apiNames).toContain(entry.key);
    }
  });

  it('has no duplicate keys', () => {
    const keys = CAPABILITY_REGISTRY.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `yarn --cwd app test:run src/auth/capabilityRegistry.test.ts`
Expected: FAIL — `Capability` is not exported from the generated client until it is regenerated.

- [ ] **Step 4: Regenerate the client**

Start the backend on 8080 and run `yarn --cwd app generate-api` (see Task 1 Step 5, including the port and migration caveats). Verify `Capability` and `RoleCapabilityDto` now exist in `app/src/generated/api-client.ts`.

- [ ] **Step 5: Run the drift test**

Run: `yarn --cwd app test:run src/auth/capabilityRegistry.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Rewrite `capabilities.ts` to read claims**

Delete `DENIED_BY_ROLE` and `CAPABILITIES`; derive everything from the registry:

```ts
import { CAPABILITY_REGISTRY, type Capability } from './capabilityRegistry';
import { type UserRole } from './types';

export type Capabilities = Record<Capability, boolean>;

function all(value: boolean): Capabilities {
  return Object.fromEntries(CAPABILITY_REGISTRY.map((c) => [c.key, value])) as Capabilities;
}

/**
 * Resolve the capability set from the token: Admin sees everything, otherwise every registry
 * key is allowed except those the backend named in a `cap` claim. Unknown claim keys are
 * ignored — a capability removed from the registry must not break an old token.
 */
export function capabilitiesFromClaims(
  roles: readonly UserRole[],
  hiddenKeys: readonly string[],
): Capabilities {
  if (roles.includes('Admin')) return all(true);

  const caps = all(true);
  for (const key of hiddenKeys) {
    if (key in caps) caps[key as Capability] = false;
  }
  return caps;
}
```

Keep `roleOfRoles` and `ROLE_CLAIM_LABELS` from Task 1 in this file.

- [ ] **Step 7: Put `caps` on `CurrentUser`**

`app/src/auth/types.ts`:

```ts
import { type Capabilities } from './capabilities';

export interface CurrentUser {
  id: string;
  userName: string;
  firstName?: string;
  lastName?: string;
  roles: UserRole[];
  perms: Permissions;
  caps: Capabilities;
}
```

`app/src/auth/jwt.ts` — add the claim name beside `perm` and assemble `caps` in `userFromToken`, so it is persisted and restored with the session exactly like `perms`:

```ts
  cap: 'cap',
```

```ts
      perms: isAdmin ? allPerms('edit') : permsFromClaims(asArray(p[CLAIM.perm])),
      caps: capabilitiesFromClaims(roles.length ? roles : ['Manager'], asArray(p[CLAIM.cap])),
```

`app/src/auth/AuthProvider.tsx` — `can` reads the decoded set instead of resolving:

```tsx
        can: (c) => user?.caps[c] ?? false,
```

and drop the now-unused `capabilitiesFor` import and the `caps` local.

- [ ] **Step 8: Update the capability tests**

Rewrite `capabilities.test.ts` against the new signature, keeping the cases that matter:

```ts
describe('capabilitiesFromClaims', () => {
  it('allows everything when no capability is hidden', () => {
    const caps = capabilitiesFromClaims(['Manager'], []);
    expect(Object.values(caps).every(Boolean)).toBe(true);
  });

  it('hides exactly the keys the token names', () => {
    expect(capabilitiesFromClaims(['Driver'], ['Invoicing', 'Money'])).toEqual({
      Invoicing: false,
      LoadingBreakdown: true,
      Money: false,
    });
  });

  it('ignores an unknown claim key', () => {
    expect(capabilitiesFromClaims(['Driver'], ['Wizardry']).Invoicing).toBe(true);
  });

  it('lets Admin override any hidden key', () => {
    expect(capabilitiesFromClaims(['Admin'], ['Invoicing']).Invoicing).toBe(true);
  });
});
```

Add a `jwt.test.ts` case proving the claims reach `caps`:

```ts
it('decodes cap claims onto the user', () => {
  const user = userFromToken(tokenWith({ [CLAIM_ROLE]: 'Driver', cap: ['Invoicing', 'Money'] }));

  expect(user?.caps).toEqual({ Invoicing: false, LoadingBreakdown: true, Money: false });
});
```

- [ ] **Step 9: Fix the `can()` call sites**

`ShipmentsPage.tsx` passes `can('invoicing')` and `can('loadingBreakdown')`; both become PascalCase: `can('Invoicing')`, `can('LoadingBreakdown')`. Find any others with `grep -rn "can('" app/src`.

- [ ] **Step 10: Verify**

Run: `yarn --cwd app typecheck && yarn --cwd app test:run && yarn --cwd app lint`
Expected: typecheck clean, all tests pass, 0 lint errors.

- [ ] **Step 11: Commit**

```bash
git add app/src/auth app/src/features/shipments app/src/generated/api-client.ts \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations
git commit -m "feat: resolve frontend capabilities from the access token"
```

---

### Task 7: The `Role a komponenty` screen

**Files:**
- Create: `app/src/features/users/RoleCapabilitiesPanel.tsx`
- Create: `app/src/features/users/RoleCapabilitiesPanel.test.tsx`
- Create: `app/src/hooks/useRoleCapabilities.ts`
- Modify: `app/src/api/queryKeys.ts` (add the `roleCapabilities` key)
- Modify: `app/src/routes/paths.ts`, `app/src/routes/router.tsx:46`
- Modify: `app/src/features/users/UsersPage.tsx` (the header action and the `view` prop)

**Interfaces:**
- Consumes: `CAPABILITY_REGISTRY` (Task 6), `GET`/`PUT role-capabilities` (Task 5), `ASSIGNABLE_ROLES` / `ROLE_LABELS` (Task 1).
- Produces: the route `/users/roles` and `<UsersPage view="roles" />`.

- [ ] **Step 1: Write the failing panel test**

Mock the hook so the test covers what only the component decides — the grouping, the greyed Admin column, and the full-set save:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { UserRoleType } from 'src/generated/api-client';
import { theme } from 'src/theme/theme';
import { RoleCapabilitiesPanel } from './RoleCapabilitiesPanel';

const save = vi.fn();

vi.mock('src/hooks/useRoleCapabilities', () => ({
  useRoleCapabilities: () => ({
    data: [{ role: UserRoleType.Driver, capabilityKey: 'Invoicing', isVisible: false }],
    isPending: false,
    isError: false,
  }),
  useSetRoleCapabilities: () => ({ mutate: save, isPending: false }),
}));

function renderPanel() {
  return render(
    <MuiThemeProvider theme={theme}>
      <RoleCapabilitiesPanel />
    </MuiThemeProvider>,
  );
}

describe('RoleCapabilitiesPanel', () => {
  it('groups capabilities under their module and names cross-application ones separately', () => {
    renderPanel();

    expect(screen.getByText('Vývozy')).toBeInTheDocument();
    expect(screen.getByText('Fakturace')).toBeInTheDocument();
    expect(screen.getByText('Napříč aplikací')).toBeInTheDocument();
  });

  it('renders the Admin column as fixed', () => {
    renderPanel();

    // Admin bypasses capabilities, so its checkboxes exist for shape but never accept input.
    const adminBoxes = screen.getAllByRole('checkbox', { name: /Administrátor/ });
    expect(adminBoxes.every((box) => box.hasAttribute('disabled'))).toBe(true);
  });

  it('sends the whole set on save, including rows left untouched', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Rozpis nakládky – Řidič' }));
    fireEvent.click(screen.getByRole('button', { name: 'Uložit' }));

    expect(save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ capabilityKey: 'Invoicing', isVisible: false }),
        expect.objectContaining({ capabilityKey: 'LoadingBreakdown', isVisible: false }),
      ]),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `yarn --cwd app test:run src/features/users/RoleCapabilitiesPanel.test.tsx`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the hook**

Follow the one-module-per-resource convention in `src/hooks/`, with keys from `qk`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleCapabilityDto, SetRoleCapabilitiesDto } from 'src/generated/api-client';
import { useDataSource } from 'src/api/dataSource';
import { qk } from 'src/api/queryKeys';

export function useRoleCapabilities() {
  const api = useDataSource();
  return useQuery({
    queryKey: qk.roleCapabilities.all,
    queryFn: async () => (await api.getRoleCapabilitiesEndpoint()).items ?? [],
  });
}

export function useSetRoleCapabilities() {
  const api = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: RoleCapabilityDto[]) =>
      api.setRoleCapabilitiesEndpoint(new SetRoleCapabilitiesDto({ items })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.roleCapabilities.all }),
  });
}
```

Confirm the generated method names against `app/src/generated/api-client.ts` — NSwag derives them from the endpoint's `WithName`, so they should be `getRoleCapabilitiesEndpoint` / `setRoleCapabilitiesEndpoint`.

- [ ] **Step 4: Write the panel**

Split it: an outer component owning the query states, and an inner one taking loaded rows as a
plain prop. That is the repo's rule — hooks must not run on data that may be missing, and a
`useState` seeded above a `if (!data) return` guard crashes.

```tsx
import { useMemo, useState } from 'react';
import {
  Box, Button, Card, Checkbox, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useSnackbar } from 'notistack';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { apiErrorMessage } from 'src/api/errors';
import { RoleCapabilityDto, UserRoleType } from 'src/generated/api-client';
import { CAPABILITY_REGISTRY, type CapabilityMeta } from 'src/auth/capabilityRegistry';
import { NAV_GROUPS } from 'src/layout/nav-config';
import { useRoleCapabilities, useSetRoleCapabilities } from 'src/hooks/useRoleCapabilities';
import { ASSIGNABLE_ROLES, ROLE_LABELS } from './permissionModel';

/** Editable roles: Admin bypasses capabilities, so its column is fixed. */
const EDITABLE_ROLES = ASSIGNABLE_ROLES.filter((r) => r !== UserRoleType.Admin);

/** Capability groups in nav order, cross-application ones last. */
function groups(): { heading: string; items: CapabilityMeta[] }[] {
  const byModule = NAV_GROUPS.flatMap((g) => g.items)
    .map((item) => ({
      heading: item.label,
      items: CAPABILITY_REGISTRY.filter((c) => c.module === item.key) as CapabilityMeta[],
    }))
    .filter((g) => g.items.length > 0);

  const crossApp = CAPABILITY_REGISTRY.filter((c) => c.module === null) as CapabilityMeta[];

  return crossApp.length > 0
    ? [...byModule, { heading: 'Napříč aplikací', items: crossApp }]
    : byModule;
}

/** Key for the local edit map. */
const cellKey = (role: UserRoleType, capabilityKey: string) => `${role}:${capabilityKey}`;

export function RoleCapabilitiesPanel() {
  const query = useRoleCapabilities();

  return (
    <QueryBoundary query={query}>
      {(rows) => <RoleCapabilitiesEditor rows={rows} />}
    </QueryBoundary>
  );
}

function RoleCapabilitiesEditor({ rows }: { rows: RoleCapabilityDto[] }) {
  const { enqueueSnackbar } = useSnackbar();
  const save = useSetRoleCapabilities();

  // Default-allow: anything without a row is visible.
  const initial = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const role of EDITABLE_ROLES) {
      for (const capability of CAPABILITY_REGISTRY) {
        map.set(cellKey(role, capability.key), true);
      }
    }
    for (const row of rows) {
      if (row.capabilityKey) map.set(cellKey(row.role!, row.capabilityKey), row.isVisible ?? true);
    }
    return map;
  }, [rows]);

  const [visible, setVisible] = useState(initial);

  const toggle = (role: UserRoleType, capabilityKey: string) => {
    setVisible((previous) => {
      const next = new Map(previous);
      const key = cellKey(role, capabilityKey);
      next.set(key, !next.get(key));
      return next;
    });
  };

  // The whole set every time, so a capability that had no row yet is written explicitly.
  const submit = () => {
    const items = EDITABLE_ROLES.flatMap((role) =>
      CAPABILITY_REGISTRY.map((capability) => new RoleCapabilityDto({
        role,
        capabilityKey: capability.key,
        isVisible: visible.get(cellKey(role, capability.key)) ?? true,
      })),
    );

    save.mutate(items, {
      onSuccess: () => enqueueSnackbar(
        'Uloženo. Změny se u přihlášených uživatelů projeví po dalším přihlášení.',
        { variant: 'success' },
      ),
      onError: (e) => enqueueSnackbar(apiErrorMessage(e), { variant: 'error' }),
    });
  };

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary" sx={{ fontSize: 13 }}>
        Nastavení platí pro celou roli, ne pro jednotlivé uživatele. Zamčené položky se navíc
        vynucují na serveru.
      </Typography>

      <Card variant="outlined">
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: (t) => t.vars!.palette.brand.surface2 }}>
                <TableCell sx={{ fontWeight: 700 }}>Modul / komponenta</TableCell>
                {ASSIGNABLE_ROLES.map((role) => (
                  <TableCell key={role} align="center" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {ROLE_LABELS[role]}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {groups().map((group) => (
                <Fragment key={group.heading}>
                  <TableRow>
                    <TableCell colSpan={ASSIGNABLE_ROLES.length + 1} sx={{ fontWeight: 700 }}>
                      {group.heading}
                    </TableCell>
                  </TableRow>
                  {group.items.map((capability) => (
                    <TableRow key={capability.key} hover>
                      <TableCell>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pl: 2 }}>
                          {capability.guardsData && (
                            <Tooltip title="Vynucuje se i na serveru">
                              <LockOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                            </Tooltip>
                          )}
                          <Typography sx={{ fontWeight: 600 }}>{capability.label}</Typography>
                        </Stack>
                      </TableCell>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <TableCell key={role} align="center" sx={{ py: 0.25 }}>
                          <Checkbox
                            size="small"
                            inputProps={{ 'aria-label': `${capability.label} – ${ROLE_LABELS[role]}` }}
                            disabled={role === UserRoleType.Admin}
                            checked={role === UserRoleType.Admin
                              || (visible.get(cellKey(role, capability.key)) ?? true)}
                            onChange={() => toggle(role, capability.key)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Box>
        <Button variant="contained" onClick={submit} disabled={save.isPending}>Uložit</Button>
      </Box>
    </Stack>
  );
}
```

Import `Fragment` from `react`. Note the `theme.vars!.palette.*` in the `sx` callback — under
`cssVariables`, `theme.palette.*` freezes to the light value and paints wrong in dark mode.

- [ ] **Step 5: Wire the route and the header action**

`paths.ts`:

```ts
  userRoles: '/users/roles',
```

`router.tsx` — before the `PATHS.users` entry so the more specific path wins:

```tsx
          { path: PATHS.userRoles, element: <UsersPage view="roles" /> },
          { path: PATHS.users, element: <UsersPage /> },
```

`UsersPage` takes `view?: 'roles'` and returns `<RoleCapabilitiesPanel />` inside its `PageContainer` when set, matching how `ShipmentsPage` dispatches on `view`. Add a `Role a komponenty` button to the existing `PageHeader` actions, shown only when `canEdit('users')`.

- [ ] **Step 6: Run the tests**

Run: `yarn --cwd app test:run src/features/users`
Expected: all pass, including the existing `permissionModel.test.ts`.

- [ ] **Step 7: Verify everything**

Run: `yarn --cwd app typecheck && yarn --cwd app test:run && yarn --cwd app lint && yarn --cwd app build`
Expected: typecheck clean, all pass, 0 lint errors, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add app/src/features/users app/src/hooks/useRoleCapabilities.ts app/src/api/queryKeys.ts app/src/routes
git commit -m "feat: edit which components each role sees"
```

---

### Task 8: Close out

**Files:**
- Modify: `app/CLAUDE.md` (the Auth and permissions section)
- Modify: `docs/superpowers/specs/2026-08-11-role-capability-configuration-design.md` (record the PascalCase key decision)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Run the full verification surface fresh**

```bash
dotnet build /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.sln
dotnet test /Users/jan/Projects/ale-track/api/AleTrack/AleTrack.Tests/AleTrack.Tests.csproj
yarn --cwd /Users/jan/Projects/ale-track/app typecheck
yarn --cwd /Users/jan/Projects/ale-track/app test:run
yarn --cwd /Users/jan/Projects/ale-track/app lint
yarn --cwd /Users/jan/Projects/ale-track/app build
```

Read the full output of each, not the exit code. Expected: 0 backend errors and 0 failures; frontend typecheck clean, all tests passing, 0 lint errors with only the 4 pre-existing `react-refresh` warnings, build succeeding.

- [ ] **Step 2: Update the frontend guide**

In `app/CLAUDE.md`, extend the Auth and permissions section: `useAuth()` also exposes `can(capability)`; capabilities come from the token's `cap` claims and are declared in `src/auth/capabilityRegistry.ts`; role-level visibility is edited at `/users/roles`; a `guardsData` capability is enforced by its endpoint as well, a cosmetic one is UI-only.

- [ ] **Step 3: Record the key-casing decision in the spec**

The spec's examples use camelCase keys (`invoicing`); the implementation settled on PascalCase to match the `Capability` enum name the server looks up. Correct the spec's registry example and the `role_capabilities` sample rows so the document matches what shipped.

- [ ] **Step 4: Commit**

```bash
git add app/CLAUDE.md docs/superpowers/specs/2026-08-11-role-capability-configuration-design.md
git commit -m "docs: document the capability layer and its stored key casing"
```

- [ ] **Step 5: Hand back**

Report: the exact commands run and their observed results, the migration that must be applied to each environment (`AddRoleCapabilities`), and that a signed-in user picks up a changed policy on their next token issue. Do **not** push or open a PR — the user reviews and lands it.

---

## Notes for whoever executes this

- **The tree is shared with other sessions.** Check `git branch --show-current` before every commit; work belongs on `feature/role-capability-config`, never on `dev`.
- **Never stage broadly.** `git add -A` has previously swept up local-only files. `launchSettings.json` currently holds a real database password in the working tree and must never be staged.
- **Port 8080 must be free and held by *this* backend** before `yarn generate-api`, or the client is generated from whatever else is listening.
- **`Program.cs` calls `ApplyMigrationsAsync()` unconditionally** in the working tree, so booting the `Dev` profile applies pending migrations to the shared Supabase database. From Task 2 onward, run against a local database instead.
