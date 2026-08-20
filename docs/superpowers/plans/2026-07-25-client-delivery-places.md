# Client Delivery Places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an outgoing-shipment stop deliver to a named place saved on the client — a third option beside the client's fakturační and kontaktní addresses.

**Architecture:** A new soft-deletable `ClientDeliveryPlace` entity owns an inlined `Address` and hangs off `Client` like `ClientNote` does. `OutgoingShipmentStop` gains a nullable FK to it plus a third `OutgoingShipmentStopAddressKind` value; a validator enforces that the enum and the FK agree. The frontend gets a picker on the stop row, an inline create dialog sharing the custom-stop map picker, and a management panel on the client detail.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql, xUnit + FluentAssertions + Moq.EntityFrameworkCore. React 19, Vite 6, TypeScript, MUI 7, TanStack Query 5, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-25-client-delivery-places-design.md`
**Approved prototype:** `docs/prototype/aletrack-prototype.html` — `#/clients/cl-uzsklep`, `#/shipments/s-1/edit`, `#/shipments/s-1`

## Global Constraints

- **UI is Czech, code is English.** Every user-visible string in Czech; identifiers, comments and commit messages in English. Never render a raw enum — go through `src/lib/labels.ts`.
- **Never hand-edit `app/src/generated/api-client.ts`.** It is generated. A backend DTO change and its frontend consumption land in the **same commit** (Task 6 does the regeneration).
- **Backend tests need no database** — `AleTrackDbContext` is mocked via `AleTrackDbContextMockFactory`.
- **Never edit `appsettings.*.json`** — they hold real secrets in the working tree and this is a public repository.
- **Migrations are not auto-applied.** `ApplyMigrationsAsync()` is commented out in `Program.cs`; apply by hand with an explicit `--connection`.
- **Backend commands run from `api/AleTrack/`; frontend commands from `app/`.** Frontend package manager is **yarn**, never npm.
- Use `theme.vars.palette.*` (not `theme.palette.*`) inside `sx` callbacks — under `cssVariables` the latter freezes to the light value.
- Money is never formatted locally, and dates go through `src/lib/format.ts`. Neither applies to this feature, but do not introduce local formatters.

---

## File Structure

**Backend — create**

| Path | Responsibility |
|---|---|
| `AleTrack/Entities/ClientDeliveryPlace.cs` | The entity. |
| `AleTrack/Infrastructure/Persistence/Configurations/ClientDeliveryPlaceConfiguration.cs` | Owned-address mapping and per-property nullability overrides. |
| `AleTrack/Features/ClientDeliveryPlaces/ClientDeliveryPlaceDto.cs` | Read DTO, shared by the three read paths. |
| `AleTrack/Features/ClientDeliveryPlaces/Commands/SaveClientDeliveryPlaceDto.cs` | Write DTO + validator, shared by create and update. |
| `AleTrack/Features/ClientDeliveryPlaces/Queries/List/GetClientDeliveryPlacesEndpoint.cs` | `GET clients/{id:guid}/delivery-places` |
| `AleTrack/Features/ClientDeliveryPlaces/Commands/Create/CreateClientDeliveryPlaceEndpoint.cs` | `POST clients/{id}/delivery-places` |
| `AleTrack/Features/ClientDeliveryPlaces/Commands/Update/UpdateClientDeliveryPlaceEndpoint.cs` | `PUT clients/delivery-places/{Id:guid}` |
| `AleTrack/Features/ClientDeliveryPlaces/Commands/Delete/DeleteClientDeliveryPlaceEndpoint.cs` | `DELETE clients/delivery-places/{Id:guid}` (soft) |
| `AleTrack.Tests/Builders/ClientDeliveryPlaceBuilder.cs` | Test data factory. |
| `AleTrack.Tests/Features/ClientDeliveryPlaces/*.cs` | Endpoint tests. |

**Backend — modify**

| Path | Change |
|---|---|
| `AleTrack/Common/Enums/OutgoingShipmentStopAddressKind.cs` | Add `DeliveryPlace = 2`. |
| `AleTrack/Entities/Client.cs` | Add `DeliveryPlaces` collection. |
| `AleTrack/Entities/OutgoingShipmentStop.cs` | Add `ClientDeliveryPlaceId` + navigation. |
| `AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs` | Add the `DbSet`. |
| `AleTrack/Features/OutgoingShipments/Utils/ClientOrderShipmentDto.cs` | Add `ClientDeliveryPlaceId`. |
| `AleTrack/Features/OutgoingShipments/Utils/ClientOrderShipmentDtoValidator.cs` | Pairing rules. |
| `AleTrack/Features/OutgoingShipments/Commands/Create/CreateOutgoingShipmentEndpoint.cs` | Resolve + persist the FK. |
| `AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentEndpoint.cs` | Same, **plus fix the pre-existing bug** where `SelectedAddressKind` is not written for already-linked stops. |
| `AleTrack/Features/OutgoingShipments/Queries/Detail/OutgoingShipmentDetailDto.cs` | Add `DeliveryPlace` to the stop DTO. |
| `AleTrack/Features/OutgoingShipments/Queries/Detail/GetOutgoingShipmentDetailEndpoint.cs` | Project it. |
| `AleTrack/Features/Orders/Queries/OutgoingShipmentsList/OutgoingShipmentOrderDto.cs` | Add `ClientDeliveryPlaces`. |
| `AleTrack/Features/Orders/Queries/OutgoingShipmentsList/GetOrdersListForOutgoingShipmentsEndpoint.cs` | Project it. |
| `AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs` | Add the `clientDeliveryPlaces` parameter. |

**Frontend — create**

| Path | Responsibility |
|---|---|
| `app/src/features/shipments/stopAddress.ts` | Pure address/coordinate resolution for a stop. Unit-tested. |
| `app/src/features/shipments/stopAddress.test.ts` | Its tests. |
| `app/src/components/common/AddressMapPicker.tsx` | Shared search + map + point state, extracted from `CustomStopDialog`. |
| `app/src/components/common/DeliveryPlaceDialog.tsx` | Create/edit a place. |
| `app/src/features/clients/DeliveryPlacesPanel.tsx` | Management card on the client detail. |
| `app/src/hooks/useDeliveryPlaces.ts` | TanStack Query hooks. |

**Frontend — modify**

| Path | Change |
|---|---|
| `app/src/lib/geo.ts` | `searchAddresses` returns parsed address parts; add the parts→`AddressDto` mapper. |
| `app/src/lib/geo.test.ts` | Tests for the mapper (create if absent). |
| `app/src/components/common/CustomStopDialog.tsx` | Rebuild on `AddressMapPicker`. |
| `app/src/api/queryKeys.ts` | Key for the places list. |
| `app/src/features/shipments/ShipmentEditor.tsx` | Picker, draft field, payload. |
| `app/src/features/shipments/shipmentDraft.ts` | Serialize the new field for the dirty check. |
| `app/src/features/shipments/ShipmentDetail.tsx` | Place chip + address line. |
| `app/src/features/clients/ClientDetail.tsx` | Mount the panel. |
| `app/src/generated/api-client.ts` | Regenerated, never hand-edited. |

---

## Task 1: Entity, configuration, migration

**Files:**
- Create: `api/AleTrack/AleTrack/Entities/ClientDeliveryPlace.cs`
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientDeliveryPlaceConfiguration.cs`
- Modify: `api/AleTrack/AleTrack/Entities/Client.cs`
- Modify: `api/AleTrack/AleTrack/Entities/OutgoingShipmentStop.cs`
- Modify: `api/AleTrack/AleTrack/Common/Enums/OutgoingShipmentStopAddressKind.cs`
- Modify: `api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs`

**Interfaces:**
- Consumes: nothing.
- Produces: `ClientDeliveryPlace` with `long ClientId`, `Client Client`, `string Name`, `string? Note`, `Address Address`, plus `PublicId`/`IsDeleted` from `PublicSoftlyDeletableEntity`. `Client.DeliveryPlaces` is `ICollection<ClientDeliveryPlace>`. `OutgoingShipmentStop.ClientDeliveryPlaceId` is `long?` with navigation `ClientDeliveryPlace? ClientDeliveryPlace`. `OutgoingShipmentStopAddressKind.DeliveryPlace = 2`. `AleTrackDbContext.ClientDeliveryPlaces` is `DbSet<ClientDeliveryPlace>`.

- [ ] **Step 1: Create the entity**

`api/AleTrack/AleTrack/Entities/ClientDeliveryPlace.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// A named delivery location saved on a client — a third option next to the
/// client's official and contact addresses when planning an outgoing shipment
/// stop. Created either from an address search or by picking a point on the
/// map, so the postal parts are optional but the coordinates never are.
/// </summary>
[Table("client_delivery_places")]
public sealed class ClientDeliveryPlace : PublicSoftlyDeletableEntity
{
    /// <summary>
    /// ID of the owning <see cref="Client"/>
    /// </summary>
    [Column("client_id")]
    public long ClientId { get; set; }

