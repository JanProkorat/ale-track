# Order Delivery Address Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an operator choose the delivery address when creating or editing an order, show it on the order detail, and have the outgoing-shipment stop inherit it while staying overridable.

**Architecture:** The `Order` row gains the same `(kind, delivery-place FK)` pair the shipment stop already carries, and becomes the source of truth. The stop keeps its own pair plus an `is_address_overridden` flag; an order edit propagates to a non-overridden stop and stamps `address_changed_at` either way, which drives a banner on the shipment screens.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, xUnit + FluentAssertions + Moq.EntityFrameworkCore (DbContext is mocked — no DB needed for tests). React 19, Vite 6, TypeScript, MUI 7, TanStack Query 5, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-27-order-delivery-address-design.md`

## Global Constraints

- **Branch:** work on `feat/order-delivery-address`, branched from `dev`.
- **UI is Czech, code is English.** Every user-visible string in Czech; identifiers, comments and commit messages in English. Never render a raw enum — go through `src/lib/labels.ts`.
- **Backend commands:** run from `api/AleTrack/`. Build `dotnet build AleTrack.sln`, test `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`. Single class: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`.
- **Frontend commands:** run from `app/`. `yarn test:run` (vitest), `yarn build` (typecheck **and** bundle — the only command that typechecks), `yarn lint`.
- **Codegen:** `app/src/generated/api-client.ts` is generated, never hand-edited. `cd app && yarn generate-api` requires the backend running: `cd api/AleTrack && dotnet run --project AleTrack --launch-profile Local` (serves `:8080`).
- **Additive DTO fields do not break the frontend build**, so regeneration is deferred to Task 10. The **enum rename in Task 1 is not additive** — it renames a type in the generated client — so Task 1 regenerates and fixes the frontend within its own commit.
- **Never edit** `appsettings.*.json`, `.env*`, or any `*.key`/`*.pfx`.
- Run the **full** test suite before each commit, not a filtered slice.

## File Structure

**Backend — created**

| File | Responsibility |
|---|---|
| `AleTrack/Common/Enums/DeliveryAddressKind.cs` | The renamed enum, now shared by `Order` and `OutgoingShipmentStop` |
| `AleTrack/Features/ClientDeliveryPlaces/ClientDeliveryPlaceResolver.cs` | Shared place lookup: unknown-id rejection, soft-delete policy, cross-client ownership |
| `AleTrack/Features/Orders/Utils/OrderDeliveryAddressDto.cs` | The resolved read model returned on `OrderDto` and on the shipment stop |
| `AleTrack/Features/Orders/Utils/OrderDeliveryAddressWriter.cs` | Applies a requested `(kind, placeId)` to an `Order`, and propagates to its stop |
| `AleTrack/Features/OutgoingShipments/Commands/AcknowledgeAddressChanges/AcknowledgeAddressChangesEndpoint.cs` | Clears `address_changed_at` on a shipment's stops |
| `AleTrack/Infrastructure/Persistence/Migrations/*_AddOrderDeliveryAddress.cs` | Four columns and the override backfill |
| `AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs` | Validators, write path, resolver, detail projection |
| `AleTrack.Tests/Features/Orders/OrderDeliveryAddressPropagationTests.cs` | The five propagation branches |

**Backend — modified:** `Entities/Order.cs`, `Entities/OutgoingShipmentStop.cs`, both order `Create`/`Update` DTOs + validators + endpoints, `Queries/Detail/OrderDto.cs` + `GetOrderDetailEndpoint.cs`, `Queries/OutgoingShipmentsList/OutgoingShipmentOrderDto.cs` + its endpoint, `OutgoingShipments/Queries/Detail/OutgoingShipmentDetailDto.cs` + its endpoint, `OutgoingShipments/Commands/{Create,Update}`, `OutgoingShipments/Utils/ShipmentStopDeliveryPlaceResolver.cs`, `ClientOrderShipmentDto(.Validator)`, `Infrastructure/Persistence/Configurations/`, and every file referencing the old enum name.

**Frontend — created**

| File | Responsibility |
|---|---|
| `app/src/features/clients/deliveryAddress.ts` | Pure `<Select>`-value encoding + address resolution shared by orders and shipments |
| `app/src/features/clients/deliveryAddress.test.ts` | Its unit tests |
| `app/src/features/orders/OrderDeliveryAddressField.tsx` | The picker + preview line used by `OrderEditor` |
| `app/src/features/orders/OrderDeliveryAddressField.test.tsx` | Its component tests |
| `app/src/features/shipments/AddressChangedBanner.tsx` | The banner shared by `ShipmentEditor` and `ShipmentDetail` |
| `app/src/features/shipments/AddressChangedBanner.test.tsx` | Its component tests |

**Frontend — modified:** `features/shipments/stopAddress.ts` (+ its test), `features/orders/OrderEditor.tsx`, `features/orders/OrderDetail.tsx` (+ its test), `features/shipments/ShipmentEditor.tsx`, `features/shipments/ShipmentDetail.tsx`, `hooks/useShipments.ts`, `lib/labels.ts`, `api/queryKeys.ts`, `generated/api-client.ts` (regenerated).

---

### Task 1: Rename `OutgoingShipmentStopAddressKind` → `DeliveryAddressKind`

Pure rename across both apps. No behaviour change, no migration — the members and their numeric values are unchanged. Done first so every later task writes the final name. This is the one task whose backend change breaks the frontend compile, so it regenerates the client and fixes the frontend in the same commit.

**Files:**
- Create: `api/AleTrack/AleTrack/Common/Enums/DeliveryAddressKind.cs`
- Delete: `api/AleTrack/AleTrack/Common/Enums/OutgoingShipmentStopAddressKind.cs`
- Modify: every backend file referencing the old name (find them in Step 2)
- Modify: `app/src/lib/labels.ts:6,171-189`, `app/src/features/shipments/stopAddress.ts`, `app/src/features/shipments/ShipmentEditor.tsx`, `app/src/features/shipments/ShipmentDetail.tsx`, and their tests
- Regenerate: `app/src/generated/api-client.ts`

**Interfaces:**
- Produces: `AleTrack.Common.Enums.DeliveryAddressKind` with `Official = 0`, `Contact = 1`, `DeliveryPlace = 2`. Every later backend task uses this name. On the frontend the generated enum is `DeliveryAddressKind`, and `labels.ts` exports `addrKindName` / `addrKindValue` / `addrKindLabel` with unchanged signatures apart from the parameter type.

- [ ] **Step 1: Confirm the full test suite is green before touching anything**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
cd ../../app && yarn test:run && yarn build
```

Expected: both green. If not, stop — you are inheriting a broken tree, not creating one.

- [ ] **Step 2: List every reference**

```bash
cd /Users/jan/Projects/ale-track
grep -rln "OutgoingShipmentStopAddressKind" api/AleTrack app/src
```

Expected: roughly a dozen backend files plus `app/src/lib/labels.ts`, `app/src/features/shipments/stopAddress.ts`, `ShipmentEditor.tsx`, `ShipmentDetail.tsx`, their tests, and `app/src/generated/api-client.ts` (which you will regenerate, not edit).

- [ ] **Step 3: Create the renamed enum file**

Create `api/AleTrack/AleTrack/Common/Enums/DeliveryAddressKind.cs`:

```csharp
namespace AleTrack.Common.Enums;

/// <summary>
/// Where a delivery goes: one of the client's two addresses, or a delivery
/// place saved on the client. Carried by both <see cref="Entities.Order"/>
/// (the client's choice when ordering) and
/// <see cref="Entities.OutgoingShipmentStop"/> (what the planner routes to).
/// </summary>
public enum DeliveryAddressKind
{
    /// <summary>
    /// Official (billing) address of the client
    /// </summary>
    Official = 0,

    /// <summary>
    /// Contact address of the client
    /// </summary>
    Contact = 1,

    /// <summary>
    /// A delivery place saved on the client
    /// </summary>
    DeliveryPlace = 2
}
```

Then delete `api/AleTrack/AleTrack/Common/Enums/OutgoingShipmentStopAddressKind.cs`.

- [ ] **Step 4: Rewrite the backend references**

```bash
cd /Users/jan/Projects/ale-track/api/AleTrack
grep -rl "OutgoingShipmentStopAddressKind" . | xargs sed -i '' 's/OutgoingShipmentStopAddressKind/DeliveryAddressKind/g'
```

The property names (`SelectedAddressKind`, `selected_address_kind`) are **not** touched — only the type name.

- [ ] **Step 5: Build the backend**

Run: `cd api/AleTrack && dotnet build AleTrack.sln`
Expected: builds clean. A `CS0246` naming an old symbol means a reference was missed — fix it and rebuild.

- [ ] **Step 6: Run the backend tests**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass, same count as Step 1. This is a rename; a behaviour change here is a bug.

- [ ] **Step 7: Regenerate the API client**

Start the backend in one terminal, regenerate in another:

```bash
cd api/AleTrack && dotnet run --project AleTrack --launch-profile Local
# then, separately:
cd app && yarn generate-api
```

Then confirm the enum landed with the new name:

```bash
grep -n "enum DeliveryAddressKind" app/src/generated/api-client.ts
```

Expected: one hit. **Trap:** `generate-api` reads whatever backend holds `:8080`. If another AleTrack instance is already running there, you will regenerate against the wrong build — check `lsof -ti:8080` first.

- [ ] **Step 8: Rewrite the frontend references**

```bash
cd /Users/jan/Projects/ale-track/app/src
grep -rl "OutgoingShipmentStopAddressKind" . --exclude-dir=generated | xargs sed -i '' 's/OutgoingShipmentStopAddressKind/DeliveryAddressKind/g'
```

- [ ] **Step 9: Typecheck and test the frontend**

```bash
cd app && yarn build && yarn test:run && yarn lint
```

Expected: all green, same test count as Step 1.

- [ ] **Step 10: Commit**

```bash
cd /Users/jan/Projects/ale-track
git add -A
git commit -m "refactor: rename OutgoingShipmentStopAddressKind to DeliveryAddressKind

The enum is about to be carried by Order as well as OutgoingShipmentStop,
so the stop-specific name no longer fits. Members and numeric values are
unchanged; no migration. Regenerates the API client, which renames the
generated TypeScript enum too."
```

---

### Task 2: Schema — four columns and the override backfill

**Files:**
- Modify: `api/AleTrack/AleTrack/Entities/Order.cs`
- Modify: `api/AleTrack/AleTrack/Entities/OutgoingShipmentStop.cs`
- Modify: `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/OrderConfiguration.cs` (create it if the project has no configuration class for `Order` — check `Infrastructure/Persistence/Configurations/` first)
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/*_AddOrderDeliveryAddress.cs` (generated)
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs`

**Interfaces:**
- Consumes: `DeliveryAddressKind` (Task 1).
- Produces: `Order.DeliveryAddressKind` (`DeliveryAddressKind`), `Order.ClientDeliveryPlaceId` (`long?`), `Order.ClientDeliveryPlace` (`ClientDeliveryPlace?`), `OutgoingShipmentStop.IsAddressOverridden` (`bool`), `OutgoingShipmentStop.AddressChangedAt` (`DateTime?`).

- [ ] **Step 1: Write the failing test**

Create `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