    /// <summary>
    /// Name shown in the picker, e.g. "Letní zahrádka".
    /// </summary>
    [MaxLength(100)]
    [Required]
    [Column("name")]
    public string Name { get; set; } = null!;

    /// <summary>
    /// Instruction for the driver, e.g. "Vjezd zezadu, brána od 8:00".
    /// </summary>
    [MaxLength(200)]
    [Column("note")]
    public string? Note { get; set; }

    /// <summary>
    /// Location of the place. Street/city parts are optional — a place picked
    /// straight off the map has coordinates only.
    /// </summary>
    public Address Address { get; set; } = null!;

    /// <summary>
    /// The owning <see cref="Client"/>
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Cascade)]
    public Client Client { get; set; } = null!;
}
```

- [ ] **Step 2: Add the collection to `Client`**

In `api/AleTrack/AleTrack/Entities/Client.cs`, after the `Contacts` property:

```csharp
    /// <summary>
    /// Named delivery locations saved on this client
    /// </summary>
    public List<ClientDeliveryPlace> DeliveryPlaces { get; set; } = [];
```

- [ ] **Step 3: Add the enum value**

In `api/AleTrack/AleTrack/Common/Enums/OutgoingShipmentStopAddressKind.cs`, replace the body so the members are explicitly numbered (they were implicit before; pinning them prevents a future reorder from silently remapping stored rows):

```csharp
public enum OutgoingShipmentStopAddressKind
{
    /// <summary>
    /// Official address of the stop
    /// </summary>
    Official = 0,

    /// <summary>
    /// Contact address of the stop
    /// </summary>
    Contact = 1,

    /// <summary>
    /// A delivery place saved on the client
    /// </summary>
    DeliveryPlace = 2
}
```

- [ ] **Step 4: Add the FK to the stop**

In `api/AleTrack/AleTrack/Entities/OutgoingShipmentStop.cs`, after `SelectedAddressKind`:

```csharp
    /// <summary>
    /// The client's saved delivery place this stop delivers to. Set only when
    /// <see cref="SelectedAddressKind"/> is
    /// <see cref="OutgoingShipmentStopAddressKind.DeliveryPlace"/>.
    /// </summary>
    [Column("client_delivery_place_id")]
    public long? ClientDeliveryPlaceId { get; set; }
```

and, after the `ClientOrder` navigation:

```csharp
    /// <summary>
    /// Delivery place associated with this stop. Deliberately resolvable even
    /// when soft-deleted, so historical shipments keep rendering.
    /// </summary>
    [DeleteBehavior(DeleteBehavior.Restrict)]
    public ClientDeliveryPlace? ClientDeliveryPlace { get; set; }
```

Add `using Microsoft.EntityFrameworkCore;` to the file's usings if it is not already there.

- [ ] **Step 5: Create the configuration**

`api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientDeliveryPlaceConfiguration.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientDeliveryPlaceConfiguration : IEntityTypeConfiguration<ClientDeliveryPlace>
{
    public void Configure(EntityTypeBuilder<ClientDeliveryPlace> builder)
    {
        // Only one address on the row, so the columns keep Address's own names —
        // OwnsAddressWithPrefix exists for entities holding two of them.
        builder.OwnsOne(x => x.Address, a =>
        {
            a.WithOwner();

            // A place picked straight off the map has no postal parts. Fluent
            // config wins over the [Required] attributes on the shared Address
            // type, which stays untouched.
            a.Property(x => x.StreetName).IsRequired(false);
            a.Property(x => x.StreetNumber).IsRequired(false);
            a.Property(x => x.City).IsRequired(false);
            a.Property(x => x.Zip).IsRequired(false);

            // A place always comes from a map pick or a geocoded hit, so it is
            // always plottable — no fallback point is ever needed.
            a.Property(x => x.Latitude).IsRequired();
            a.Property(x => x.Longitude).IsRequired();

            // Country's enum starts at 1, so CLR default 0 is not a valid value.
            a.Property(x => x.Country)
                .HasDefaultValue(Country.Czechia)
                .HasSentinel(default(Country));
        });

        // NO global query filter here, unlike ClientNoteConfiguration. One would
        // silently null out the Include when the shipment detail loads a stop
        // pointing at a soft-deleted place — the address would vanish from
        // history with no error. Non-deleted filtering is explicit in the list
        // endpoint instead.
    }
}
```

- [ ] **Step 6: Register the DbSet**

In `api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs`, next to the `ClientNotes` set:

```csharp
    /// <summary>
    /// DbSet of <see cref="ClientDeliveryPlace"/>
    /// </summary>
    public virtual DbSet<ClientDeliveryPlace> ClientDeliveryPlaces => Set<ClientDeliveryPlace>();
```

- [ ] **Step 7: Build**

Run from `api/AleTrack/`:

```bash
dotnet build AleTrack.sln
```

Expected: `Build succeeded`, 0 errors.

- [ ] **Step 8: Generate the migration**

Run from `api/AleTrack/AleTrack/`:

```bash
dotnet ef migrations add AddClientDeliveryPlaces
```

Expected: a new pair of files under `Infrastructure/Persistence/Migrations/`.

- [ ] **Step 9: Read the migration and verify it**

Open the generated `*_AddClientDeliveryPlaces.cs` and confirm:
- `CreateTable("client_delivery_places")` with `client_id`, `name`, `note`, `street_name`, `street_number`, `city`, `zip`, `country`, `latitude`, `longitude`, `public_id`, `is_deleted`, `id`.
- `street_name`, `street_number`, `city`, `zip`, `note` are `nullable: true`.
- `latitude`, `longitude` are `nullable: false`.
- `AddColumn<long>("client_delivery_place_id", "outgoing_shipment_stops", nullable: true)` with a `ReferentialAction.Restrict` FK.
- The `clients` FK uses `ReferentialAction.Cascade`.

If any nullability is wrong, fix the configuration and regenerate (`dotnet ef migrations remove` first) rather than editing the migration by hand.

- [ ] **Step 10: Apply to the local database**

```bash
dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"
```

Expected: `Done.` If the local Postgres is not running, start it first with `docker compose up -d` from `api/AleTrack/`.

- [ ] **Step 11: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/ClientDeliveryPlace.cs \
        api/AleTrack/AleTrack/Entities/Client.cs \
        api/AleTrack/AleTrack/Entities/OutgoingShipmentStop.cs \
        api/AleTrack/AleTrack/Common/Enums/OutgoingShipmentStopAddressKind.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientDeliveryPlaceConfiguration.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/
git commit -m "feat(clients): add ClientDeliveryPlace entity and schema"
```

---

## Task 2: Delivery-place CRUD endpoints

**Files:**
- Create: `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/ClientDeliveryPlaceDto.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/SaveClientDeliveryPlaceDto.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Queries/List/GetClientDeliveryPlacesEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/Create/CreateClientDeliveryPlaceEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/Update/UpdateClientDeliveryPlaceEndpoint.cs`
- Create: `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/Delete/DeleteClientDeliveryPlaceEndpoint.cs`
- Create: `api/AleTrack/AleTrack.Tests/Builders/ClientDeliveryPlaceBuilder.cs`
- Create: `api/AleTrack/AleTrack.Tests/Features/ClientDeliveryPlaces/ClientDeliveryPlaceTests.cs`
- Modify: `api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs`

**Interfaces:**
- Consumes: `ClientDeliveryPlace`, `Client.DeliveryPlaces`, `AleTrackDbContext.ClientDeliveryPlaces` (Task 1).
- Produces: `ClientDeliveryPlaceDto { Guid Id; string Name; string? Note; AddressDto Address; }`. `SaveClientDeliveryPlaceDto { string Name; string? Note; AddressDto Address; Country? Country; }` — note `Address.Country` is ignored in favour of the top-level nullable `Country`, defaulted to `Czechia`. `ClientDeliveryPlaceBuilder.BuildEntity(...)` and `.BuildSaveDto(...)` for tests. `AleTrackDbContextMockFactory.CreateMock(clientDeliveryPlaces: [...])`.

- [ ] **Step 1: Create the read DTO**

`api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/ClientDeliveryPlaceDto.cs`:

```csharp
using AleTrack.Common.Models;

namespace AleTrack.Features.ClientDeliveryPlaces;

/// <summary>
/// A delivery place saved on a client.
/// </summary>
public sealed record ClientDeliveryPlaceDto
{
    /// <summary>
    /// Public ID of the place
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name shown in the picker
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Instruction for the driver
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Location. Street/city parts may be empty for a map-picked place;
    /// latitude and longitude are always present.
    /// </summary>
    public AddressDto Address { get; set; } = null!;
}
```

- [ ] **Step 2: Create the write DTO and its validator**

`api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/SaveClientDeliveryPlaceDto.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands;

/// <summary>
/// Body for creating or updating a client delivery place.
/// </summary>
public sealed record SaveClientDeliveryPlaceDto
{
    /// <summary>
    /// Name shown in the picker
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Instruction for the driver
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Postal parts of the place. All four text fields may be empty when the
    /// place was picked straight off the map.
    /// </summary>
    public AddressDto Address { get; set; } = null!;

    /// <summary>
    /// Latitude of the place. Always required — a place must be plottable.
    /// </summary>
    public decimal Latitude { get; set; }

    /// <summary>
    /// Longitude of the place
    /// </summary>
    public decimal Longitude { get; set; }

    /// <summary>
    /// Country of the place. Nullable because <see cref="Country"/> starts at 1,
    /// so an omitted field would otherwise arrive as the invalid value 0. The
    /// handler substitutes <see cref="Country.Czechia"/> when this is null.
    /// </summary>
    public Country? Country { get; set; }
}

/// <summary>
/// Validator for <see cref="SaveClientDeliveryPlaceDto"/>.
/// </summary>
public sealed class SaveClientDeliveryPlaceDtoValidator : Validator<SaveClientDeliveryPlaceDto>
{
    public SaveClientDeliveryPlaceDtoValidator()
    {
        RuleFor(dto => dto.Name)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.Name)
            .MaximumLength(100)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(dto => dto.Note)
            .MaximumLength(200)
            .WithErrorCode(ErrorCodes.ValidationMaxLengthError);

        RuleFor(dto => dto.Country!.Value)
            .IsInEnum()
            .WithErrorCode(ErrorCodes.ValidationEnumError)
            .When(dto => dto.Country.HasValue);
    }
}
```

- [ ] **Step 3: Create the list endpoint**

`api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Queries/List/GetClientDeliveryPlacesEndpoint.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Queries.List;

/// <summary>
/// Request for a client's delivery places.
/// </summary>
public record GetClientDeliveryPlacesRequest
{
    /// <summary>
    /// ID of the client.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint returning a client's delivery places.
/// </summary>
public sealed class GetClientDeliveryPlacesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetClientDeliveryPlacesRequest, List<ClientDeliveryPlaceDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients/{id:guid}/delivery-places");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.View)
            .WithName(nameof(GetClientDeliveryPlacesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets a client's delivery places";
            s.Responses[StatusCodes.Status200OK] = "List of delivery places";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientDeliveryPlacesRequest req, CancellationToken ct)
    {
        // Explicit !IsDeleted — the entity deliberately has no global query
        // filter so historical shipments can still resolve removed places.
        var places = await dbContext.ClientDeliveryPlaces
            .Where(p => p.Client.PublicId == req.Id && !p.IsDeleted && !p.Client.IsDeleted)
            .OrderBy(p => p.Name)
            .Select(p => new ClientDeliveryPlaceDto
            {
                Id = p.PublicId,
                Name = p.Name,
                Note = p.Note,
                Address = p.Address.ToDto()
            })
            .ToListAsync(ct);

        await Send.OkAsync(places, cancellation: ct);
    }
}
```

- [ ] **Step 4: Create the create endpoint**

`api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/Create/CreateClientDeliveryPlaceEndpoint.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands.Create;

/// <summary>
/// Request to create a delivery place on a client.
/// </summary>
public record CreateClientDeliveryPlaceRequest
{
    /// <summary>
    /// ID of the client to create the place for
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SaveClientDeliveryPlaceDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint creating a client delivery place.
/// </summary>
public sealed class CreateClientDeliveryPlaceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<CreateClientDeliveryPlaceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("clients/{id}/delivery-places");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(CreateClientDeliveryPlaceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Creates a client delivery place";
            s.Responses[StatusCodes.Status201Created] = "Delivery place created";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateClientDeliveryPlaceRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .Include(c => c.DeliveryPlaces)
            .FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);

        if (client is null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        var place = new ClientDeliveryPlace
        {
            Client = client!,
            Name = req.Data.Name,
            Note = req.Data.Note,
            Address = req.Data.ToAddress()
        };

        client!.DeliveryPlaces.Add(place);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(place.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}
```

- [ ] **Step 5: Add the DTO→entity mapper used above**

Append to `api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/SaveClientDeliveryPlaceDto.cs`:

```csharp
/// <summary>
/// Maps the write DTO onto the owned <see cref="Address"/>.
/// </summary>
public static class SaveClientDeliveryPlaceDtoExtensions
{
    /// <summary>
    /// Builds the owned address. Empty postal parts are stored as null rather
    /// than "", so "has no address" is one value and not two.
    /// </summary>
    public static Entities.Address ToAddress(this SaveClientDeliveryPlaceDto dto) => new()
    {
        StreetName = Blank(dto.Address.StreetName)!,
        StreetNumber = Blank(dto.Address.StreetNumber)!,
        City = Blank(dto.Address.City)!,
        Zip = Blank(dto.Address.Zip)!,
        Country = dto.Country ?? Common.Enums.Country.Czechia,
        Latitude = dto.Latitude,
        Longitude = dto.Longitude
    };

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
```

Add `using AleTrack.Entities;` to that file's usings.

- [ ] **Step 6: Create the update endpoint**

`api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/Update/UpdateClientDeliveryPlaceEndpoint.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands.Update;

/// <summary>
/// Request to update a client delivery place.
/// </summary>
public record UpdateClientDeliveryPlaceRequest
{
    /// <summary>
    /// ID of the place to update
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SaveClientDeliveryPlaceDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint updating a client delivery place.
/// </summary>
public sealed class UpdateClientDeliveryPlaceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<UpdateClientDeliveryPlaceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/delivery-places/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateClientDeliveryPlaceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Updates a client delivery place";
            s.Responses[StatusCodes.Status204NoContent] = "Delivery place updated";
            s.Responses[StatusCodes.Status404NotFound] = "Delivery place not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientDeliveryPlaceRequest req, CancellationToken ct)
    {
        var place = await dbContext.ClientDeliveryPlaces
            .FirstOrDefaultAsync(p => p.PublicId == req.Id && !p.IsDeleted, ct);

        if (place is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientDeliveryPlace), req.Id);

        place!.Name = req.Data.Name;
        place.Note = req.Data.Note;
        place.Address = req.Data.ToAddress();

        dbContext.ClientDeliveryPlaces.Update(place);
        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
```

Add `using AleTrack.Features.ClientDeliveryPlaces.Commands;` if the compiler asks for the `ToAddress` extension.

- [ ] **Step 7: Create the soft-delete endpoint**

`api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/Commands/Delete/DeleteClientDeliveryPlaceEndpoint.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientDeliveryPlaces.Commands.Delete;

/// <summary>
/// Request to delete a client delivery place.
/// </summary>
public record DeleteClientDeliveryPlaceRequest
{
    /// <summary>
    /// ID of the place to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint soft-deleting a client delivery place.
/// </summary>
public sealed class DeleteClientDeliveryPlaceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<DeleteClientDeliveryPlaceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("clients/delivery-places/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteClientDeliveryPlaceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Deletes a client delivery place";
            s.Responses[StatusCodes.Status202Accepted] = "Delivery place deleted";
            s.Responses[StatusCodes.Status404NotFound] = "Delivery place not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteClientDeliveryPlaceRequest req, CancellationToken ct)
    {
        var place = await dbContext.ClientDeliveryPlaces
            .FirstOrDefaultAsync(p => p.PublicId == req.Id && !p.IsDeleted, ct);

        if (place is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientDeliveryPlace), req.Id);

        // Soft delete: the place leaves every picker but keeps resolving on the
        // shipments that already reference it.
        place!.IsDeleted = true;

        dbContext.ClientDeliveryPlaces.Update(place);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted, cancellation: ct);
    }
}
```

- [ ] **Step 8: Extend the DbContext mock factory**

In `api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs`:

1. Add to the `CreateMock` parameter list, after `clientNotes`:
   `ICollection<ClientDeliveryPlace>? clientDeliveryPlaces = null,`