public sealed class OrderDeliveryAddressTests
{
    // A new order delivers to the billing address unless told otherwise —
    // the enum's zero value must therefore be Official, because that is also
    // what the column default and the migration backfill rely on.
    [Fact]
    public void NewOrder_DefaultsToOfficialAddressAndNoPlace()
    {
        var order = OrderBuilder.BuildEntity();

        order.DeliveryAddressKind.Should().Be(DeliveryAddressKind.Official);
        order.ClientDeliveryPlaceId.Should().BeNull();
    }

    [Fact]
    public void NewShipmentStop_IsNotOverriddenAndHasNoPendingChange()
    {
        var stop = new OutgoingShipmentStop { Kind = OutgoingShipmentStopKind.Order, Order = 1 };

        stop.IsAddressOverridden.Should().BeFalse();
        stop.AddressChangedAt.Should().BeNull();
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: compile failure — `'Order' does not contain a definition for 'DeliveryAddressKind'`.

- [ ] **Step 3: Add the `Order` properties**

In `api/AleTrack/AleTrack/Entities/Order.cs`, after `ClientId`:

```csharp
    /// <summary>
    /// Where this order is delivered. The order is the source of truth; the
    /// outgoing-shipment stop inherits this and may override it.
    /// </summary>
    [Column("delivery_address_kind")]
    public DeliveryAddressKind DeliveryAddressKind { get; set; }

    /// <summary>
    /// The client's saved delivery place this order goes to. Set only when
    /// <see cref="DeliveryAddressKind"/> is
    /// <see cref="Common.Enums.DeliveryAddressKind.DeliveryPlace"/>.
    /// </summary>
    [Column("client_delivery_place_id")]
    public long? ClientDeliveryPlaceId { get; set; }

    /// <summary>
    /// Delivery place this order goes to. Deliberately resolvable even when
    /// soft-deleted, so an order pointing at a since-removed place keeps
    /// rendering its address.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public ClientDeliveryPlace? ClientDeliveryPlace { get; set; }
```

- [ ] **Step 4: Add the `OutgoingShipmentStop` properties**

In `api/AleTrack/AleTrack/Entities/OutgoingShipmentStop.cs`, after `ClientDeliveryPlaceId`:

```csharp
    /// <summary>
    /// True when the planner chose an address other than the one the stop's
    /// order says. This is what suppresses propagation: an order edit rewrites
    /// an inherited stop's address, never an overridden one. Derived at write
    /// time by comparing the requested choice against the order's — never sent
    /// by the client.
    /// </summary>
    [Column("is_address_overridden")]
    public bool IsAddressOverridden { get; set; }

    /// <summary>
    /// Stamped when an order edit changed the delivery address under this
    /// active shipment — whether or not the change propagated here. Drives the
    /// shipment banner; cleared by acknowledging it or by saving the shipment.
    /// </summary>
    [Column("address_changed_at")]
    public DateTime? AddressChangedAt { get; set; }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: 2 passed.

- [ ] **Step 6: Generate the migration**

```bash
cd api/AleTrack/AleTrack
dotnet ef migrations add AddOrderDeliveryAddress
```

Expected: a new pair of files under `Infrastructure/Persistence/Migrations/`. **Trap:** the design-time factory reads only `appsettings`, never env vars — that is fine for generating a migration, which needs no live DB.

- [ ] **Step 7: Add the backfill to the generated migration**

Open the generated `*_AddOrderDeliveryAddress.cs`. At the **end** of `Up()`, after the `AddColumn` calls:

```csharp
            // A stop the planner deliberately moved off the default predates
            // this feature and must count as an override, so the first order
            // edit after this ships cannot silently relocate a delivery that
            // someone already decided on.
            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_stops
                SET is_address_overridden = true
                WHERE selected_address_kind <> 0 OR client_delivery_place_id IS NOT NULL;
                """);
```

`address_changed_at` needs no backfill — nothing has changed yet, so null is correct.

Confirm the generated `AddColumn` for `delivery_address_kind` has `nullable: false` and `defaultValue: 0`, and that `is_address_overridden` has `nullable: false, defaultValue: false`. If EF emitted them nullable, add the defaults by hand.

- [ ] **Step 8: Apply the migration against the local DB and verify the columns**

```bash
cd api/AleTrack && docker compose up -d
cd AleTrack && dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"
```

Expected: applies without error. If you have no local DB, say so rather than claiming this step passed.

- [ ] **Step 9: Run the full backend suite**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add api/AleTrack
git commit -m "feat(orders): add delivery-address columns to orders and shipment stops

orders gains delivery_address_kind + client_delivery_place_id;
outgoing_shipment_stops gains is_address_overridden + address_changed_at.
Existing stops on a non-default address backfill as overridden so the first
order edit cannot stomp a pre-feature decision."
```

---

### Task 3: Shared `ClientDeliveryPlaceResolver`

The soft-delete and cross-client rules currently live inside `ShipmentStopDeliveryPlaceResolver`. Extract the lookup primitive so the order write path reuses it verbatim rather than reimplementing it.

**Files:**
- Create: `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/ClientDeliveryPlaceResolver.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentStopDeliveryPlaceResolver.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs`

**Interfaces:**
- Consumes: `AleTrackDbContext.ClientDeliveryPlaces`, `ThrowHelper`.
- Produces:
  - `record ResolvedDeliveryPlace(Guid PublicId, long Id, Guid ClientPublicId)`
  - `ClientDeliveryPlaceResolver.ResolveManyAsync(AleTrackDbContext, IReadOnlyCollection<Guid> placePublicIds, IReadOnlyCollection<long> allowedDeletedIds, CancellationToken) → Task<List<ResolvedDeliveryPlace>>`
  - `ClientDeliveryPlaceResolver.ResolveForClientAsync(AleTrackDbContext, Guid clientPublicId, Guid? placePublicId, long? allowedDeletedId, CancellationToken) → Task<long?>`

- [ ] **Step 1: Write the failing tests**

Append to `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs` (add `using AleTrack.Features.ClientDeliveryPlaces;`, `using AleTrack.Tests.Mocks;`, `using AleTrack.Common.Utils;`):

```csharp
    [Fact]
    public async Task ResolveForClient_PlaceOfAnotherClient_Throws()
    {
        var ownerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var owner = ClientBuilder.BuildEntity(publicId: ownerId);
        var other = ClientBuilder.BuildEntity(publicId: otherId);
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: other);
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [owner, other], clientDeliveryPlaces: [place]);

        var act = () => ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, ownerId, place.PublicId, null, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task ResolveForClient_SoftDeletedPlace_ThrowsOnNewAssignment()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: client, isDeleted: true);
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], clientDeliveryPlaces: [place]);

        var act = () => ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, clientId, place.PublicId, null, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }

    // The read model deliberately keeps rendering a soft-deleted place, so an
    // entity already pointing at one has to stay saveable — otherwise editing
    // anything else on it would 404 forever.
    [Fact]
    public async Task ResolveForClient_SoftDeletedPlaceAlreadyReferenced_Resolves()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: client, isDeleted: true);
        place.Id = 42;
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], clientDeliveryPlaces: [place]);

        var result = await ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, clientId, place.PublicId, allowedDeletedId: 42, CancellationToken.None);

        result.Should().Be(42);
    }

    [Fact]
    public async Task ResolveForClient_NullPlaceId_ReturnsNull()
    {
        var db = AleTrackDbContextMockFactory.CreateMock();

        var result = await ClientDeliveryPlaceResolver.ResolveForClientAsync(
            db.Object, Guid.NewGuid(), null, null, CancellationToken.None);

        result.Should().BeNull();
    }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: compile failure — `ClientDeliveryPlaceResolver` does not exist.

- [ ] **Step 3: Write the resolver**

Create `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/ClientDeliveryPlaceResolver.cs`:

```csharp
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces;

/// <summary>
/// A delivery place resolved from its public ID, with the owning client's
/// public ID alongside so callers can run the cross-client check without a
/// second query.
/// </summary>
public sealed record ResolvedDeliveryPlace(Guid PublicId, long Id, Guid ClientPublicId);

/// <summary>
/// Resolves client delivery places referenced by public ID to their internal
/// entity IDs, applying the two rules that the schema cannot express: a
/// soft-deleted place may not be newly assigned, and a place may only be used
/// by its own client. Shared by the order write path and
/// <c>ShipmentStopDeliveryPlaceResolver</c> so the rules cannot drift.
/// </summary>
public static class ClientDeliveryPlaceResolver
{
    /// <param name="allowedDeletedIds">
    /// Entity IDs of places already referenced by the row being saved. A
    /// soft-deleted place in this set is accepted — otherwise re-saving an
    /// entity whose place was deleted after it was chosen would fail forever,
    /// even though the read model deliberately keeps rendering that place.
    /// Only a *new* assignment onto a soft-deleted place is rejected.
    /// </param>
    public static async Task<List<ResolvedDeliveryPlace>> ResolveManyAsync(
        AleTrackDbContext dbContext,
        IReadOnlyCollection<Guid> placePublicIds,
        IReadOnlyCollection<long> allowedDeletedIds,
        CancellationToken ct)
    {
        if (placePublicIds.Count == 0)
            return [];

        var places = await dbContext.ClientDeliveryPlaces
            .Where(p => placePublicIds.Contains(p.PublicId)
                        && (!p.IsDeleted || allowedDeletedIds.Contains(p.Id)))
            .Select(p => new ResolvedDeliveryPlace(p.PublicId, p.Id, p.Client.PublicId))
            .ToListAsync(ct);

        var missing = placePublicIds.Where(id => places.All(p => p.PublicId != id)).ToList();
        if (missing.Count > 0)
            ThrowHelper.PublicEntitiesNotFound(nameof(ClientDeliveryPlace), missing);

        return places;
    }

    /// <summary>
    /// Single-place convenience for the order write path: resolves the place
    /// and asserts it belongs to <paramref name="clientPublicId"/>. Returns
    /// null when no place was requested.
    /// </summary>
    public static async Task<long?> ResolveForClientAsync(
        AleTrackDbContext dbContext,
        Guid clientPublicId,
        Guid? placePublicId,
        long? allowedDeletedId,
        CancellationToken ct)
    {
        if (placePublicId is null)
            return null;

        var places = await ResolveManyAsync(
            dbContext,
            [placePublicId.Value],
            allowedDeletedId.HasValue ? [allowedDeletedId.Value] : [],
            ct);

        var place = places[0];
        if (place.ClientPublicId != clientPublicId)
            ThrowHelper.BadRequest(
                $"Delivery place {place.PublicId} does not belong to client {clientPublicId}.");

        return place.Id;
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: 6 passed.

- [ ] **Step 5: Rewrite `ShipmentStopDeliveryPlaceResolver` to delegate**

In `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentStopDeliveryPlaceResolver.cs`, replace the body of `ResolveAsync` — keeping its signature, its XML docs and its `<remarks>` precondition note — with:

```csharp
        alreadyReferencedPlaceIds ??= [];

        var requestedIds = clientOrderShipments
            .Where(cos => cos.ClientDeliveryPlaceId.HasValue)
            .Select(cos => cos.ClientDeliveryPlaceId!.Value)
            .Distinct()
            .ToList();

        var places = await ClientDeliveryPlaceResolver.ResolveManyAsync(
            dbContext, requestedIds, alreadyReferencedPlaceIds, ct);

        if (places.Count == 0)
            return [];

        var orderClients = await dbContext.Orders
            .Where(o => clientOrderShipments.Select(cos => cos.ClientOrderId).Contains(o.PublicId))
            .Select(o => new { o.PublicId, ClientPublicId = o.Client.PublicId })
            .ToListAsync(ct);

        foreach (var dto in clientOrderShipments.Where(c => c.ClientDeliveryPlaceId.HasValue))
        {
            var place = places.First(p => p.PublicId == dto.ClientDeliveryPlaceId!.Value);
            var order = orderClients.FirstOrDefault(o => o.PublicId == dto.ClientOrderId);
            if (order is not null && order.ClientPublicId != place.ClientPublicId)
                ThrowHelper.BadRequest(
                    $"Delivery place {place.PublicId} does not belong to the client of order {dto.ClientOrderId}.");
        }

        return places.ToDictionary(p => p.PublicId, p => p.Id);
```

Add `using AleTrack.Features.ClientDeliveryPlaces;`.

- [ ] **Step 6: Run the full backend suite**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass, including the existing `ShipmentStopDeliveryPlaceTests` — that class is the regression guard for this refactor.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack
git commit -m "refactor(delivery-places): extract the shared place resolver

The soft-delete and cross-client rules move into ClientDeliveryPlaceResolver
so the order write path reuses them instead of reimplementing them.
ShipmentStopDeliveryPlaceResolver keeps its signature and delegates."
```

---

### Task 4: Order write DTOs and validators

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Create/CreateOrderDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Update/UpdateOrderDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Create/CreateOrderValidator.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Update/UpdateOrderValidator.cs`
- Modify: `api/AleTrack/AleTrack.Tests/Builders/OrderBuilder.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs`

**Interfaces:**
- Produces: `CreateOrderDto.DeliveryAddressKind` / `.ClientDeliveryPlaceId` and the same two on `UpdateOrderDto`. `OrderBuilder.BuildCreateDto` and `BuildUpdateDto` gain optional `deliveryAddressKind` and `clientDeliveryPlaceId` parameters.

The pairing rules go in the validator (pure). The "Contact requires a contact address" rule needs the client row, so it lives in the endpoints (Task 5).

- [ ] **Step 1: Write the failing tests**

Append to `OrderDeliveryAddressTests.cs` (add `using AleTrack.Features.Orders.Commands.Create;` and `...Commands.Update;`):

```csharp
    [Fact]
    public async Task CreateValidator_DeliveryPlaceKindWithoutId_Fails()
    {
        var dto = OrderBuilder.BuildCreateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = null;

        var result = await new CreateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(CreateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationNotNullError);
    }

    [Theory]
    [InlineData(DeliveryAddressKind.Official)]
    [InlineData(DeliveryAddressKind.Contact)]
    public async Task CreateValidator_StandardKindWithPlaceId_Fails(DeliveryAddressKind kind)
    {
        var dto = OrderBuilder.BuildCreateDto();
        dto.DeliveryAddressKind = kind;
        dto.ClientDeliveryPlaceId = Guid.NewGuid();

        var result = await new CreateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(CreateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationError);
    }

    [Fact]
    public async Task CreateValidator_DeliveryPlaceKindWithId_Passes()
    {
        var dto = OrderBuilder.BuildCreateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = Guid.NewGuid();

        var result = await new CreateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateValidator_DeliveryPlaceKindWithoutId_Fails()
    {
        var dto = OrderBuilder.BuildUpdateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = null;

        var result = await new UpdateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(UpdateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationNotNullError);
    }

    [Fact]
    public async Task UpdateValidator_StandardKindWithPlaceId_Fails()
    {
        var dto = OrderBuilder.BuildUpdateDto();
        dto.DeliveryAddressKind = DeliveryAddressKind.Official;
        dto.ClientDeliveryPlaceId = Guid.NewGuid();

        var result = await new UpdateOrderDtoValidator().ValidateAsync(dto);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(UpdateOrderDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationError);
    }
```

If `OrderBuilder.BuildUpdateDto` does not exist, read `AleTrack.Tests/Builders/OrderBuilder.cs` and use whatever the update-DTO factory there is actually called.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: compile failure — `CreateOrderDto` has no `DeliveryAddressKind`.

- [ ] **Step 3: Add the DTO fields**

In both `CreateOrderDto` and `UpdateOrderDto`, after `ClientId`:

```csharp
    /// <summary>
    /// Where this order is delivered. Defaults to
    /// <see cref="DeliveryAddressKind.Official"/>.
    /// </summary>
    public DeliveryAddressKind DeliveryAddressKind { get; set; }

    /// <summary>
    /// The client's saved delivery place. Required when
    /// <see cref="DeliveryAddressKind"/> is
    /// <see cref="Common.Enums.DeliveryAddressKind.DeliveryPlace"/>, and must
    /// be null otherwise.
    /// </summary>
    public Guid? ClientDeliveryPlaceId { get; set; }
```

- [ ] **Step 4: Add the validator rules**

In `CreateOrderDtoValidator` and `UpdateOrderDtoValidator`, before the collection rules:

```csharp
        RuleFor(r => r.DeliveryAddressKind)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError);

        // The enum and the FK can disagree; the schema cannot express the
        // pairing, so it is enforced here — mirroring
        // ClientOrderShipmentDtoValidator so the two surfaces stay identical.
        RuleFor(r => r.ClientDeliveryPlaceId)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError)
            .When(r => r.DeliveryAddressKind == DeliveryAddressKind.DeliveryPlace);

        RuleFor(r => r.ClientDeliveryPlaceId)
            .Null()
            .WithErrorCode(ErrorCodes.ValidationError)
            .When(r => r.DeliveryAddressKind != DeliveryAddressKind.DeliveryPlace);
```

Add `using AleTrack.Common.Enums;` where missing.

- [ ] **Step 5: Extend `OrderBuilder`**

Add `deliveryAddressKind` (default `DeliveryAddressKind.Official`) and `clientDeliveryPlaceId` (default `null`) parameters to the create- and update-DTO factories in `AleTrack.Tests/Builders/OrderBuilder.cs`, and to `BuildEntity`, assigning them onto the returned object.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: 12 passed.

- [ ] **Step 7: Run the full suite and commit**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
git add api/AleTrack
git commit -m "feat(orders): accept a delivery address on order create and update

Adds DeliveryAddressKind + ClientDeliveryPlaceId to both write DTOs with the
kind-to-FK pairing rules, mirroring ClientOrderShipmentDtoValidator."
```

---

### Task 5: Persist the delivery address on create and update

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Orders/Utils/OrderDeliveryAddressWriter.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Create/CreateOrderEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Update/UpdateOrderEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs`

**Interfaces:**
- Consumes: `ClientDeliveryPlaceResolver.ResolveForClientAsync` (Task 3), `Order.DeliveryAddressKind` / `.ClientDeliveryPlaceId` (Task 2).
- Produces: `OrderDeliveryAddressWriter.ApplyAsync(AleTrackDbContext dbContext, Order order, Client client, DeliveryAddressKind kind, Guid? placePublicId, CancellationToken) → Task<bool>` — returns true when the order's address actually changed. Task 6 extends this file with the propagation half.

- [ ] **Step 1: Write the failing tests**

Append to `OrderDeliveryAddressTests.cs`:

```csharp
    [Fact]
    public async Task CreateOrder_WithDeliveryPlace_PersistsKindAndPlace()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: client);
        place.Id = 7;
        var product = ProductBuilder.BuildEntity();
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], products: [product], clientDeliveryPlaces: [place]);

        var dto = OrderBuilder.BuildCreateDto(
            clientId: clientId,
            orderItems: [new CreateOrderItemDto { ProductId = product.PublicId, Quantity = 1 }]);
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = place.PublicId;

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(db.Object);
        await endpoint.HandleAsync(new CreateOrderRequest { Data = dto }, CancellationToken.None);

        var saved = client.Orders.Single();
        saved.DeliveryAddressKind.Should().Be(DeliveryAddressKind.DeliveryPlace);
        saved.ClientDeliveryPlaceId.Should().Be(7);
    }

    [Fact]
    public async Task CreateOrder_ContactKindWithoutContactAddress_Throws()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(
            publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        client.ContactAddress = null;
        var product = ProductBuilder.BuildEntity();
        var db = AleTrackDbContextMockFactory.CreateMock(clients: [client], products: [product]);

        var dto = OrderBuilder.BuildCreateDto(
            clientId: clientId,
            orderItems: [new CreateOrderItemDto { ProductId = product.PublicId, Quantity = 1 }]);
        dto.DeliveryAddressKind = DeliveryAddressKind.Contact;

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(db.Object);
        var act = () => endpoint.HandleAsync(new CreateOrderRequest { Data = dto }, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task CreateOrder_PlaceOfAnotherClient_Throws()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId, officialAddress: AddressBuilder.BuildEntity());
        var stranger = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(client: stranger);
        var product = ProductBuilder.BuildEntity();
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client, stranger], products: [product], clientDeliveryPlaces: [place]);

        var dto = OrderBuilder.BuildCreateDto(
            clientId: clientId,
            orderItems: [new CreateOrderItemDto { ProductId = product.PublicId, Quantity = 1 }]);
        dto.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        dto.ClientDeliveryPlaceId = place.PublicId;

        var endpoint = EndpointBuilder<CreateOrderRequest, CreateOrderEndpoint>.Create(db.Object);
        var act = () => endpoint.HandleAsync(new CreateOrderRequest { Data = dto }, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }
```

Match `ClientBuilder` / `ProductBuilder` / `EndpointBuilder` usage to the neighbouring tests in `AleTrack.Tests/Features/Orders/` — read one first rather than assuming these signatures.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: the three new tests fail — the endpoints ignore the new fields.

- [ ] **Step 3: Write the writer**

Create `api/AleTrack/AleTrack/Features/Orders/Utils/OrderDeliveryAddressWriter.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Infrastructure.Persistence;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// Applies a requested delivery address to an order. Shared by the create and
/// update endpoints so the checks that need the client row — which a
/// FluentValidation rule cannot reach — are written once.
/// </summary>
public static class OrderDeliveryAddressWriter
{
    /// <summary>
    /// Validates and applies the requested address. Returns true when the
    /// order's address actually changed, which is what the update endpoint
    /// uses to decide whether to propagate to the shipment stop.
    /// </summary>
    public static async Task<bool> ApplyAsync(
        AleTrackDbContext dbContext,
        Order order,
        Client client,
        DeliveryAddressKind kind,
        Guid? placePublicId,
        CancellationToken ct)
    {
        // The frontend merely hides the option; nothing stops a direct caller
        // from asking for a contact address the client does not have.
        if (kind == DeliveryAddressKind.Contact && client.ContactAddress is null)
            ThrowHelper.BadRequest($"Client {client.PublicId} has no contact address.");

        var placeId = await ClientDeliveryPlaceResolver.ResolveForClientAsync(
            dbContext,
            client.PublicId,
            placePublicId,
            allowedDeletedId: order.ClientDeliveryPlaceId,
            ct);

        var changed = order.DeliveryAddressKind != kind || order.ClientDeliveryPlaceId != placeId;

        order.DeliveryAddressKind = kind;
        order.ClientDeliveryPlaceId = placeId;

        return changed;
    }
}
```

- [ ] **Step 4: Call it from `CreateOrderEndpoint`**

In `HandleAsync`, after the `order` object is constructed and before `client!.Orders.Add(order)`:

```csharp
        await OrderDeliveryAddressWriter.ApplyAsync(
            dbContext, order, client!, req.Data.DeliveryAddressKind, req.Data.ClientDeliveryPlaceId, ct);
```

A newly created order is on no shipment, so nothing propagates here — the return value is deliberately ignored.

- [ ] **Step 5: Call it from `UpdateOrderEndpoint`**

In `HandleAsync`, after the `order.State = req.Data.State;` line:

```csharp
        await OrderDeliveryAddressWriter.ApplyAsync(
            dbContext, order, order.Client, req.Data.DeliveryAddressKind, req.Data.ClientDeliveryPlaceId, ct);
```

Task 6 captures the returned flag; for now the call is enough to make the fields persist.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: 15 passed.

- [ ] **Step 7: Run the full suite and commit**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
git add api/AleTrack
git commit -m "feat(orders): persist the chosen delivery address

OrderDeliveryAddressWriter runs the checks a validator cannot reach — the
client must own the place, and Contact requires a contact address — and is
shared by the create and update endpoints."
```

---

### Task 6: Propagate an order edit to its shipment stop

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Orders/Utils/OrderDeliveryAddressWriter.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Commands/Update/UpdateOrderEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressPropagationTests.cs`

**Interfaces:**
- Consumes: `OrderDeliveryAddressWriter.ApplyAsync` (Task 5), `OutgoingShipmentStop.IsAddressOverridden` / `.AddressChangedAt` (Task 2).
- Produces: `OrderDeliveryAddressWriter.PropagateToStopAsync(AleTrackDbContext dbContext, Order order, DateTime now, CancellationToken) → Task`.

- [ ] **Step 1: Write the failing tests**

Create `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressPropagationTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Orders;

public sealed class OrderDeliveryAddressPropagationTests
{
    private static readonly DateTime Now = new(2026, 7, 27, 10, 0, 0, DateTimeKind.Utc);

    /// Builds an order already planned onto a stop of a shipment in the given
    /// state, with the order's address deliberately ahead of the stop's.
    private static (Order Order, OutgoingShipmentStop Stop) Planned(
        OutgoingShipmentState shipmentState,
        bool overridden)
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(client: client);
        order.DeliveryAddressKind = DeliveryAddressKind.Contact;

        var shipment = new OutgoingShipment { PublicId = Guid.NewGuid(), State = shipmentState };
        var stop = new OutgoingShipmentStop
        {
            Kind = OutgoingShipmentStopKind.Order,
            Order = 1,
            ClientOrder = order,
            OutgoingShipment = shipment,
            SelectedAddressKind = DeliveryAddressKind.Official,
            IsAddressOverridden = overridden
        };
        shipment.Stops.Add(stop);
        order.OutgoingShipmentStop = stop;

        return (order, stop);
    }

    [Fact]
    public async Task Propagate_InheritedStop_FollowsTheOrderAndIsStamped()
    {
        var (order, stop) = Planned(OutgoingShipmentState.Created, overridden: false);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order]);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(db.Object, order, Now, CancellationToken.None);

        stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Contact);
        stop.ClientDeliveryPlaceId.Should().Be(order.ClientDeliveryPlaceId);
        stop.AddressChangedAt.Should().Be(Now);
    }

    // The planner's override wins, but the divergence is announced — that is
    // the warning nobody would otherwise notice.
    [Fact]
    public async Task Propagate_OverriddenStop_KeepsItsAddressButIsStamped()
    {
        var (order, stop) = Planned(OutgoingShipmentState.Created, overridden: true);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order]);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(db.Object, order, Now, CancellationToken.None);

        stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Official);
        stop.AddressChangedAt.Should().Be(Now);
    }

    [Theory]
    [InlineData(OutgoingShipmentState.Delivered)]
    [InlineData(OutgoingShipmentState.Cancelled)]
    public async Task Propagate_ClosedShipment_IsUntouched(OutgoingShipmentState state)
    {
        var (order, stop) = Planned(state, overridden: false);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order]);

        await OrderDeliveryAddressWriter.PropagateToStopAsync(db.Object, order, Now, CancellationToken.None);

        stop.SelectedAddressKind.Should().Be(DeliveryAddressKind.Official);
        stop.AddressChangedAt.Should().BeNull();
    }

    [Fact]
    public async Task Propagate_OrderOnNoShipment_DoesNothing()
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var order = OrderBuilder.BuildEntity(client: client);
        var db = AleTrackDbContextMockFactory.CreateMock(orders: [order]);

        var act = () => OrderDeliveryAddressWriter.PropagateToStopAsync(
            db.Object, order, Now, CancellationToken.None);

        await act.Should().NotThrowAsync();
    }
}
```

Match `OutgoingShipment` / `OutgoingShipmentStop` construction to the neighbouring `ShipmentStopDeliveryPlaceTests` — read it before writing, and use its builders where they exist.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressPropagationTests"`
Expected: compile failure — `PropagateToStopAsync` does not exist.

- [ ] **Step 3: Add the propagation method**

Append to `OrderDeliveryAddressWriter`:

```csharp
    /// <summary>
    /// Pushes an order's newly changed delivery address onto the stop it is
    /// planned into, if any. An order has at most one stop, so this is a
    /// single-row update. Call it only when
    /// <see cref="ApplyAsync"/> reported an actual change.
    /// </summary>
    /// <remarks>
    /// A stop the planner overrode keeps its own address but is stamped all
    /// the same: the shipment then shows "the order disagrees with this stop",
    /// which is the more valuable of the two warnings. Stops on delivered or
    /// cancelled shipments are left alone entirely — their address is history.
    /// </remarks>
    public static async Task PropagateToStopAsync(
        AleTrackDbContext dbContext,
        Order order,
        DateTime now,
        CancellationToken ct)
    {
        var stop = await dbContext.OutgoingShipmentStops
            .Include(s => s.OutgoingShipment)
            .FirstOrDefaultAsync(s => s.ClientOrder != null && s.ClientOrder.PublicId == order.PublicId, ct);

        if (stop is null)
            return;

        if (stop.OutgoingShipment.State is OutgoingShipmentState.Delivered or OutgoingShipmentState.Cancelled)
            return;

        if (!stop.IsAddressOverridden)
        {
            stop.SelectedAddressKind = order.DeliveryAddressKind;
            stop.ClientDeliveryPlaceId = order.ClientDeliveryPlaceId;
        }

        stop.AddressChangedAt = now;
    }
```

Add `using Microsoft.EntityFrameworkCore;`. If `AleTrackDbContext` has no `OutgoingShipmentStops` DbSet, reach the stop through `dbContext.OutgoingShipments.SelectMany(s => s.Stops)` instead and adjust the test's mock setup to match.

- [ ] **Step 4: Wire it into `UpdateOrderEndpoint`**

Replace the Task 5 call site with:

```csharp
        var addressChanged = await OrderDeliveryAddressWriter.ApplyAsync(
            dbContext, order, order.Client, req.Data.DeliveryAddressKind, req.Data.ClientDeliveryPlaceId, ct);

        if (addressChanged)
            await OrderDeliveryAddressWriter.PropagateToStopAsync(dbContext, order, DateTime.UtcNow, ct);
```

Note this sits **after** the client reassignment block, so changing an order's client — which invalidates the old place — takes the same path.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressPropagationTests"`
Expected: 5 passed.

- [ ] **Step 6: Run the full suite and commit**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
git add api/AleTrack
git commit -m "feat(orders): propagate an order's address change to its shipment stop

An inherited stop follows the order; an overridden one keeps its address.
Either way the stop is stamped so the shipment can raise a banner. Stops on
delivered or cancelled shipments are left alone."
```

---

### Task 7: Return the resolved address on the order detail

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Orders/Utils/OrderDeliveryAddressDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/Detail/OrderDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/Detail/GetOrderDetailEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs`

**Interfaces:**
- Produces: `OrderDeliveryAddressDto { DeliveryAddressKind Kind; Guid? PlaceId; string? PlaceName; string? PlaceNote; AddressDto? Address; }` and `OrderDto.DeliveryAddress` of that type. Task 8 reuses the DTO on the shipment stop; Task 11 reads `PlaceId` to re-select the choice; Task 12 renders it.

- [ ] **Step 1: Write the failing tests**

Append to `OrderDeliveryAddressTests.cs`:

```csharp
    [Fact]
    public async Task OrderDetail_OfficialKind_ReturnsTheOfficialAddress()
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity(city: "Liberec"));
        var order = OrderBuilder.BuildEntity(client: client);
        var db = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var endpoint = EndpointBuilder<GetOrderDetailRequest, GetOrderDetailEndpoint>.Create(db.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = order.PublicId }, CancellationToken.None);

        var result = endpoint.Response;
        result.DeliveryAddress.Kind.Should().Be(DeliveryAddressKind.Official);
        result.DeliveryAddress.Address!.City.Should().Be("Liberec");
        result.DeliveryAddress.PlaceName.Should().BeNull();
    }

    // The place is projected without the !IsDeleted filter on purpose: an order
    // pointing at a since-removed place must keep showing where it went.
    [Fact]
    public async Task OrderDetail_SoftDeletedPlace_StillResolves()
    {
        var client = ClientBuilder.BuildEntity(officialAddress: AddressBuilder.BuildEntity());
        var place = ClientDeliveryPlaceBuilder.BuildEntity(
            client: client, name: "Letní zahrádka", note: "Vjezd zezadu", isDeleted: true);
        place.Id = 11;
        var order = OrderBuilder.BuildEntity(client: client);
        order.DeliveryAddressKind = DeliveryAddressKind.DeliveryPlace;
        order.ClientDeliveryPlaceId = 11;
        order.ClientDeliveryPlace = place;
        var db = AleTrackDbContextMockFactory.CreateMock(
            clients: [client], orders: [order], clientDeliveryPlaces: [place]);

        var endpoint = EndpointBuilder<GetOrderDetailRequest, GetOrderDetailEndpoint>.Create(db.Object);
        await endpoint.HandleAsync(new GetOrderDetailRequest { Id = order.PublicId }, CancellationToken.None);

        var addr = endpoint.Response.DeliveryAddress;
        addr.Kind.Should().Be(DeliveryAddressKind.DeliveryPlace);
        addr.PlaceName.Should().Be("Letní zahrádka");
        addr.PlaceNote.Should().Be("Vjezd zezadu");
        addr.Address.Should().NotBeNull();
    }
```

Read an existing detail-endpoint test in `AleTrack.Tests/Features/Orders/` first and copy how it reads the response — `endpoint.Response` may not be the accessor this codebase uses.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: compile failure — `OrderDto` has no `DeliveryAddress`.

- [ ] **Step 3: Create the DTO**

Create `api/AleTrack/AleTrack/Features/Orders/Utils/OrderDeliveryAddressDto.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// An order's delivery destination, already resolved server-side so the
/// consumer renders it without looking anything up. Returned on the order
/// detail and on an outgoing-shipment stop.
/// </summary>
public sealed record OrderDeliveryAddressDto
{
    /// <summary>
    /// Which of the three kinds of address this is
    /// </summary>
    public DeliveryAddressKind Kind { get; set; }

    /// <summary>
    /// Public ID of the delivery place, so an editor can re-select the exact
    /// choice. The name alone does not round-trip — two places may share one.
    /// </summary>
    public Guid? PlaceId { get; set; }

    /// <summary>
    /// Name of the delivery place. Set only for
    /// <see cref="DeliveryAddressKind.DeliveryPlace"/>, and set even when the
    /// place has since been soft-deleted.
    /// </summary>
    public string? PlaceName { get; set; }

    /// <summary>
    /// The place's instruction for the driver
    /// </summary>
    public string? PlaceNote { get; set; }

    /// <summary>
    /// The resolved destination. Null only if the client has no address of the
    /// selected kind at all.
    /// </summary>
    public AddressDto? Address { get; set; }
}
```

- [ ] **Step 4: Add the field to `OrderDto`**

In `OrderDto`, after `Client`:

```csharp
    /// <summary>
    /// Where this order is delivered, resolved
    /// </summary>
    public OrderDeliveryAddressDto DeliveryAddress { get; set; } = null!;
```

- [ ] **Step 5: Project it in `GetOrderDetailEndpoint`**

In the `.Select(o => new OrderDto { ... })`, after the `Client = new ClientInfoDto { ... },` block:

```csharp
                DeliveryAddress = new OrderDeliveryAddressDto
                {
                    Kind = o.DeliveryAddressKind,
                    PlaceId = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.PublicId : null,
                    PlaceName = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.Name : null,
                    PlaceNote = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.Note : null,
                    Address =
                        o.DeliveryAddressKind == DeliveryAddressKind.DeliveryPlace && o.ClientDeliveryPlace != null
                            ? new AddressDto
                            {
                                StreetName = o.ClientDeliveryPlace.Address.StreetName,
                                StreetNumber = o.ClientDeliveryPlace.Address.StreetNumber,
                                City = o.ClientDeliveryPlace.Address.City,
                                Zip = o.ClientDeliveryPlace.Address.Zip,
                                Country = o.ClientDeliveryPlace.Address.Country,
                                Latitude = o.ClientDeliveryPlace.Address.Latitude,
                                Longitude = o.ClientDeliveryPlace.Address.Longitude
                            }
                            : o.DeliveryAddressKind == DeliveryAddressKind.Contact && o.Client.ContactAddress != null
                                ? new AddressDto
                                {
                                    StreetName = o.Client.ContactAddress.StreetName,
                                    StreetNumber = o.Client.ContactAddress.StreetNumber,
                                    City = o.Client.ContactAddress.City,
                                    Zip = o.Client.ContactAddress.Zip,
                                    Country = o.Client.ContactAddress.Country,
                                    Latitude = o.Client.ContactAddress.Latitude,
                                    Longitude = o.Client.ContactAddress.Longitude
                                }
                                : new AddressDto
                                {
                                    StreetName = o.Client.OfficialAddress.StreetName,
                                    StreetNumber = o.Client.OfficialAddress.StreetNumber,
                                    City = o.Client.OfficialAddress.City,
                                    Zip = o.Client.OfficialAddress.Zip,
                                    Country = o.Client.OfficialAddress.Country,
                                    Latitude = o.Client.OfficialAddress.Latitude,
                                    Longitude = o.Client.OfficialAddress.Longitude
                                }
                },
```

If the codebase already has an `AddressDto` projection helper (check `Common/Models/` and how `GetOutgoingShipmentDetailEndpoint` projects `OfficialAddress`), use that instead of these three inline blocks — a projection expression cannot call an arbitrary method, but an existing extension built for EF will be there precisely for this.

Add `using AleTrack.Common.Models;` if missing.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: 17 passed.

- [ ] **Step 7: Run the full suite and commit**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
git add api/AleTrack
git commit -m "feat(orders): return the resolved delivery address on the order detail

Projected server-side, including a soft-deleted place, so the detail screen
renders it without a lookup."
```

---

### Task 8: Shipment DTOs and the derived override flag

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/OutgoingShipmentsList/OutgoingShipmentOrderDto.cs` + `GetOrdersListForOutgoingShipmentsEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Detail/OutgoingShipmentDetailDto.cs` + `GetOutgoingShipmentDetailEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Create/CreateOutgoingShipmentEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentStopDeliveryPlaceTests.cs`

**Interfaces:**
- Consumes: `OrderDeliveryAddressDto` (Task 7), `OutgoingShipmentStop.IsAddressOverridden` / `.AddressChangedAt` (Task 2).
- Produces: `OutgoingShipmentOrderDto.DeliveryAddressKind` + `.ClientDeliveryPlaceId`; `OutgoingShipmentStopDto.IsAddressOverridden`, `.AddressChangedAt`, `.OrderDeliveryAddress`.

- [ ] **Step 1: Write the failing tests**

Append to `AleTrack.Tests/Features/OutgoingShipments/ShipmentStopDeliveryPlaceTests.cs`:

```csharp
    [Fact]
    public async Task ProcessAsync_UpdateShipment_StopMatchingTheOrderIsNotOverridden()
    {
        // Build a shipment update whose stop asks for exactly the address the
        // order already carries; the flag must come out false.
        // (Copy the fixture setup from
        // ProcessAsync_UpdateShipment_ChangesAddressKindOnExistingStop above,
        // setting order.DeliveryAddressKind = DeliveryAddressKind.Contact and
        // posting SelectedAddressKind = DeliveryAddressKind.Contact.)
        Assert.Fail("replace with the fixture from the neighbouring test");
    }

    [Fact]
    public async Task ProcessAsync_UpdateShipment_StopDifferingFromTheOrderIsOverridden()
    {
        Assert.Fail("replace with the fixture from the neighbouring test");
    }

    [Fact]
    public async Task ProcessAsync_UpdateShipment_ClearsPendingAddressChangeStamp()
    {
        Assert.Fail("replace with the fixture from the neighbouring test");
    }
```

Then immediately fill each one in from the fixture in `ProcessAsync_UpdateShipment_ChangesAddressKindOnExistingStop`, which already builds a client, an order, an existing stop and a shipment-update request. The three assertions are `stop.IsAddressOverridden.Should().BeFalse()`, `.BeTrue()`, and `stop.AddressChangedAt.Should().BeNull()` after a pre-set stamp.

- [ ] **Step 2: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentStopDeliveryPlaceTests"`
Expected: the three new tests fail.

- [ ] **Step 3: Extend `OutgoingShipmentOrderDto`**

After `ClientDeliveryPlaces`:

```csharp
    /// <summary>
    /// The delivery address the order itself asks for. A stop added for this
    /// order inherits it rather than defaulting to the billing address.
    /// </summary>
    public DeliveryAddressKind DeliveryAddressKind { get; set; }

    /// <summary>
    /// The order's chosen delivery place, when its kind is
    /// <see cref="DeliveryAddressKind.DeliveryPlace"/>
    /// </summary>
    public Guid? ClientDeliveryPlaceId { get; set; }
```

Project both in `GetOrdersListForOutgoingShipmentsEndpoint`:

```csharp
                DeliveryAddressKind = o.DeliveryAddressKind,
                ClientDeliveryPlaceId = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.PublicId : null,
```

- [ ] **Step 4: Extend `OutgoingShipmentStopDto`**

After `DeliveryPlace`:

```csharp
    /// <summary>
    /// True when the planner routed this stop somewhere other than what its
    /// order asks for. An order edit will not rewrite such a stop.
    /// </summary>
    public bool IsAddressOverridden { get; set; }

    /// <summary>
    /// Set when an order edit changed the delivery address under this shipment
    /// and nobody has acknowledged it yet. Drives the banner.
    /// </summary>
    public DateTime? AddressChangedAt { get; set; }

    /// <summary>
    /// What the order currently asks for, so the banner can name the
    /// difference rather than merely assert one
    /// </summary>
    public OrderDeliveryAddressDto? OrderDeliveryAddress { get; set; }
```

Project them in `GetOutgoingShipmentDetailEndpoint`, reusing the same `OrderDeliveryAddressDto` shape written in Task 7 Step 5 but sourced from `s.ClientOrder`.

- [ ] **Step 5: Derive the override flag on both write endpoints**

In `CreateOutgoingShipmentEndpoint` and `UpdateOutgoingShipmentEndpoint`, wherever a stop's `SelectedAddressKind` and `ClientDeliveryPlaceId` are assigned from the request, add immediately after:

```csharp
            // Derived, never sent: a stale client-supplied flag would silently
            // disable propagation from the order.
            stop.IsAddressOverridden =
                stop.SelectedAddressKind != order.DeliveryAddressKind
                || stop.ClientDeliveryPlaceId != order.ClientDeliveryPlaceId;

            // The planner has just been looking at this shipment; whatever the
            // banner was announcing has been seen.
            stop.AddressChangedAt = null;
```

`order` is the `Order` entity the stop is being linked to — already in scope in both endpoints where the stop is built.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentStopDeliveryPlaceTests"`
Expected: all pass, new ones included.

- [ ] **Step 7: Run the full suite and commit**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
git add api/AleTrack
git commit -m "feat(shipments): expose the order's delivery address on shipment DTOs

The unassigned-orders list carries the order's choice so a new stop inherits
it, and the stop read model carries the override flag, the pending-change
stamp and the order's current address for the banner."
```

---

### Task 9: The acknowledge endpoint

**Files:**
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/AcknowledgeAddressChanges/AcknowledgeAddressChangesEndpoint.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentStopDeliveryPlaceTests.cs`

**Interfaces:**
- Produces: `POST outgoing-shipments/{Id:guid}/acknowledge-address-changes` → 204. Request type `AcknowledgeAddressChangesRequest { Guid Id }`. Task 14 calls it.

- [ ] **Step 1: Write the failing test**

Append to `ShipmentStopDeliveryPlaceTests.cs`:

```csharp
    [Fact]
    public async Task ProcessAsync_AcknowledgeAddressChanges_ClearsEveryStopOfThatShipmentOnly()
    {
        var target = new OutgoingShipment { PublicId = Guid.NewGuid(), State = OutgoingShipmentState.Created };
        var other = new OutgoingShipment { PublicId = Guid.NewGuid(), State = OutgoingShipmentState.Created };
        var stamped = new DateTime(2026, 7, 27, 9, 0, 0, DateTimeKind.Utc);

        target.Stops.Add(new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, AddressChangedAt = stamped });
        target.Stops.Add(new OutgoingShipmentStop { Order = 2, Kind = OutgoingShipmentStopKind.Order, AddressChangedAt = stamped });
        other.Stops.Add(new OutgoingShipmentStop { Order = 1, Kind = OutgoingShipmentStopKind.Order, AddressChangedAt = stamped });

        var db = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: [target, other]);

        var endpoint = EndpointBuilder<AcknowledgeAddressChangesRequest, AcknowledgeAddressChangesEndpoint>
            .Create(db.Object);
        await endpoint.HandleAsync(new AcknowledgeAddressChangesRequest { Id = target.PublicId }, CancellationToken.None);

        target.Stops.Should().OnlyContain(s => s.AddressChangedAt == null);
        other.Stops.Should().OnlyContain(s => s.AddressChangedAt == stamped);
        db.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_AcknowledgeAddressChanges_UnknownShipment_Throws()
    {
        var db = AleTrackDbContextMockFactory.CreateMock(outgoingShipments: []);

        var endpoint = EndpointBuilder<AcknowledgeAddressChangesRequest, AcknowledgeAddressChangesEndpoint>
            .Create(db.Object);
        var act = () => endpoint.HandleAsync(
            new AcknowledgeAddressChangesRequest { Id = Guid.NewGuid() }, CancellationToken.None);

        await act.Should().ThrowAsync<Exception>();
    }
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentStopDeliveryPlaceTests"`
Expected: compile failure — the endpoint does not exist.

- [ ] **Step 3: Write the endpoint**

Create `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/AcknowledgeAddressChanges/AcknowledgeAddressChangesEndpoint.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Commands.AcknowledgeAddressChanges;

/// <summary>
/// Request to dismiss the delivery-address-change notice on a shipment
/// </summary>
public sealed record AcknowledgeAddressChangesRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Clears the pending delivery-address-change stamp on every stop of a
/// shipment — the "Rozumím" action behind the banner. Separate from the
/// shipment update because the read-only detail screen must be able to dismiss
/// the notice without saving the whole shipment.
/// </summary>
public sealed class AcknowledgeAddressChangesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<AcknowledgeAddressChangesRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/acknowledge-address-changes");
        Description(b => b
            .RequirePermission(ModuleType.OutgoingShipments, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(AcknowledgeAddressChangesEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Dismisses the delivery-address-change notice on a shipment";
            s.Responses[StatusCodes.Status204NoContent] = "Notice dismissed";
            s.SetNotFoundResponse("OutgoingShipment");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AcknowledgeAddressChangesRequest req, CancellationToken ct)
    {
        var shipment = await dbContext.OutgoingShipments
            .Include(s => s.Stops)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (shipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        foreach (var stop in shipment!.Stops)
            stop.AddressChangedAt = null;

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
```

Confirm `ModuleType.OutgoingShipments` is the actual member name by reading a neighbouring shipment endpoint's `Configure`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentStopDeliveryPlaceTests"`
Expected: all pass.

- [ ] **Step 5: Run the full suite and commit**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
git add api/AleTrack
git commit -m "feat(shipments): add the acknowledge-address-changes endpoint

Clears the pending stamp on every stop of a shipment so the read-only detail
can dismiss the banner without saving the shipment."
```

---

### Task 10: Regenerate the client and extract the shared address module

**Files:**
- Regenerate: `app/src/generated/api-client.ts`
- Create: `app/src/features/clients/deliveryAddress.ts`
- Create: `app/src/features/clients/deliveryAddress.test.ts`
- Modify: `app/src/features/shipments/stopAddress.ts`, `app/src/features/shipments/stopAddress.test.ts`

**Interfaces:**
- Consumes: every backend DTO from Tasks 4–9.
- Produces, from `src/features/clients/deliveryAddress.ts`:
  - `NEW_PLACE_CHOICE: '__new'`
  - `encodeStopChoice(kind: DeliveryAddressKind, deliveryPlaceId?: string): string`
  - `decodeStopChoice(value: string): { addressKind: DeliveryAddressKind; deliveryPlaceId?: string }`
  - `resolveFromAddresses(kind, official?, contact?): { lat?: number; lng?: number; text: string }`
  - `resolveOrderDeliveryAddress(official: AddressDto | undefined, contact: AddressDto | undefined, places: ClientDeliveryPlaceDto[], kind: DeliveryAddressKind, placeId?: string): { text: string; placeName?: string; placeNote?: string }`
- `stopAddress.ts` keeps exporting `resolveStopAddress` and `resolveDetailStopAddress` unchanged, re-importing the moved helpers. **Do not re-export them from `stopAddress.ts`** — update the importers instead, so there is one path to each symbol.

- [ ] **Step 1: Regenerate the client**

```bash
cd api/AleTrack && dotnet run --project AleTrack --launch-profile Local
# separately:
cd app && yarn generate-api
grep -n "deliveryAddress\|isAddressOverridden\|acknowledgeAddressChanges" app/src/generated/api-client.ts | head
```

Expected: hits for `OrderDeliveryAddressDto`, `isAddressOverridden`, `addressChangedAt`, and an `acknowledgeAddressChangesEndpoint` method. Check `lsof -ti:8080` first — regenerating against a stale backend on that port produces a silently wrong client.

- [ ] **Step 2: Write the failing test**

Create `app/src/features/clients/deliveryAddress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DeliveryAddressKind, type AddressDto, type ClientDeliveryPlaceDto } from 'src/generated/api-client';
import { decodeStopChoice, encodeStopChoice, resolveOrderDeliveryAddress } from './deliveryAddress';

const official = { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' } as AddressDto;
const contact = { streetName: 'Vedlejší', streetNumber: '2', city: 'Jablonec', zip: '46601' } as AddressDto;
const place = {
  id: 'p1', name: 'Letní zahrádka', note: 'Vjezd zezadu',
  address: { latitude: 50.7, longitude: 15.05 },
} as ClientDeliveryPlaceDto;

describe('choice encoding', () => {
  it('round-trips a place whose id is the literal "Official"', () => {
    const encoded = encodeStopChoice(DeliveryAddressKind.DeliveryPlace, 'Official');
    expect(decodeStopChoice(encoded)).toEqual({
      addressKind: DeliveryAddressKind.DeliveryPlace,
      deliveryPlaceId: 'Official',
    });
  });

  it('round-trips the two standard kinds', () => {
    expect(decodeStopChoice(encodeStopChoice(DeliveryAddressKind.Contact)).addressKind)
      .toBe(DeliveryAddressKind.Contact);
    expect(decodeStopChoice(encodeStopChoice(DeliveryAddressKind.Official)).addressKind)
      .toBe(DeliveryAddressKind.Official);
  });
});

describe('resolveOrderDeliveryAddress', () => {
  it('uses the official address for the Official kind', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [], DeliveryAddressKind.Official);
    expect(r.text).toContain('Hlavní');
    expect(r.placeName).toBeUndefined();
  });

  it('uses the contact address for the Contact kind', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [], DeliveryAddressKind.Contact);
    expect(r.text).toContain('Vedlejší');
  });

  it('returns the place name and note for a place, falling back to coordinates with no street', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [place], DeliveryAddressKind.DeliveryPlace, 'p1');
    expect(r.placeName).toBe('Letní zahrádka');
    expect(r.placeNote).toBe('Vjezd zezadu');
    expect(r.text).toContain('50.7000');
  });

  // A place soft-deleted since the order chose it is no longer in the list.
  // The preview must not silently claim the billing address is the place.
  it('falls back to the official address when the place id is unknown', () => {
    const r = resolveOrderDeliveryAddress(official, contact, [], DeliveryAddressKind.DeliveryPlace, 'gone');
    expect(r.text).toContain('Hlavní');
    expect(r.placeName).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd app && yarn test:run src/features/clients/deliveryAddress.test.ts`
Expected: FAIL — cannot resolve `./deliveryAddress`.

- [ ] **Step 4: Create the module**

Create `app/src/features/clients/deliveryAddress.ts`, moving `NEW_PLACE_CHOICE`, `encodeStopChoice`, `decodeStopChoice` and `resolveFromAddresses` **verbatim** out of `src/features/shipments/stopAddress.ts` (keep their doc comments — they record decisions), then add:

```ts
/** Resolves an order's chosen delivery address for the editor's preview line.
 * Unlike the shipment-detail resolver, this works off the client's raw
 * addresses and place list, because the order editor's draft is not saved yet
 * and has no server-resolved read model to read from.
 *
 * A `DeliveryPlace` kind whose id is not in `places` — the place was
 * soft-deleted since the order chose it — falls back to the official address,
 * matching `resolveStopAddress`. The *picker* is what keeps the stale choice
 * visibly selected; this function only guarantees the preview never claims a
 * destination that no longer exists. */
export function resolveOrderDeliveryAddress(
  official: AddressDto | undefined,
  contact: AddressDto | undefined,
  places: ClientDeliveryPlaceDto[],
  kind: DeliveryAddressKind,
  placeId?: string,
): { text: string; placeName?: string; placeNote?: string } {
  if (kind === DeliveryAddressKind.DeliveryPlace && placeId) {
    const place = places.find((p) => p.id === placeId);
    if (place) {
      return { text: formatPlaceAddress(place), placeName: place.name, placeNote: place.note ?? undefined };
    }
  }
  return { text: resolveFromAddresses(kind, official, contact).text };
}
```

`resolveFromAddresses` must be exported now that it has an out-of-file caller.

- [ ] **Step 5: Update `stopAddress.ts` and its importers**

Delete the moved symbols from `stopAddress.ts` and import them from `src/features/clients/deliveryAddress`. Point `ShipmentEditor.tsx` and `ShipmentDetail.tsx` at the new module for `encodeStopChoice` / `decodeStopChoice` / `NEW_PLACE_CHOICE`. Move the encode/decode cases out of `stopAddress.test.ts` into `deliveryAddress.test.ts` — do not leave them duplicated.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd app && yarn test:run && yarn build && yarn lint
```

Expected: all green; the moved `stopAddress` cases now live in the new file, so the total count should be unchanged plus the five new ones.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "refactor(app): extract shared delivery-address helpers, regenerate the client

encodeStopChoice/decodeStopChoice/resolveFromAddresses move to
features/clients/deliveryAddress.ts now that orders need them too, joined by
resolveOrderDeliveryAddress for the order editor's preview line."
```

---

### Task 11: The order editor's delivery-address field

**Files:**
- Create: `app/src/features/orders/OrderDeliveryAddressField.tsx`
- Create: `app/src/features/orders/OrderDeliveryAddressField.test.tsx`
- Modify: `app/src/features/orders/OrderEditor.tsx` (`:67` `serializeForm`, `:322` state, `:350-364` load, `:476-490` submit, `:653-675` the client card)

**Interfaces:**
- Consumes: `resolveOrderDeliveryAddress`, `encodeStopChoice`, `decodeStopChoice`, `NEW_PLACE_CHOICE` (Task 10); `useClient`, `useClientDeliveryPlaces`; `DeliveryPlaceDialog` from `src/components/common/DeliveryPlaceDialog`.
- Produces: `<OrderDeliveryAddressField clientId={string | null} value={{ kind, placeId? }} onChange={(v) => void} disabled={boolean} />`.

- [ ] **Step 1: Write the failing test**

Create `app/src/features/orders/OrderDeliveryAddressField.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryAddressKind } from 'src/generated/api-client';
import { OrderDeliveryAddressField } from './OrderDeliveryAddressField';

const place = { id: 'p1', name: 'Letní zahrádka', address: { latitude: 50.7, longitude: 15.05 } };

vi.mock('src/hooks/useClients', () => ({
  useClient: () => ({
    data: {
      officialAddress: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
      contactAddress: undefined,
    },
    isLoading: false,
  }),
}));

vi.mock('src/hooks/useDeliveryPlaces', () => ({
  useClientDeliveryPlaces: () => ({ data: [place], isLoading: false }),
}));

describe('OrderDeliveryAddressField', () => {
  it('is disabled with no client selected', () => {
    render(<OrderDeliveryAddressField clientId={null} value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  });

  it("lists the client's saved places", () => {
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    // MUI Select opens on mouseDown, not click.
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.getByText('Letní zahrádka')).toBeInTheDocument();
  });

  it('hides Kontaktní when the client has no contact address', () => {
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.queryByText('Kontaktní')).not.toBeInTheDocument();
  });

  it('reports the decoded choice when a place is picked', () => {
    const onChange = vi.fn();
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Letní zahrádka'));
    expect(onChange).toHaveBeenCalledWith({ kind: DeliveryAddressKind.DeliveryPlace, placeId: 'p1' });
  });

  it('opens the new-place dialog from the sentinel option', () => {
    render(<OrderDeliveryAddressField clientId="c1" value={{ kind: DeliveryAddressKind.Official }} onChange={vi.fn()} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('+ Nové místo…'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && yarn test:run src/features/orders/OrderDeliveryAddressField.test.tsx`
Expected: FAIL — cannot resolve `./OrderDeliveryAddressField`.

- [ ] **Step 3: Write the component**

Create `app/src/features/orders/OrderDeliveryAddressField.tsx`. Model the `<Select>` on `ShipmentEditor.tsx:148-171` — same option order, same Czech labels, same `ListSubheader` grouping, same soft-deleted handling:

```tsx
// The order's delivery address picker. Deliberately a near-copy of the
// shipment editor's stop picker (ShipmentEditor.tsx) — same options, same
// wording, same `place:<id>` encoding — because they are the same choice made
// at two moments, and a user who learns one must recognise the other.

export function OrderDeliveryAddressField({
  clientId,
  value,
  onChange,
  disabled,
}: {
  clientId: string | null;
  value: { kind: DeliveryAddressKind; placeId?: string };
  onChange: (v: { kind: DeliveryAddressKind; placeId?: string }) => void;
  disabled?: boolean;
}) {
  const clientQuery = useClient(clientId ?? undefined);
  const placesQuery = useClientDeliveryPlaces(clientId ?? undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const places = placesQuery.data ?? [];
  const official = clientQuery.data?.officialAddress;
  const contact = clientQuery.data?.contactAddress;
  const resolved = resolveOrderDeliveryAddress(official, contact, places, value.kind, value.placeId);

  // A place soft-deleted since this order chose it is absent from `places`.
  // Without a disabled entry carrying it, the Select's value matches no option
  // and re-saving would silently relocate the delivery to the billing address.
  const isGone = value.kind === DeliveryAddressKind.DeliveryPlace
    && value.placeId != null
    && !places.some((p) => p.id === value.placeId);

  const handleChange = (raw: string) => {
    if (raw === NEW_PLACE_CHOICE) { setDialogOpen(true); return; }
    const { addressKind, deliveryPlaceId } = decodeStopChoice(raw);
    onChange({ kind: addressKind, placeId: deliveryPlaceId });
  };

  return (
    <Box>
      <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.75 }}>Adresa doručení</Typography>
      <Select
        size="small"
        fullWidth
        disabled={disabled || !clientId}
        value={encodeStopChoice(value.kind, value.placeId)}
        onChange={(e) => handleChange(e.target.value)}
      >
        <MenuItem value="Official">Fakturační</MenuItem>
        {contact && <MenuItem value="Contact">Kontaktní</MenuItem>}
        {places.length > 0 && [
          <ListSubheader key="places-header">Vlastní místa</ListSubheader>,
          ...places.map((p) => (
            <MenuItem key={p.id} value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, p.id)}>{p.name}</MenuItem>
          )),
        ]}
        {isGone && [
          <ListSubheader key="gone-header">Smazané</ListSubheader>,
          <MenuItem key="gone-item" value={encodeStopChoice(DeliveryAddressKind.DeliveryPlace, value.placeId)} disabled>
            {'Smazané místo (smazáno)'}
          </MenuItem>,
        ]}
        <MenuItem value={NEW_PLACE_CHOICE}>+ Nové místo…</MenuItem>
      </Select>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {clientId ? resolved.text : 'Nejprve vyberte klienta.'}
      </Typography>
      {resolved.placeNote && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {resolved.placeNote}
        </Typography>
      )}
      {clientId && (
        <DeliveryPlaceDialog
          open={dialogOpen}
          clientId={clientId}
          clientName={clientQuery.data?.name}
          onClose={() => setDialogOpen(false)}
          onSaved={(placeId) => {
            setDialogOpen(false);
            onChange({ kind: DeliveryAddressKind.DeliveryPlace, placeId });
          }}
        />
      )}
    </Box>
  );
}
```

Add the imports the file needs; keep every user-visible string Czech.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && yarn test:run src/features/orders/OrderDeliveryAddressField.test.tsx`
Expected: 5 passed. If the disabled assertion fails, read what MUI actually renders and assert on that rather than loosening the test away from the behaviour.

- [ ] **Step 5: Wire it into `OrderEditor`**

1. State, next to `clientId` (`OrderEditor.tsx:322`):

```tsx
  const [deliveryAddress, setDeliveryAddress] = useState<{ kind: DeliveryAddressKind; placeId?: string }>(
    { kind: DeliveryAddressKind.Official },
  );
```

2. `serializeForm` (`:67`) takes it as an extra argument and includes it in the serialized object; update all four call sites (`:341`, `:364`, `:448`, and the create-mode baseline) so the unsaved-changes guard sees an address change.

3. On load (`:350-364`):

```tsx
    setDeliveryAddress({
      kind: addrKindValue(o.deliveryAddress?.kind),
      placeId: o.deliveryAddress?.placeId ?? undefined,
    });
```

`addrKindValue` is required: the backend serializes enums as **strings** while the generated TS enum is numeric, so a bare `===` against the wire value is always false.

4. When the client changes, reset — the old place belongs to the old client:

```tsx
  const changeClient = (next: string | null) => {
    setClientId(next);
    setDeliveryAddress({ kind: DeliveryAddressKind.Official });
  };
```

Use `changeClient` for both the `Combobox` `onChange` (`:673`) and the "Změnit" button (`:669`).

5. Render it inside the client card, between the client block and the `DatePicker` (after `:675`):

```tsx
              <OrderDeliveryAddressField
                clientId={clientId}
                value={deliveryAddress}
                onChange={setDeliveryAddress}
              />
```

6. Include both fields in the create and update payloads (`:476`, `:488`):

```tsx
            deliveryAddressKind: deliveryAddress.kind,
            clientDeliveryPlaceId: deliveryAddress.placeId,
```

- [ ] **Step 6: Verify the whole frontend**

```bash
cd app && yarn test:run && yarn build && yarn lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add app
git commit -m "feat(orders): pick the delivery address in the order editor

A picker in the client card offering the billing address, the contact address,
the client's saved places and inline place creation — the same choice, wording
and encoding as the shipment editor's stop picker. Changing the client resets
it, and it participates in the unsaved-changes guard."
```

---

### Task 12: Show the delivery address on the order detail

**Files:**
- Modify: `app/src/features/orders/OrderDetail.tsx:125-132`
- Modify: `app/src/features/orders/OrderDetail.test.tsx`

**Interfaces:**
- Consumes: `OrderDto.deliveryAddress` (Task 7), `formatStreetAddress` from `src/features/clients/deliveryPlaceFormat`, `addrKindLabel` from `src/lib/labels`.

- [ ] **Step 1: Write the failing test**

Append to `app/src/features/orders/OrderDetail.test.tsx`, following how that file already builds an `OrderDto` fixture:

```tsx
  it('shows the billing address for the Official kind', () => {
    renderDetail({
      deliveryAddress: {
        kind: 'Official',
        address: { streetName: 'Hlavní', streetNumber: '1', city: 'Liberec', zip: '46001' },
      },
    });
    expect(screen.getByText(/Hlavní 1/)).toBeInTheDocument();
  });

  it('shows the place name and driver note for a delivery place', () => {
    renderDetail({
      deliveryAddress: {
        kind: 'DeliveryPlace',
        placeName: 'Letní zahrádka',
        placeNote: 'Vjezd zezadu',
        address: { latitude: 50.7, longitude: 15.05 },
      },
    });
    expect(screen.getByText('Letní zahrádka')).toBeInTheDocument();
    expect(screen.getByText('Vjezd zezadu')).toBeInTheDocument();
  });
```

The fixture uses the **string** `'Official'` deliberately: that is what the API actually sends, and asserting on the numeric enum here would test a shape the app never receives.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && yarn test:run src/features/orders/OrderDetail.test.tsx`
Expected: FAIL — the address is not rendered.

- [ ] **Step 3: Render it**

In `OrderDetail.tsx`, immediately after the `headerDate` `<Typography>` block (`:129-132`):

```tsx
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.4, minWidth: 0 }}>
            <PlaceOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
            <Typography color="text.secondary" sx={{ fontSize: 14, minWidth: 0 }} noWrap>
              {formatStreetAddress(order.deliveryAddress?.address)}
            </Typography>
            {order.deliveryAddress?.placeName && (
              <Chip size="small" label={order.deliveryAddress.placeName} sx={{ fontWeight: 700, height: 20 }} />
            )}
          </Stack>
          {order.deliveryAddress?.placeNote && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
              {order.deliveryAddress.placeNote}
            </Typography>
          )}
```

Import `Chip` from `@mui/material`, `PlaceOutlinedIcon` from `@mui/icons-material/PlaceOutlined`, and `formatStreetAddress` from `src/features/clients/deliveryPlaceFormat`.

A place with coordinates only has no street, so `formatStreetAddress` returns a bare `,`-ish string for it — use `formatPlaceAddress`-style coordinate fallback instead if the second test shows that. Prefer fixing the render over loosening the test.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && yarn test:run src/features/orders/OrderDetail.test.tsx`
Expected: all pass.

- [ ] **Step 5: Verify and commit**

```bash
cd app && yarn test:run && yarn build && yarn lint
git add app
git commit -m "feat(orders): show the delivery address on the order detail

Under the client name: the resolved address, the place name as a chip and the
driver note below it when the order goes to a saved place."
```

---

### Task 13: The shipment stop inherits the order's address

**Files:**
- Modify: `app/src/features/shipments/ShipmentEditor.tsx:355` (and `:366` if custom stops share the constructor)
- Modify: `app/src/features/shipments/ShipmentEditor.test.tsx`

**Interfaces:**
- Consumes: `OutgoingShipmentOrderDto.deliveryAddressKind` / `.clientDeliveryPlaceId` (Task 8), `addrKindValue` from `src/lib/labels`.

- [ ] **Step 1: Write the failing test**

Append to `app/src/features/shipments/ShipmentEditor.test.tsx`, following its existing mocking of the unassigned-orders hook:

```tsx
  it('pre-fills a newly added stop from the order rather than the billing address', () => {
    // The unassigned-orders mock returns an order whose deliveryAddressKind is
    // the wire string 'DeliveryPlace' with clientDeliveryPlaceId 'p1'.
    // Adding it must select that place, not Fakturační.
    renderEditorWithOrder({
      id: 'o1',
      clientName: 'U Zlatého sklepa',
      deliveryAddressKind: 'DeliveryPlace',
      clientDeliveryPlaceId: 'p1',
      clientDeliveryPlaces: [{ id: 'p1', name: 'Letní zahrádka', address: { latitude: 50.7, longitude: 15.05 } }],
    });
    fireEvent.click(screen.getByText('U Zlatého sklepa'));
    expect(screen.getByRole('combobox')).toHaveTextContent('Letní zahrádka');
  });
```

Adapt the helper names to whatever that test file already provides.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && yarn test:run src/features/shipments/ShipmentEditor.test.tsx`
Expected: FAIL — the stop shows "Fakturační".

- [ ] **Step 3: Replace the hardcoded default**

At `ShipmentEditor.tsx:355`, in the callback that appends an order stop:

```tsx
      // Inherit the order's own choice. `addrKindValue` is mandatory here: the
      // API sends enum names as strings while the generated TS enum is
      // numeric, so the raw field never === a member.
      const order = orderById.get(orderId);
      return [...prev, {
        key: orderId,
        kind: 'order' as const,
        orderId,
        addressKind: addrKindValue(order?.deliveryAddressKind),
        deliveryPlaceId: order?.clientDeliveryPlaceId ?? undefined,
        order: prev.length + 1,
      }];
```

Leave `:366` (the custom-stop constructor) on `Official` — a custom stop has no order to inherit from.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && yarn test:run src/features/shipments/ShipmentEditor.test.tsx`
Expected: all pass.

- [ ] **Step 5: Verify and commit**

```bash
cd app && yarn test:run && yarn build && yarn lint
git add app
git commit -m "feat(shipments): inherit the order's delivery address on a new stop

Replaces the hardcoded Official default, which forced the planner to re-pick
a destination the order already recorded."
```

---

### Task 14: The address-changed banner

**Files:**
- Create: `app/src/features/shipments/AddressChangedBanner.tsx`
- Create: `app/src/features/shipments/AddressChangedBanner.test.tsx`
- Modify: `app/src/hooks/useShipments.ts`, `app/src/api/queryKeys.ts` (only if a new key is needed)
- Modify: `app/src/features/shipments/ShipmentDetail.tsx`, `app/src/features/shipments/ShipmentEditor.tsx`

**Interfaces:**
- Consumes: `OutgoingShipmentStopDto.addressChangedAt` / `.isAddressOverridden` / `.orderDeliveryAddress` (Task 8), the generated `acknowledgeAddressChangesEndpoint` (Task 9).
- Produces: `useAcknowledgeAddressChanges()` in `useShipments.ts`, and `<AddressChangedBanner shipmentId={string} stops={OutgoingShipmentStopDto[]} />`.

- [ ] **Step 1: Write the failing test**

Create `app/src/features/shipments/AddressChangedBanner.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddressChangedBanner } from './AddressChangedBanner';

const mutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('src/hooks/useShipments', () => ({
  useAcknowledgeAddressChanges: () => ({ mutateAsync, isPending: false }),
}));

const stamped = '2026-07-27T09:00:00Z';

describe('AddressChangedBanner', () => {
  it('renders nothing when no stop has a pending change', () => {
    const { container } = render(<AddressChangedBanner shipmentId="s1" stops={[{ id: 'st1', clientName: 'A' }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says the address was updated for an inherited stop', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      { id: 'st1', clientName: 'A', addressChangedAt: stamped, isAddressOverridden: false },
    ]} />);
    expect(screen.getByText(/aktualizována/i)).toBeInTheDocument();
  });

  it('says the order disagrees for an overridden stop', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      { id: 'st1', clientName: 'A', addressChangedAt: stamped, isAddressOverridden: true },
    ]} />);
    expect(screen.getByText(/jinou adresu/i)).toBeInTheDocument();
  });

  it('acknowledges on Rozumím', () => {
    render(<AddressChangedBanner shipmentId="s1" stops={[
      { id: 'st1', clientName: 'A', addressChangedAt: stamped, isAddressOverridden: false },
    ]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rozumím' }));
    expect(mutateAsync).toHaveBeenCalledWith('s1');
  });
});
```

Cast the stop literals to `OutgoingShipmentStopDto` as the neighbouring shipment tests do.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd app && yarn test:run src/features/shipments/AddressChangedBanner.test.tsx`
Expected: FAIL — cannot resolve `./AddressChangedBanner`.

- [ ] **Step 3: Add the mutation hook**

In `app/src/hooks/useShipments.ts`, following the file's existing mutation convention:

```ts
export function useAcknowledgeAddressChanges() {
  const ds = useDataSource();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shipmentId: string) => ds.acknowledgeAddressChangesEndpoint(shipmentId),
    onSuccess: (_res, shipmentId) => {
      qc.invalidateQueries({ queryKey: qk.shipments.all });
      qc.invalidateQueries({ queryKey: qk.shipments.detail(shipmentId) });
    },
  });
}
```

Check the generated method's real name and parameter list in `src/generated/api-client.ts` before writing this.

- [ ] **Step 4: Write the banner**

Create `app/src/features/shipments/AddressChangedBanner.tsx`:

```tsx
// Raised when an order edit changed a delivery address under this shipment.
// Two messages, because an inherited stop has already been corrected while an
// overridden one has deliberately *not* been — and the second is the case
// nobody would otherwise notice.

export function AddressChangedBanner({
  shipmentId,
  stops,
}: {
  shipmentId: string;
  stops: OutgoingShipmentStopDto[];
}) {
  const acknowledge = useAcknowledgeAddressChanges();
  const changed = stops.filter((s) => s.addressChangedAt);
  if (changed.length === 0) return null;

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button
          size="small"
          color="inherit"
          disabled={acknowledge.isPending}
          onClick={() => { void acknowledge.mutateAsync(shipmentId); }}
        >
          Rozumím
        </Button>
      }
    >
      <AlertTitle sx={{ fontWeight: 700 }}>Změna adresy doručení</AlertTitle>
      {changed.map((s) => (
        <Typography key={s.id} sx={{ fontSize: 13.5 }}>
          <Box component="span" sx={{ fontWeight: 700 }}>{s.clientName ?? '—'}</Box>
          {': '}
          {s.isAddressOverridden
            ? 'objednávka má jinou adresu doručení než tato zastávka.'
            : 'adresa doručení byla aktualizována podle objednávky.'}
        </Typography>
      ))}
    </Alert>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && yarn test:run src/features/shipments/AddressChangedBanner.test.tsx`
Expected: 4 passed.

- [ ] **Step 6: Mount it on both screens**

In `ShipmentDetail.tsx` and `ShipmentEditor.tsx`, render it above the stop list:

```tsx
      <AddressChangedBanner shipmentId={shipment.id ?? ''} stops={shipment.stops ?? []} />
```

In the editor, use the stops from the loaded shipment (the server read model), not the local draft — the draft has no `addressChangedAt`.

- [ ] **Step 7: Verify the whole thing**

```bash
cd app && yarn test:run && yarn build && yarn lint
cd ../api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: everything green.

- [ ] **Step 8: Commit**

```bash
git add app
git commit -m "feat(shipments): warn when an order changed its delivery address

A banner on the shipment editor and detail naming each affected stop, with a
distinct message for a stop that followed the order and one that overrode it.
Rozumím clears the notice without saving the shipment."
```

---

### Task 15: End-to-end verification

No new code. This is the gate before the branch is offered for merge.

- [ ] **Step 1: Full backend suite**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass. Record the count.

- [ ] **Step 2: Full frontend suite, typecheck and lint**

```bash
cd app && yarn test:run && yarn build && yarn lint
```

Expected: all green. Record the count.

- [ ] **Step 3: Exercise the feature against a running stack**

Start the backend on the **local** database and the dev server:

```bash
cd api/AleTrack && docker compose up -d
ASPNETCORE_ENVIRONMENT=Development.Local dotnet run --project AleTrack --launch-profile Local
cd app && yarn dev:local
```

The stock `Local` profile sets `ASPNETCORE_ENVIRONMENT=Development`, which points at the **remote Supabase** database — override it as above or you will be editing production-ish data.

Walk the path and confirm each step:

1. Create an order for a client with a saved place; choose that place. The preview line shows the place's address.
2. Open the order detail — the place name chip, its address and the driver note are there.
3. Plan the order into a shipment. The stop pre-selects the place, not Fakturační.
4. Edit the order, switch to Fakturační, save. Reopen the shipment: the stop now says Fakturační and the banner says the address was updated.
5. On the shipment, override that stop back to the place and save. Edit the order again to Kontaktní. Reopen the shipment: the stop still shows the place, and the banner says the order disagrees.
6. Click "Rozumím" — the banner goes and stays gone after a reload.

- [ ] **Step 4: Report honestly**

Write up what passed, and name anything you could not run (no local DB, no browser) rather than implying it passed.

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| `DeliveryAddressKind` rename | 1 |
| `orders` + `outgoing_shipment_stops` columns, migration, backfill | 2 |
| Shared resolver (soft-delete, cross-client) | 3 |
| Order write DTOs, pairing validation | 4 |
| Contact-requires-contact-address, persistence | 5 |
| Propagation, the four branches, `AddressChangedAt` | 6 |
| `OrderDto.DeliveryAddress`, soft-deleted place resolving | 7 |
| Shipment DTO additions, derived `IsAddressOverridden`, clear-on-update | 8 |
| Acknowledge endpoint | 9 |
| Codegen + shared `deliveryAddress.ts` | 10 |
| Order editor picker, inline place creation, client-change reset, dirty guard | 11 |
| Order detail display | 12 |
| Stop pre-fill replacing the `Official` default | 13 |
| Banner on editor and detail | 14 |

Every spec section maps to a task. The spec's "out of scope" list stays out.

**Known soft spots, flagged rather than hidden**

- Tasks 8, 11, 12, 13 and 14 tell the implementer to read the neighbouring fixture or generated method before writing, because those signatures (`EndpointBuilder`, `renderEditorWithOrder`, the generated acknowledge method) were not verified line-by-line while planning. Each such spot names exactly what to check.
- Task 12's coordinate-only fallback is stated as a branch the second test will force; the instruction is to fix the render, not loosen the test.