2. Add the matching `<param>` doc comment.
3. Pass `clientDeliveryPlaces ?? [],` in the `SetupDbContextMock(...)` call, in the same position.
4. Add the matching parameter to the private `SetupDbContextMock` signature.
5. Add the setup line next to the `ClientNotes` one:

```csharp
        dbContextMock.Setup<DbSet<ClientDeliveryPlace>>(x => x.ClientDeliveryPlaces).ReturnsDbSet(clientDeliveryPlaces);
```

- [ ] **Step 9: Create the test builder**

`api/AleTrack/AleTrack.Tests/Builders/ClientDeliveryPlaceBuilder.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces.Commands;

namespace AleTrack.Tests.Builders;

public static class ClientDeliveryPlaceBuilder
{
    public static ClientDeliveryPlace BuildEntity(
        Guid? publicId = null,
        Client? client = null,
        string? name = null,
        string? note = null,
        Address? address = null,
        bool isDeleted = false)
    {
        var place = new ClientDeliveryPlace
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Letní zahrádka",
            Note = note,
            Address = address ?? AddressBuilder.BuildEntity(),
            IsDeleted = isDeleted
        };

        if (client is not null)
        {
            place.Client = client;
            client.DeliveryPlaces.Add(place);
        }

        return place;
    }

    public static SaveClientDeliveryPlaceDto BuildSaveDto(
        string? name = null,
        string? note = null,
        AddressDto? address = null,
        decimal latitude = 50.897m,
        decimal longitude = 14.807m,
        Country? country = Country.Czechia)
    {
        return new SaveClientDeliveryPlaceDto
        {
            Name = name ?? "Letní zahrádka",
            Note = note,
            Address = address ?? AddressBuilder.BuildDto(),
            Latitude = latitude,
            Longitude = longitude,
            Country = country
        };
    }
}
```

- [ ] **Step 10: Write the failing tests**

`api/AleTrack/AleTrack.Tests/Features/ClientDeliveryPlaces/ClientDeliveryPlaceTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces.Commands.Create;
using AleTrack.Features.ClientDeliveryPlaces.Commands.Delete;
using AleTrack.Features.ClientDeliveryPlaces.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.ClientDeliveryPlaces;

public sealed class ClientDeliveryPlaceTests
{
    [Fact]
    public async Task ProcessAsync_CreatePlace_Success()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new CreateClientDeliveryPlaceRequest
        {
            Id = clientId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto(name: "Letní zahrádka", note: "Vjezd zezadu")
        };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        client.DeliveryPlaces.Should().HaveCount(1);
        client.DeliveryPlaces[0].Name.Should().Be("Letní zahrádka");
        client.DeliveryPlaces[0].Note.Should().Be("Vjezd zezadu");
        client.DeliveryPlaces[0].Address.Latitude.Should().Be(50.897m);
    }

    [Fact]
    public async Task ProcessAsync_CreatePlace_BlankPostalPartsStoredAsNull()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var dto = ClientDeliveryPlaceBuilder.BuildSaveDto();
        dto.Address.StreetName = "";
        dto.Address.StreetNumber = "  ";
        dto.Address.City = "";
        dto.Address.Zip = "";

        var command = new CreateClientDeliveryPlaceRequest { Id = clientId, Data = dto };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        var saved = client.DeliveryPlaces[0].Address;
        saved.StreetName.Should().BeNull();
        saved.StreetNumber.Should().BeNull();
        saved.City.Should().BeNull();
        saved.Zip.Should().BeNull();
        saved.Latitude.Should().Be(50.897m);
    }

    [Fact]
    public async Task ProcessAsync_CreatePlace_NullCountryDefaultsToCzechia()
    {
        var clientId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity(publicId: clientId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new CreateClientDeliveryPlaceRequest
        {
            Id = clientId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto(country: null)
        };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        client.DeliveryPlaces[0].Address.Country.Should().Be(Country.Czechia);
    }

    [Fact]
    public async Task ProcessAsync_CreatePlace_ClientNotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateClientDeliveryPlaceRequest
        {
            Id = Guid.NewGuid(),
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto()
        };

        var endpoint = EndpointBuilder<CreateClientDeliveryPlaceRequest, CreateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ProcessAsync_UpdatePlace_Success()
    {
        var placeId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client, name: "Původní");
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], clientDeliveryPlaces: [place]);

        var command = new UpdateClientDeliveryPlaceRequest
        {
            Id = placeId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto(name: "Nový název", latitude: 51.1m, longitude: 15.2m)
        };

        var endpoint = EndpointBuilder<UpdateClientDeliveryPlaceRequest, UpdateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        place.Name.Should().Be("Nový název");
        place.Address.Latitude.Should().Be(51.1m);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_UpdatePlace_SoftDeletedNotFound()
    {
        var placeId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client, isDeleted: true);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], clientDeliveryPlaces: [place]);

        var command = new UpdateClientDeliveryPlaceRequest
        {
            Id = placeId,
            Data = ClientDeliveryPlaceBuilder.BuildSaveDto()
        };

        var endpoint = EndpointBuilder<UpdateClientDeliveryPlaceRequest, UpdateClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);

        var act = () => endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }

    [Fact]
    public async Task ProcessAsync_DeletePlace_SoftDeletesInsteadOfRemoving()
    {
        var placeId = Guid.NewGuid();
        var client = ClientBuilder.BuildEntity();
        var place = ClientDeliveryPlaceBuilder.BuildEntity(publicId: placeId, client: client);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], clientDeliveryPlaces: [place]);

        var command = new DeleteClientDeliveryPlaceRequest { Id = placeId };

        var endpoint = EndpointBuilder<DeleteClientDeliveryPlaceRequest, DeleteClientDeliveryPlaceEndpoint>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        place.IsDeleted.Should().BeTrue();
        dbContext.Verify(e => e.ClientDeliveryPlaces.Remove(It.IsAny<ClientDeliveryPlace>()), Times.Never);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

- [ ] **Step 11: Run the tests to verify they fail**

Run from `api/AleTrack/`:

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ClientDeliveryPlaceTests"
```

Expected: compilation succeeds and the tests run. If any fail, the endpoints above need fixing — the tests are the specification.

- [ ] **Step 12: Run the full backend suite**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all tests pass (157 before this task, +7 here).

- [ ] **Step 13: Commit**

```bash
git add api/AleTrack/AleTrack/Features/ClientDeliveryPlaces/ \
        api/AleTrack/AleTrack.Tests/Builders/ClientDeliveryPlaceBuilder.cs \
        api/AleTrack/AleTrack.Tests/Features/ClientDeliveryPlaces/ \
        api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs
git commit -m "feat(clients): CRUD endpoints for client delivery places"
```

---

## Task 3: Wire the place into shipment stops

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ClientOrderShipmentDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ClientOrderShipmentDtoValidator.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Create/CreateOutgoingShipmentEndpoint.cs`
- Create: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentStopDeliveryPlaceTests.cs`

**Interfaces:**
- Consumes: `OutgoingShipmentStopAddressKind.DeliveryPlace`, `OutgoingShipmentStop.ClientDeliveryPlaceId`, `AleTrackDbContext.ClientDeliveryPlaces` (Task 1).
- Produces: `ClientOrderShipmentDto.ClientDeliveryPlaceId` (`Guid?`). Both shipment write endpoints resolve that public ID to `OutgoingShipmentStop.ClientDeliveryPlaceId` and keep `SelectedAddressKind` in sync on existing stops.

**Note for the implementer:** this task fixes a pre-existing bug. In `UpdateOutgoingShipmentEndpoint.GetOrderStopsAsync`, `SelectedAddressKind` is assigned only when a stop is newly created; the loop that updates already-linked stops sets `Order` and nothing else. Switching Fakturační → Kontaktní on an existing stop therefore never persists today. Without fixing it, picking a delivery place on an existing stop would silently do nothing.

- [ ] **Step 1: Add the field to the write DTO**

In `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ClientOrderShipmentDto.cs`, after `SelectedAddressKind`:

```csharp
    /// <summary>
    /// The client's saved delivery place this stop delivers to. Required when
    /// <see cref="SelectedAddressKind"/> is
    /// <see cref="OutgoingShipmentStopAddressKind.DeliveryPlace"/>, and must be
    /// null otherwise.
    /// </summary>
    public Guid? ClientDeliveryPlaceId { get; set; }
```

- [ ] **Step 2: Add the pairing rules to the validator**

In `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ClientOrderShipmentDtoValidator.cs`, inside the constructor after the existing `SelectedAddressKind` rules:

```csharp
        // The enum and the FK can disagree; the schema cannot express the
        // pairing, so it is enforced here.
        RuleFor(dto => dto.ClientDeliveryPlaceId)
            .NotNull()
            .WithErrorCode(ErrorCodes.ValidationNotNullError)
            .When(dto => dto.SelectedAddressKind == OutgoingShipmentStopAddressKind.DeliveryPlace);

        RuleFor(dto => dto.ClientDeliveryPlaceId)
            .Null()
            .WithErrorCode(ErrorCodes.ValidationError)
            .When(dto => dto.SelectedAddressKind != OutgoingShipmentStopAddressKind.DeliveryPlace);
```

Add `using AleTrack.Common.Enums;` to the file's usings.

- [ ] **Step 3: Add a shared resolver to the update endpoint**

Add this private method to `UpdateOutgoingShipmentEndpoint` (and the identical one to `CreateOutgoingShipmentEndpoint` in step 5 — the two endpoints do not currently share a helper class, and introducing one is out of scope here):

```csharp
    /// <summary>
    /// Resolves the requested delivery places to their entity IDs, rejecting
    /// places that do not exist, are soft-deleted, or belong to a different
    /// client than the stop's order. Cross-client references are the one way
    /// this schema can go wrong, so the check is a DB lookup rather than a
    /// validator rule.
    /// </summary>
    private async Task<Dictionary<Guid, long>> ResolveDeliveryPlacesAsync(
        List<ClientOrderShipmentDto> clientOrderShipments,
        CancellationToken ct)
    {
        var requestedIds = clientOrderShipments
            .Where(cos => cos.ClientDeliveryPlaceId.HasValue)
            .Select(cos => cos.ClientDeliveryPlaceId!.Value)
            .Distinct()
            .ToList();

        if (requestedIds.Count == 0)
            return [];

        var places = await dbContext.ClientDeliveryPlaces
            .Where(p => requestedIds.Contains(p.PublicId) && !p.IsDeleted)
            .Select(p => new { p.PublicId, p.Id, ClientPublicId = p.Client.PublicId })
            .ToListAsync(ct);

        var missing = requestedIds.Where(id => places.All(p => p.PublicId != id)).ToList();
        if (missing.Count > 0)
            ThrowHelper.PublicEntitiesNotFound(nameof(ClientDeliveryPlace), missing);

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
    }
```

- [ ] **Step 4: Use it in `GetOrderStopsAsync` and fix the persistence gap**

In `UpdateOutgoingShipmentEndpoint`, change the signature and body of `GetOrderStopsAsync`. Replace the new-stop projection and the existing-stop update loop with:

```csharp
        var placeIds = await ResolveDeliveryPlacesAsync(clientOrderShipments, ct);

        // ... unchanged code building `stops` ...

            stops.AddRange(fetchedOrders
                .Select(o => new
                {
                    order = o,
                    requestOrder = clientOrderShipments.First(cos => cos.ClientOrderId == o.PublicId)
                })
                .Select(o => new OutgoingShipmentStop
                {
                    Kind = OutgoingShipmentStopKind.Order,
                    ClientOrder = o.order,
                    Order = o.requestOrder.Order,
                    SelectedAddressKind = o.requestOrder.SelectedAddressKind,
                    ClientDeliveryPlaceId = o.requestOrder.ClientDeliveryPlaceId.HasValue
                        ? placeIds[o.requestOrder.ClientDeliveryPlaceId.Value]
                        : null
                }));
        }

        // Remove orders present on the entity but not in the update request
        stops = [.. stops.Where(s => clientOrderShipments
            .Select(cos => cos.ClientOrderId)
            .Contains(s.ClientOrder!.PublicId))];

        // Update already-linked stops. Before this feature only Order was
        // written here, so changing a stop's address kind never persisted.
        foreach (var stop in stops.Where(s => existingOrderIds.Contains(s.ClientOrder!.PublicId)))
        {
            var matchingDto = clientOrderShipments.First(cos => cos.ClientOrderId == stop.ClientOrder!.PublicId);
            stop.Order = matchingDto.Order;
            stop.SelectedAddressKind = matchingDto.SelectedAddressKind;
            stop.ClientDeliveryPlaceId = matchingDto.ClientDeliveryPlaceId.HasValue
                ? placeIds[matchingDto.ClientDeliveryPlaceId.Value]
                : null;
        }

        return stops;
```

- [ ] **Step 5: Do the same in the create endpoint**

Open `CreateOutgoingShipmentEndpoint.cs`, find where it builds `OutgoingShipmentStop` with `SelectedAddressKind = ...`, add the same `ResolveDeliveryPlacesAsync` private method to that class, call it once before building the stops, and set:

```csharp
                    ClientDeliveryPlaceId = requestOrder.ClientDeliveryPlaceId.HasValue
                        ? placeIds[requestOrder.ClientDeliveryPlaceId.Value]
                        : null
```

Match the surrounding variable names in that file rather than copying them verbatim from the update endpoint.

- [ ] **Step 6: Write the failing tests**

`api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentStopDeliveryPlaceTests.cs`:

```csharp
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class ShipmentStopDeliveryPlaceTests
{
    private static ClientOrderShipmentDto Dto(OutgoingShipmentStopAddressKind kind, Guid? placeId) => new()
    {
        ClientOrderId = Guid.NewGuid(),
        Order = 1,
        SelectedAddressKind = kind,
        ClientDeliveryPlaceId = placeId
    };

    [Fact]
    public async Task Validator_DeliveryPlaceKindWithoutId_Fails()
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(
            Dto(OutgoingShipmentStopAddressKind.DeliveryPlace, null));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(ClientOrderShipmentDto.ClientDeliveryPlaceId)
            && e.ErrorCode == ErrorCodes.ValidationNotNullError);
    }

    [Fact]
    public async Task Validator_DeliveryPlaceKindWithId_Passes()
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(
            Dto(OutgoingShipmentStopAddressKind.DeliveryPlace, Guid.NewGuid()));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(OutgoingShipmentStopAddressKind.Official)]
    [InlineData(OutgoingShipmentStopAddressKind.Contact)]
    public async Task Validator_StandardKindWithPlaceId_Fails(OutgoingShipmentStopAddressKind kind)
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(Dto(kind, Guid.NewGuid()));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(ClientOrderShipmentDto.ClientDeliveryPlaceId));
    }

    [Theory]
    [InlineData(OutgoingShipmentStopAddressKind.Official)]
    [InlineData(OutgoingShipmentStopAddressKind.Contact)]
    public async Task Validator_StandardKindWithoutPlaceId_Passes(OutgoingShipmentStopAddressKind kind)
    {
        var validator = new ClientOrderShipmentDtoValidator();

        var result = await validator.ValidateAsync(Dto(kind, null));

        result.IsValid.Should().BeTrue();
    }
}
```

- [ ] **Step 7: Add the regression test for the persistence bug**

Append to the same file. Model it on the existing update-shipment tests in `AleTrack.Tests/Features/OutgoingShipments/` — open one first to copy the exact builder calls for a shipment that already has an order stop.

```csharp
    // Regression: before this feature the update endpoint wrote
    // SelectedAddressKind only for newly added stops, so changing it on an
    // already-linked stop silently did nothing.
    [Fact]
    public async Task ProcessAsync_UpdateShipment_ChangesAddressKindOnExistingStop()
    {
        // Arrange a shipment that already has one order stop with
        // SelectedAddressKind = Official, using OutgoingShipmentBuilder and
        // OrderBuilder exactly as the neighbouring update tests do.
        // Send an update whose ClientOrderShipmentDto for that same order has
        // SelectedAddressKind = Contact.
        // Assert the stop's SelectedAddressKind is Contact after HandleAsync.
    }
```

Replace the comment block with real arrange/act/assert code following the neighbouring tests' style. Do not leave the comment in the committed file.

- [ ] **Step 8: Run the tests**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentStopDeliveryPlace"
```

Expected: all pass. Step 7's test must fail before the step-4 fix and pass after — verify by temporarily reverting the `stop.SelectedAddressKind = ...` line.

- [ ] **Step 9: Run the full backend suite**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/ \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentStopDeliveryPlaceTests.cs
git commit -m "feat(shipments): deliver a stop to a client delivery place

Also fixes a pre-existing bug where SelectedAddressKind was written only
for newly added stops, so changing it on an existing stop never persisted."
```

---

## Task 4: Read projections

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Detail/OutgoingShipmentDetailDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Detail/GetOutgoingShipmentDetailEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/OutgoingShipmentsList/OutgoingShipmentOrderDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Orders/Queries/OutgoingShipmentsList/GetOrdersListForOutgoingShipmentsEndpoint.cs`
- Modify: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentStopDeliveryPlaceTests.cs`

**Interfaces:**
- Consumes: `ClientDeliveryPlaceDto` (Task 2), `OutgoingShipmentStop.ClientDeliveryPlace` (Task 1).
- Produces: `OutgoingShipmentStopDto.DeliveryPlace` (`ClientDeliveryPlaceDto?`) and `OutgoingShipmentOrderDto.ClientDeliveryPlaces` (`List<ClientDeliveryPlaceDto>`). These are the two shapes the frontend reads.

- [ ] **Step 1: Add the field to the stop DTO**

In `OutgoingShipmentDetailDto.cs`, in `OutgoingShipmentStopDto`, after `SelectedAddressKind`:

```csharp
    /// <summary>
    /// The delivery place this stop delivers to, when
    /// <see cref="SelectedAddressKind"/> is DeliveryPlace. Deliberately still
    /// populated for soft-deleted places so historical shipments render.
    /// </summary>
    public ClientDeliveryPlaceDto? DeliveryPlace { get; set; }
```

Add `using AleTrack.Features.ClientDeliveryPlaces;`.

- [ ] **Step 2: Project it**

In `GetOutgoingShipmentDetailEndpoint.HandleAsync`, inside the stop projection after `SelectedAddressKind = s.SelectedAddressKind,`:

```csharp
                        // No !IsDeleted condition — a removed place must still
                        // render on the shipments that already used it.
                        DeliveryPlace = s.ClientDeliveryPlace != null
                            ? new ClientDeliveryPlaceDto
                            {
                                Id = s.ClientDeliveryPlace.PublicId,
                                Name = s.ClientDeliveryPlace.Name,
                                Note = s.ClientDeliveryPlace.Note,
                                Address = s.ClientDeliveryPlace.Address.ToDto()
                            }
                            : null,
```

- [ ] **Step 3: Add the list to the order DTO**

In `OutgoingShipmentOrderDto.cs`, after `ClientContactAddress`:

```csharp
    /// <summary>
    /// The client's saved delivery places, offered as extra destinations for
    /// this order's stop. Soft-deleted places are excluded.
    /// </summary>
    public List<ClientDeliveryPlaceDto> ClientDeliveryPlaces { get; set; } = [];
```

Add `using AleTrack.Features.ClientDeliveryPlaces;`.

- [ ] **Step 4: Project it**

In `GetOrdersListForOutgoingShipmentsEndpoint.HandleAsync`, after `ClientContactAddress = ...,`:

```csharp
                ClientDeliveryPlaces = o.Client.DeliveryPlaces
                    .Where(p => !p.IsDeleted)
                    .OrderBy(p => p.Name)
                    .Select(p => new ClientDeliveryPlaceDto
                    {
                        Id = p.PublicId,
                        Name = p.Name,
                        Note = p.Note,
                        Address = p.Address.ToDto()
                    })
                    .ToList(),
```

- [ ] **Step 5: Add the projection tests**

Append to `ShipmentStopDeliveryPlaceTests.cs`, following the arrange style of the existing shipment-detail tests in the same folder:

```csharp
    [Fact]
    public async Task ProcessAsync_ShipmentDetail_ResolvesSoftDeletedPlace()
    {
        // Arrange a shipment whose stop points at a ClientDeliveryPlace with
        // IsDeleted = true, using OutgoingShipmentBuilder as the neighbouring
        // detail tests do.
        // Assert the returned stop's DeliveryPlace is not null and carries the
        // place's name — this is the guard against re-adding a global query
        // filter to ClientDeliveryPlace.
    }

    [Fact]
    public async Task ProcessAsync_OrdersForShipments_ExcludesSoftDeletedPlaces()
    {
        // Arrange a client with two places, one soft-deleted.
        // Assert the returned OutgoingShipmentOrderDto.ClientDeliveryPlaces has
        // exactly one entry, the non-deleted one.
    }
```

Replace both comment blocks with real code. Do not commit the comments.

- [ ] **Step 6: Run the tests**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack/AleTrack/Features/ api/AleTrack/AleTrack.Tests/Features/
git commit -m "feat(shipments): project delivery places into the read models"
```

---

## Task 5: Address-search parts and the shared map picker

**Files:**
- Modify: `app/src/lib/geo.ts`
- Create: `app/src/lib/geo.test.ts`
- Create: `app/src/components/common/AddressMapPicker.tsx`
- Modify: `app/src/components/common/CustomStopDialog.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure frontend).
- Produces: `AddressHit` gains `parts?: AddressParts`. `AddressParts { streetName?: string; streetNumber?: string; city?: string; zip?: string; country?: Country }`. `partsFromNominatim(raw): AddressParts` is exported and pure. `AddressMapPicker` props: `{ point: LatLng | null; onPick: (p: LatLng, hit?: AddressHit) => void; height?: number }`.

- [ ] **Step 1: Write the failing test for the parts mapper**

`app/src/lib/geo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { partsFromNominatim } from 'src/lib/geo';
import { Country } from 'src/generated/api-client';

describe('partsFromNominatim', () => {
  it('maps a Czech address', () => {
    expect(partsFromNominatim({
      road: 'Masarykova', house_number: '1347', city: 'Liberec', postcode: '460 01', country_code: 'cz',
    })).toEqual({
      streetName: 'Masarykova', streetNumber: '1347', city: 'Liberec', zip: '460 01', country: Country.Czechia,
    });
  });

  it('falls back through town and village for the city', () => {
    expect(partsFromNominatim({ town: 'Frýdlant' }).city).toBe('Frýdlant');
    expect(partsFromNominatim({ village: 'Vísky' }).city).toBe('Vísky');
  });

  it('maps a German address', () => {
    expect(partsFromNominatim({ country_code: 'de' }).country).toBe(Country.Germany);
  });

  it('defaults an unknown country to Czechia — the business only ships CZ and DE', () => {
    expect(partsFromNominatim({ country_code: 'pl' }).country).toBe(Country.Czechia);
    expect(partsFromNominatim({}).country).toBe(Country.Czechia);
  });

  it('omits parts Nominatim did not return rather than emitting empty strings', () => {
    expect(partsFromNominatim({ road: 'Vísky' })).toEqual({ streetName: 'Vísky', country: Country.Czechia });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd app && yarn test:run src/lib/geo.test.ts
```

Expected: FAIL — `partsFromNominatim` is not exported from `src/lib/geo`.

- [ ] **Step 3: Implement the mapper and extend the search**

In `app/src/lib/geo.ts`, add after the `AddressHit` interface:

```ts
/** Postal parts of a geocoding hit, as far as Nominatim could resolve them.
 * Fields Nominatim did not return are omitted, not blanked — a place with no
 * street is a real case (a yard gate, a field entrance). */
export interface AddressParts {
  streetName?: string;
  streetNumber?: string;
  city?: string;
  zip?: string;
  country?: Country;
}

/** Nominatim's `address` object, as much of it as we consume. */
interface NominatimAddress {
  road?: string;
  house_number?: string;
  city?: string;
  town?: string;
  village?: string;
  postcode?: string;
  country_code?: string;
}

/** Nominatim's parts are uneven for rural CZ addresses, so callers show the
 * result editable rather than trusting it. Anything outside CZ/DE falls back to
 * Czechia — the business ships to those two countries only. */
export function partsFromNominatim(raw: NominatimAddress): AddressParts {
  const parts: AddressParts = {};
  if (raw.road) parts.streetName = raw.road;
  if (raw.house_number) parts.streetNumber = raw.house_number;
  const city = raw.city ?? raw.town ?? raw.village;
  if (city) parts.city = city;
  if (raw.postcode) parts.zip = raw.postcode;
  parts.country = raw.country_code === 'de' ? Country.Germany : Country.Czechia;
  return parts;
}
```

Add `import { Country } from 'src/generated/api-client';` at the top of the file.

Then extend `AddressHit` with `parts?: AddressParts;`, add `addressdetails: '1'` to the `searchAddresses` params, widen its response type to include `address?: NominatimAddress`, and set `parts: hit.address ? partsFromNominatim(hit.address) : undefined` when pushing each hit. Existing callers ignore the new field.

- [ ] **Step 4: Run the test to verify it passes**

```bash
yarn test:run src/lib/geo.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Extract `AddressMapPicker`**

Create `app/src/components/common/AddressMapPicker.tsx` holding everything `CustomStopDialog` currently owns except the label/note fields and the dialog chrome: the `MIN_QUERY`/`DEBOUNCE_MS` constants, `pinIcon`, `ClickCapture`, `Recenter`, the debounce/abort refs, the `Autocomplete`, and the `MapContainer`. Its props:

```tsx
export function AddressMapPicker({
  point,
  onPick,
  height = 280,
}: {
  point: LatLng | null;
  /** Fires for both a search selection (with the hit) and a bare map click. */
  onPick: (p: LatLng, hit?: AddressHit) => void;
  height?: number;
}) {
```

The component owns the query/options/searching state internally; the selected point is controlled by the parent so both dialogs can validate on it.

- [ ] **Step 6: Rebuild `CustomStopDialog` on it**

Reduce `CustomStopDialog` to: dialog chrome, `point` state, the label and note `TextField`s, the coordinate readout, the `confirm` handler, and `<AddressMapPicker point={point} onPick={(p) => setPoint(p)} />`. Its exported prop signature and `onAdd` payload must not change — Dovozy and the shipment editor both call it.

- [ ] **Step 7: Verify nothing regressed**

```bash
yarn test:run && yarn build
```

Expected: all existing tests pass; build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/geo.ts app/src/lib/geo.test.ts \
        app/src/components/common/AddressMapPicker.tsx \
        app/src/components/common/CustomStopDialog.tsx
git commit -m "refactor(app): extract AddressMapPicker, return address parts from search"
```

---

## Task 6: API client regeneration and data hooks

**Files:**
- Modify: `app/src/generated/api-client.ts` (regenerated)
- Modify: `app/src/api/queryKeys.ts`
- Create: `app/src/hooks/useDeliveryPlaces.ts`

**Interfaces:**
- Consumes: the endpoints from Tasks 2 and 4.
- Produces: `useClientDeliveryPlaces(clientId)`, `useCreateDeliveryPlace()`, `useUpdateDeliveryPlace()`, `useDeleteDeliveryPlace()`. Generated types `ClientDeliveryPlaceDto` and `SaveClientDeliveryPlaceDto`.

- [ ] **Step 1: Start the backend**

From `api/AleTrack/`:

```bash
dotnet run --project AleTrack --launch-profile Local
```

Expected: listening on `http://localhost:8080`. Leave it running.

- [ ] **Step 2: Regenerate the client**

From `app/`, in a second shell:

```bash
yarn generate-api
```

Expected: `src/generated/api-client.ts` changes. Confirm it now contains `ClientDeliveryPlaceDto`, `SaveClientDeliveryPlaceDto`, `clientDeliveryPlaces` on the order DTO, `deliveryPlace` on the stop DTO, and `DeliveryPlace = 2` on the address-kind enum.

- [ ] **Step 3: Add the query key**

In `app/src/api/queryKeys.ts`, alongside the other nested-resource keys:

```ts
  clientDeliveryPlaces: (clientId: string) => ['clients', clientId, 'delivery-places'] as const,
```

Match the surrounding style — if the file namespaces keys under a `qk` object, add it there.

- [ ] **Step 4: Write the hooks**

`app/src/hooks/useDeliveryPlaces.ts`, following the shape of an existing hook module such as `src/hooks/useShipments.ts`:

- `useClientDeliveryPlaces(clientId: string | undefined)` — `useQuery`, `enabled: !!clientId`, key from `qk`.
- `useCreateDeliveryPlace()`, `useUpdateDeliveryPlace()`, `useDeleteDeliveryPlace()` — `useMutation`, each invalidating `qk.clientDeliveryPlaces(clientId)` **and** the unassigned-orders key the shipment editor reads, because a new place must appear in the stop picker without a reload.

Use `useDataSource()` for the client and `apiErrorMessage` for failures, as the other hook modules do.

- [ ] **Step 5: Typecheck**

```bash
yarn build
```

Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/src/generated/api-client.ts app/src/api/queryKeys.ts app/src/hooks/useDeliveryPlaces.ts
git commit -m "feat(app): regenerate API client, add delivery-place hooks"
```

---

## Task 7: `DeliveryPlaceDialog` and the client-detail panel

**Files:**
- Create: `app/src/components/common/DeliveryPlaceDialog.tsx`
- Create: `app/src/features/clients/DeliveryPlacesPanel.tsx`
- Modify: `app/src/features/clients/ClientDetail.tsx`

**Interfaces:**
- Consumes: `AddressMapPicker` (Task 5), the hooks (Task 6).
- Produces: `DeliveryPlaceDialog` props `{ open: boolean; clientId: string; place?: ClientDeliveryPlaceDto; onClose: () => void; onSaved?: (placeId: string) => void }`. `formatPlaceAddress(place): string` exported from `DeliveryPlacesPanel.tsx` — Task 8 and Task 9 both reuse it.

- [ ] **Step 1: Build the dialog**

`app/src/components/common/DeliveryPlaceDialog.tsx`. Layout matching the approved prototype:

1. Helper line: `Místo se uloží ke klientovi a půjde vybrat u kterékoli jeho zastávky.`
2. `<AddressMapPicker point={point} onPick={handlePick} />` — `handlePick` sets the point and, when a `hit.parts` is present, prefills the address fields.
3. Coordinate readout when a point is set, with a `Zrušit bod` button.
4. `Název místa` (required), `Poznámka pro řidiče`.
5. Section label: `Adresa — nepovinná, místo bez adresy stačí určit bodem v mapě`, then `Ulice`, `Číslo`, `Město`, `PSČ`, `Země`.

Validation on confirm, mirroring the prototype's messages:
- no name → `Zadejte název místa`
- no point → `Určete bod v mapě nebo vyberte adresu`

Both via `enqueueSnackbar(..., { variant: 'warning' })`. On success call the create or update mutation, then `onSaved?.(id)` and `onClose()`.

Do not add local padding or border `sx` to the dialog — `MuiDialog` is themed centrally and partial overrides produce lopsided spacing.

- [ ] **Step 2: Build the panel**

`app/src/features/clients/DeliveryPlacesPanel.tsx`, modelled on `NotesPanel.tsx`:

- Card headed `Místa doručení` with a count chip and, when `editable`, a `Přidat místo` button.
- One row per place: name, formatted address, note.
- Edit and delete icon buttons when `editable`; delete goes through `ConfirmDialog` with the text `Místo zmizí z nabídky u zastávek tohoto klienta. Na existujících vývozech zůstane vidět.`
- Empty state: `Žádná vlastní místa. Přidejte je tlačítkem výše, nebo rovnou při plánování vývozu.`
- Use `QueryBoundary` for the query states rather than a hand-rolled `isLoading` ladder.

Export the shared formatter:

```tsx
/** A place picked straight off the map has no street — show its coordinates
 * where the address line would go. */
export function formatPlaceAddress(place: ClientDeliveryPlaceDto): string {
  const a = place.address;
  if (a.streetName || a.city) {
    return `${[a.streetName, a.streetNumber].filter(Boolean).join(' ')}, ${a.zip ?? ''} ${a.city ?? ''}`.trim();
  }
  return `${Number(a.latitude).toFixed(4)}, ${Number(a.longitude).toFixed(4)}`;
}
```

- [ ] **Step 3: Mount it**

In `ClientDetail.tsx`, render `<DeliveryPlacesPanel clientId={id} editable={canEdit('clients')} />` on the info tab, below the two address cards and spanning the full grid width — matching the prototype's placement.

- [ ] **Step 4: Verify**

```bash
yarn test:run && yarn build && yarn lint
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/common/DeliveryPlaceDialog.tsx \
        app/src/features/clients/DeliveryPlacesPanel.tsx \
        app/src/features/clients/ClientDetail.tsx
git commit -m "feat(clients): manage delivery places on the client detail"
```

---

## Task 8: Stop picker in the shipment editor

**Files:**
- Create: `app/src/features/shipments/stopAddress.ts`
- Create: `app/src/features/shipments/stopAddress.test.ts`
- Modify: `app/src/features/shipments/ShipmentEditor.tsx`
- Modify: `app/src/features/shipments/shipmentDraft.ts`

**Interfaces:**
- Consumes: `formatPlaceAddress` (Task 7), `DeliveryPlaceDialog` (Task 7), the generated DTOs (Task 6).
- Produces: `resolveStopAddress(order, addressKind, deliveryPlaceId)` returning `{ lat?: number; lng?: number; text: string }`; `encodeStopChoice` / `decodeStopChoice` for the select value. `DraftStop.deliveryPlaceId?: string`.

- [ ] **Step 1: Write the failing test**

`app/src/features/shipments/stopAddress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decodeStopChoice, encodeStopChoice, resolveStopAddress } from 'src/features/shipments/stopAddress';
import { OutgoingShipmentStopAddressKind } from 'src/generated/api-client';

const place = { id: 'p1', name: 'Letní zahrádka', note: undefined,
  address: { streetName: 'Nábřežní', streetNumber: '3', city: 'Žitava', zip: '02763', latitude: 50.9, longitude: 14.8 } };
const order = {
  clientOfficialAddress: { streetName: 'Náměstí', streetNumber: '14', city: 'Žitava', zip: '02763', latitude: 50.897, longitude: 14.808 },
  clientContactAddress: { streetName: 'Dvůr', streetNumber: '2a', city: 'Žitava', zip: '02763', latitude: 50.88, longitude: 14.81 },
  clientDeliveryPlaces: [place],
} as never;

describe('resolveStopAddress', () => {
  it('uses the official address by default', () => {
    expect(resolveStopAddress(order, OutgoingShipmentStopAddressKind.Official).lat).toBe(50.897);
  });

  it('uses the contact address when selected', () => {
    expect(resolveStopAddress(order, OutgoingShipmentStopAddressKind.Contact).lat).toBe(50.88);
  });

  it('uses the place coordinates when one is selected', () => {
    const r = resolveStopAddress(order, OutgoingShipmentStopAddressKind.DeliveryPlace, 'p1');
    expect(r.lat).toBe(50.9);
    expect(r.text).toContain('Letní zahrádka');
  });

  it('falls back to the official address when the place is not in the list', () => {
    // A soft-deleted place is absent from clientDeliveryPlaces. Falling back
    // silently would relocate the delivery, so the caller must keep the stale
    // selection visible — this only guards the pure resolver.
    expect(resolveStopAddress(order, OutgoingShipmentStopAddressKind.DeliveryPlace, 'gone').lat).toBe(50.897);
  });
});

describe('stop choice encoding', () => {
  it('round-trips the two standard kinds', () => {
    expect(decodeStopChoice(encodeStopChoice(OutgoingShipmentStopAddressKind.Official)))
      .toEqual({ addressKind: OutgoingShipmentStopAddressKind.Official, deliveryPlaceId: undefined });
    expect(decodeStopChoice(encodeStopChoice(OutgoingShipmentStopAddressKind.Contact)))
      .toEqual({ addressKind: OutgoingShipmentStopAddressKind.Contact, deliveryPlaceId: undefined });
  });

  it('round-trips a place', () => {
    expect(decodeStopChoice(encodeStopChoice(OutgoingShipmentStopAddressKind.DeliveryPlace, 'p1')))
      .toEqual({ addressKind: OutgoingShipmentStopAddressKind.DeliveryPlace, deliveryPlaceId: 'p1' });
  });

  it('prefixes place IDs so they cannot collide with the standard values', () => {
    expect(encodeStopChoice(OutgoingShipmentStopAddressKind.DeliveryPlace, 'Official')).toBe('place:Official');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd app && yarn test:run src/features/shipments/stopAddress.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

`app/src/features/shipments/stopAddress.ts` exporting `encodeStopChoice`, `decodeStopChoice`, `resolveStopAddress`, and the constant `NEW_PLACE_CHOICE = '__new'`. Encoding is `'Official'` / `'Contact'` / `` `place:${id}` `` — the prefix keeps place IDs from colliding with the two literals. `resolveStopAddress` returns coordinates plus the display text used by both the editor row and the detail view, reusing `formatPlaceAddress`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
yarn test:run src/features/shipments/stopAddress.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire the editor**

In `ShipmentEditor.tsx`:

- Add `deliveryPlaceId?: string` to `DraftStop`; initialise it from `st.deliveryPlace?.id` when loading an existing shipment and to `undefined` for a newly toggled order.
- Replace `stopPoint()` with `resolveStopAddress`.
- Replace the two-option `Select` with the full picker: `Fakturační`, `Kontaktní` (only when the client has one), a `ListSubheader` `Vlastní místa` with one item per place, then `+ Nové místo…`. Widen it from 140px to 190px.
- Show the resolved destination as the row's second line, ellipsised.
- **A stop whose `deliveryPlaceId` is not in the client's list** (soft-deleted since it was chosen) gets an extra `MenuItem` for it, selected and disabled, labelled from `stop.deliveryPlace.name` on the loaded shipment. Without this the value matches no option and re-saving relocates the delivery to the billing address.
- `+ Nové místo…` opens `DeliveryPlaceDialog`; its `onSaved(placeId)` sets `addressKind = DeliveryPlace` and `deliveryPlaceId = placeId` on that stop.
- Send `selectedAddressKind` and `clientDeliveryPlaceId` in the save payload.

- [ ] **Step 6: Add the field to the dirty check**

In `shipmentDraft.ts`, add `deliveryPlaceId: s.deliveryPlaceId ?? null` to the serialised stop shape, so choosing a place marks the draft dirty and the unsaved-changes guard fires.

- [ ] **Step 7: Add component tests**

Append to `stopAddress.test.ts` or create `ShipmentEditor.test.tsx` following the conventions in `app/CLAUDE.md` — `fireEvent`, not `user-event`; MUI `Select` opens on `mouseDown`; `vi.mock` the resource hook with loading/error/no-data variants. Cover: the picker lists the client's places; `+ Nové místo…` opens the dialog; a stop pointing at a place absent from the list keeps it selected.

- [ ] **Step 8: Verify**

```bash
yarn test:run && yarn build && yarn lint
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add app/src/features/shipments/stopAddress.ts \
        app/src/features/shipments/stopAddress.test.ts \
        app/src/features/shipments/ShipmentEditor.tsx \
        app/src/features/shipments/shipmentDraft.ts
git commit -m "feat(shipments): pick a client delivery place for a stop"
```

---

## Task 9: Shipment detail rendering and final verification

**Files:**
- Modify: `app/src/features/shipments/ShipmentDetail.tsx`

**Interfaces:**
- Consumes: `resolveStopAddress` and `formatPlaceAddress` (Tasks 7–8), `OutgoingShipmentStopDto.deliveryPlace` (Task 4).
- Produces: nothing downstream.

- [ ] **Step 1: Render the place on the stop header**

In the stop header block, keep the client's coloured round avatar and the client name as the title. When `stop.selectedAddressKind === DeliveryPlace` and `stop.deliveryPlace` is set, add a small chip beside the title carrying the place name, and render `formatPlaceAddress(stop.deliveryPlace)` as the line below. Otherwise keep today's `address · kind` line.

Use `theme.vars.palette.*` for the chip colour, never `theme.palette.*`.

- [ ] **Step 2: Confirm the map already follows**

The route map reads its points from the same resolution path, so no change should be needed. Verify by loading a shipment whose stop uses a place and checking the pin sits at the place, not the billing address. If the map still uses a local resolver, switch it to `resolveStopAddress`.

- [ ] **Step 3: Run the full frontend suite**

```bash
cd app && yarn test:run && yarn build && yarn lint
```

Expected: all pass.

- [ ] **Step 4: Run the full backend suite**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: all pass.

- [ ] **Step 5: Manual end-to-end pass**

With the backend running and `yarn dev`:

1. Client detail → add a place via address search → it appears in the card.
2. Add a second place by clicking the map only, no address → the card shows its coordinates.
3. Shipment editor → both places appear in a stop's picker → select one → the route map pin moves.
4. Save → reopen the editor → the place is still selected (this is the regression the Task 3 bug fix guards).
5. Shipment detail → the stop shows the client name, the place chip and the place address.
6. Delete the place on the client → the card loses it, the shipment detail still shows it, and the editor keeps it selected as a disabled `(smazáno)` entry.
7. `+ Nové místo…` from inside the editor → the place is created and selected without leaving the screen.

- [ ] **Step 6: Commit**

```bash
git add app/src/features/shipments/ShipmentDetail.tsx
git commit -m "feat(shipments): show the delivery place on the shipment detail"
```

---

## Self-Review Notes

**Spec coverage.** Every spec section maps to a task: data model → 1; endpoints → 2; validation → 3; read projections → 4; `searchAddresses` parts and the dialog extraction → 5; codegen → 6; client detail → 7; shipment editor → 8; shipment detail → 9. The spec's testing section is distributed across the tasks that introduce each surface.

**Additions beyond the spec.** Task 3 fixes a pre-existing `SelectedAddressKind` persistence bug found while reading `UpdateOutgoingShipmentEndpoint`. It is not optional — the feature does not work without it.

**Known softness.** Three test bodies (Task 3 step 7, Task 4 step 5) are specified as behaviour plus a pointer to the neighbouring tests to copy the builder calls from, rather than as literal code, because the shipment builders take a wide argument list that must match the file they land next to. The implementer must replace those comments with real code before committing; a committed comment-only test body is a task failure.
