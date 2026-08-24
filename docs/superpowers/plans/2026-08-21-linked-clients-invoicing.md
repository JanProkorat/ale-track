# Propojení klientů Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client's invoices be issued to another client (its payer), so chain pubs can take deliveries at their own addresses without carrying a billing address of their own.

**Architecture:** `Client.OfficialAddress` becomes nullable and `Client` gains a self-referencing nullable FK `InvoicingClientId`. `ShipmentInvoiceReconciler` opens the default invoice for `orderingClient.InvoicingClientId ?? orderingClientId` while invoice lines keep `OrderingClientId`, which reuses the existing payer ≠ orderer ("cross-billing") path end to end. The Fakturace table groups an invoice's lines into collapsible per-orderer parties, and both exports gain an additive grouped Fakturace part built from the same reconciled split.

**Tech Stack:** .NET 10, FastEndpoints, EF Core 9 + Npgsql, xUnit + FluentAssertions + Moq.EntityFrameworkCore, ClosedXML 0.105.1, DocumentFormat.OpenXml 3.5.1, React 19 + MUI + TypeScript, Vitest, NSwag.

**Spec:** `docs/superpowers/specs/2026-08-21-linked-clients-invoicing-design.md`

## Global Constraints

- Backend commands run from `api/AleTrack/`. Build: `dotnet build AleTrack.sln`. Test: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`. Single class: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~<ClassName>"`.
- Frontend commands run from `app/`. Test: `yarn test:run`. Single file: `yarn test:run src/path/file.test.ts`. Typecheck: `yarn typecheck`. Lint: `yarn lint`.
- Tests need no database — `AleTrackDbContext` is mocked with `Moq.EntityFrameworkCore` via `AleTrackDbContextMockFactory.CreateMock(...)`.
- **Czech label for the relation: `Propojený klient`** (field on a sub-client). Reverse list on the payer: `Propojení klienti`. Invoice band chip: `N propojených klientů`. Missing-address warning text: `Klient nemá vyplněnou dodací adresu`.
- Code comments and doc comments in **English only**. Doc comments must be shorter than the code they document; skip them when the name already says it.
- Never edit `appsettings.*.json`, `.env*`, or any `*.pfx`/`*.key`/`*.pem`.
- Migrations are **not** auto-applied. `ApplyMigrationsAsync()` is commented out in `Program.cs`.
- The generated frontend API client `app/src/generated/api-client.ts` is produced by `yarn generate-api` against a **running backend on port 8080** — never hand-edited. A backend DTO change and its frontend consumption belong in the same commit (Task 4 does the regeneration).
- Enums arrive over the wire as their **string names** while the generated TS enums are numeric — normalize through `src/lib/labels.ts` helpers (`addrKindValue` etc.), never compare a raw DTO enum field with `===`.
- Existing invariant that every reconciler test asserts: pieces billed across all invoices plus private pieces equal pieces the shipment carries (`AssertBalanced`).

---

### Task 1: Entity, EF configuration and migration

**Files:**
- Modify: `api/AleTrack/AleTrack/Entities/Client.cs`
- Modify: `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientConfiguration.cs`
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/<timestamp>_LinkedClientsInvoicing.cs` (generated)
- Modify: `api/AleTrack/AleTrack.Tests/Builders/ClientBuilder.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Clients/ClientInvoicingRelationTests.cs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Client.OfficialAddress` is `Address?`
  - `Client.InvoicingClientId` is `long?`, column `invoicing_client_id`
  - `Client.InvoicingClient` is `Client?`
  - `Client.InvoicedClients` is `List<Client>`
  - `ClientBuilder.BuildEntity(..., Address? officialAddress = null, bool noOfficialAddress = false, long? invoicingClientId = null, Client? invoicingClient = null)`

- [ ] **Step 1: Write the failing test**

Create `api/AleTrack/AleTrack.Tests/Features/Clients/ClientInvoicingRelationTests.cs`:

```csharp
using AleTrack.Entities;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The shape of the payer relation on the entity itself: a client may carry no official
/// address, and may point at exactly one payer that holds it back.
/// </summary>
public sealed class ClientInvoicingRelationTests
{
    [Fact]
    public void Client_CanBeBuiltWithoutOfficialAddress()
    {
        var client = ClientBuilder.BuildEntity(noOfficialAddress: true);

        client.OfficialAddress.Should().BeNull();
    }

    [Fact]
    public void Client_CarriesItsPayerAndItsSubClients()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 1;

        var sub = ClientBuilder.BuildEntity(
            name: "Pub A",
            noOfficialAddress: true,
            invoicingClientId: payer.Id,
            invoicingClient: payer);

        payer.InvoicedClients.Add(sub);

        sub.InvoicingClientId.Should().Be(1);
        sub.InvoicingClient.Should().BeSameAs(payer);
        payer.InvoicedClients.Should().ContainSingle().Which.Should().BeSameAs(sub);
        payer.InvoicingClientId.Should().BeNull();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ClientInvoicingRelationTests"`
Expected: compile error — `noOfficialAddress`, `invoicingClientId`, `invoicingClient` are not parameters of `BuildEntity`, and `Client` has no `InvoicingClientId` / `InvoicingClient` / `InvoicedClients`.

- [ ] **Step 3: Make `OfficialAddress` nullable and add the relation**

In `api/AleTrack/AleTrack/Entities/Client.cs`, replace the `OfficialAddress` property and append the relation after `ContactAddress`:

```csharp
    /// <summary>
    /// Official (billing) address. Null for a client billed through its payer — see
    /// <see cref="InvoicingClient"/>.
    /// </summary>
    public Address? OfficialAddress { get; set; }

    /// <summary>
    /// Contact address of the client, which can be null
    /// </summary>
    public Address? ContactAddress { get; set; }

    /// <summary>
    /// Client that receives the invoices for this one's goods, when another client pays.
    /// </summary>
    [Column("invoicing_client_id")]
    public long? InvoicingClientId { get; set; }

    /// <inheritdoc cref="InvoicingClientId"/>
    public Client? InvoicingClient { get; set; }

    /// <summary>
    /// Clients whose goods are invoiced to this one. Kept flat: a client with any of these
    /// cannot itself have an <see cref="InvoicingClient"/>.
    /// </summary>
    public List<Client> InvoicedClients { get; set; } = [];
```

- [ ] **Step 4: Configure the relation**

In `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientConfiguration.cs`, add after the `ContactAddress` `OwnsOne` block:

```csharp
        // Restrict rather than cascade: a payer must not be removable while sub-clients still
        // point at it, and soft delete would otherwise leave them pointing at a deleted row.
        builder.HasOne(x => x.InvoicingClient)
            .WithMany(x => x.InvoicedClients)
            .HasForeignKey(x => x.InvoicingClientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.InvoicingClientId);
```

- [ ] **Step 5: Extend the test builder**

In `api/AleTrack/AleTrack.Tests/Builders/ClientBuilder.cs`, replace `BuildEntity` with:

```csharp
    public static Client BuildEntity(
        Guid? publicId = null,
        string? name = null,
        string? businessName = null,
        Region region = Region.ZittauCity,
        Address? officialAddress = null,
        Address? contactAddress = null,
        bool noOfficialAddress = false,
        long? invoicingClientId = null,
        Client? invoicingClient = null)
    {
        return new Client
        {
            PublicId = publicId ?? Guid.NewGuid(),
            Name = name ?? "Default Client",
            BusinessName = businessName,
            Region = region,
            // An explicit flag rather than "null means none": every existing caller relies on
            // null defaulting to a built address.
            OfficialAddress = noOfficialAddress ? null : officialAddress ?? AddressBuilder.BuildEntity(),
            ContactAddress = contactAddress,
            InvoicingClientId = invoicingClientId,
            InvoicingClient = invoicingClient
        };
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ClientInvoicingRelationTests"`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the whole backend suite to catch nullability fallout**

Run: `dotnet build AleTrack.sln`
Expected: the build fails or warns where non-nullable `OfficialAddress` was assumed — at minimum `Features/Clients/Queries/Detail/GetClientDetailEndpoint.cs` (`c.OfficialAddress.ToDto()`) and `Features/Clients/Commands/*` (`req.Data.OfficialAddress.ToDbEntity()`).

Fix **only** the compile breaks, mechanically, leaving behaviour identical for a client that has an address:

- `GetClientDetailEndpoint.cs`: `OfficialAddress = c.OfficialAddress != null ? c.OfficialAddress.ToDto() : null,`
- `CreateClientEndpoint.cs`: `OfficialAddress = req.Data.OfficialAddress?.ToDbEntity(),`
- `UpdateClientEndpoint.cs`: `client.OfficialAddress = req.Data.OfficialAddress?.ToDbEntity();`

(The DTOs themselves become nullable in Tasks 3 and 4; here you are only unblocking the build. If a DTO's non-nullable `AddressDto` makes `?.` redundant the compiler will say so — leave the call as it was in that case.)

Then run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: PASS, same count as before plus the 2 new tests.

- [ ] **Step 8: Generate the migration**

Run from `api/AleTrack/AleTrack/`:

```bash
dotnet ef migrations add LinkedClientsInvoicing
```

- [ ] **Step 9: Verify the migration says what it should**

Run from `api/AleTrack/`:

```bash
grep -n "invoicing_client_id\|official_address\|CreateIndex\|AddForeignKey\|nullable" AleTrack/Infrastructure/Persistence/Migrations/*LinkedClientsInvoicing.cs
```

Expected: `AlterColumn` calls for every `official_address_*` column with `nullable: true`, an `AddColumn<long>` for `invoicing_client_id`, a `CreateIndex` on it, and a foreign key onto `clients` with `ReferentialAction.Restrict`.

If the file mixes the `ALTER`s in a way that will not apply cleanly to Supabase, split it into two migrations rather than hand-editing one file.

- [ ] **Step 10: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/Client.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/ClientConfiguration.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations \
        api/AleTrack/AleTrack/Features/Clients \
        api/AleTrack/AleTrack.Tests/Builders/ClientBuilder.cs \
        api/AleTrack/AleTrack.Tests/Features/Clients/ClientInvoicingRelationTests.cs
git commit -m "feat(api): optional client official address and payer relation"
```

---

### Task 2: InvoicingClientResolver

**Files:**
- Create: `api/AleTrack/AleTrack/Features/Clients/Utils/InvoicingClientResolver.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Clients/InvoicingClientResolverTests.cs`

**Interfaces:**
- Consumes: `Client.InvoicingClientId`, `Client.OfficialAddress`, `Client.InvoicedClients` (Task 1).
- Produces: `InvoicingClientResolver.ResolveAsync(AleTrackDbContext dbContext, Guid? clientPublicId, Guid? invoicingClientPublicId, CancellationToken ct) → Task<long?>`. `clientPublicId` is null when the client does not exist yet (create).

- [ ] **Step 1: Write the failing test**

Create `api/AleTrack/AleTrack.Tests/Features/Clients/InvoicingClientResolverTests.cs`:

```csharp
using AleTrack.Common.Exceptions;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// The rules the schema cannot express: one flat level, a payer that can actually be
/// invoiced, and no client pointing at itself.
/// </summary>
public sealed class InvoicingClientResolverTests
{
    [Fact]
    public async Task ResolveAsync_NoPayerRequested_ReturnsNull()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var result = await InvoicingClientResolver.ResolveAsync(
            dbContext.Object, clientPublicId: Guid.NewGuid(), invoicingClientPublicId: null,
            CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task ResolveAsync_ValidPayer_ReturnsItsInternalId()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 7;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer]);

        var result = await InvoicingClientResolver.ResolveAsync(
            dbContext.Object, clientPublicId: Guid.NewGuid(), payer.PublicId, CancellationToken.None);

        result.Should().Be(7);
    }

    [Fact]
    public async Task ResolveAsync_UnknownPayer_Throws404()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, clientPublicId: Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task ResolveAsync_PayerIsTheClientItself_Throws400()
    {
        var client = ClientBuilder.BuildEntity();
        client.Id = 3;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, client.PublicId, client.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task ResolveAsync_PayerAlreadyHasAPayer_Throws400()
    {
        // No chains: the relation is exactly one hop, so "who pays" never needs walking.
        var head = ClientBuilder.BuildEntity(name: "Head");
        head.Id = 1;
        var middle = ClientBuilder.BuildEntity(name: "Middle", invoicingClientId: head.Id);
        middle.Id = 2;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [head, middle]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, Guid.NewGuid(), middle.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task ResolveAsync_PayerWithoutOfficialAddress_Throws400()
    {
        var payer = ClientBuilder.BuildEntity(name: "No address", noOfficialAddress: true);
        payer.Id = 4;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, Guid.NewGuid(), payer.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task ResolveAsync_ClientThatIsItselfAPayer_Throws400()
    {
        // The other direction of the same rule: a client with sub-clients cannot be given one.
        var payer = ClientBuilder.BuildEntity(name: "Head");
        payer.Id = 1;
        var client = ClientBuilder.BuildEntity(name: "Also a head");
        client.Id = 2;
        var sub = ClientBuilder.BuildEntity(name: "Sub", invoicingClientId: client.Id);
        sub.Id = 3;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, client, sub]);

        var act = () => InvoicingClientResolver.ResolveAsync(
            dbContext.Object, client.PublicId, payer.PublicId, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }
}
```

Before running, confirm the exception type and status-code property that `ThrowHelper` actually throws:

```bash
sed -n 1,100p api/AleTrack/AleTrack/Common/Utils/ThrowHelper.cs
```

If the type or property differs from `AleTrackException` / `StatusCode`, adjust the assertions and the `using` to match — do not change `ThrowHelper`.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~InvoicingClientResolverTests"`
Expected: compile error — `InvoicingClientResolver` does not exist.

- [ ] **Step 3: Write the resolver**

Create `api/AleTrack/AleTrack/Features/Clients/Utils/InvoicingClientResolver.cs`:

```csharp
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// Resolves the client a saved client's invoices go to, applying the rules the schema cannot
/// express. Shared by the create and update endpoints so they cannot drift.
/// </summary>
/// <remarks>
/// The relation is deliberately one hop deep in both directions: a payer may not have a payer,
/// and a client that is already a payer may not be given one. That keeps "who pays" answerable
/// without walking a chain, which is what the reconciler relies on.
/// </remarks>
public static class InvoicingClientResolver
{
    /// <param name="clientPublicId">
    /// The client being saved, or null on create — there is nothing to point at itself yet.
    /// </param>
    public static async Task<long?> ResolveAsync(
        AleTrackDbContext dbContext,
        Guid? clientPublicId,
        Guid? invoicingClientPublicId,
        CancellationToken ct)
    {
        if (invoicingClientPublicId is null)
            return null;

        if (clientPublicId is not null && clientPublicId == invoicingClientPublicId)
            ThrowHelper.BadRequest("A client cannot be its own invoicing client.");

        var payer = await dbContext.Clients
            .Where(c => c.PublicId == invoicingClientPublicId.Value)
            .Select(c => new { c.Id, c.InvoicingClientId, HasOfficialAddress = c.OfficialAddress != null })
            .FirstOrDefaultAsync(ct);

        if (payer is null)
            ThrowHelper.PublicEntitiesNotFound(nameof(Client), [invoicingClientPublicId.Value]);

        if (payer!.InvoicingClientId is not null)
            ThrowHelper.BadRequest(
                $"Client {invoicingClientPublicId} is invoiced through another client and cannot be an invoicing client itself.");

        if (!payer.HasOfficialAddress)
            ThrowHelper.BadRequest(
                $"Client {invoicingClientPublicId} has no official address and cannot be invoiced to.");

        if (clientPublicId is not null)
        {
            var isItselfAPayer = await dbContext.Clients
                .AnyAsync(c => c.InvoicingClient != null && c.InvoicingClient.PublicId == clientPublicId.Value, ct);

            if (isItselfAPayer)
                ThrowHelper.BadRequest(
                    $"Client {clientPublicId} already invoices for other clients and cannot be invoiced through one.");
        }

        return payer.Id;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~InvoicingClientResolverTests"`
Expected: PASS (7 tests).

If `ResolveAsync_ClientThatIsItselfAPayer_Throws400` fails because the mocked `DbSet` cannot follow the `InvoicingClient` navigation, change that query to compare internal ids instead — load the client's `Id` first and then `AnyAsync(c => c.InvoicingClientId == id)`:

```csharp
            var clientId = await dbContext.Clients
                .Where(c => c.PublicId == clientPublicId.Value)
                .Select(c => (long?)c.Id)
                .FirstOrDefaultAsync(ct);

            if (clientId is not null
                && await dbContext.Clients.AnyAsync(c => c.InvoicingClientId == clientId, ct))
                ThrowHelper.BadRequest(
                    $"Client {clientPublicId} already invoices for other clients and cannot be invoiced through one.");
```

- [ ] **Step 5: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Clients/Utils/InvoicingClientResolver.cs \
        api/AleTrack/AleTrack.Tests/Features/Clients/InvoicingClientResolverTests.cs
git commit -m "feat(api): resolve and validate a client's invoicing client"
```

---

### Task 3: Client write endpoints

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Clients/Commands/Create/CreateClientDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Commands/Create/CreateClientEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Commands/Create/CreateClientValidator.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Commands/Update/UpdateClientDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Commands/Update/UpdateClientEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Commands/Update/UpdateClientValidator.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Commands/Delete/DeleteClientEndpoint.cs`
- Modify: `api/AleTrack/AleTrack.Tests/Builders/ClientBuilder.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/Clients/ClientInvoicingWriteTests.cs`

**Interfaces:**
- Consumes: `InvoicingClientResolver.ResolveAsync` (Task 2).
- Produces:
  - `CreateClientDto.OfficialAddress` is `AddressDto?`, plus `Guid? InvoicingClientId`
  - `UpdateClientDto.OfficialAddress` is `AddressDto?`, plus `Guid? InvoicingClientId`
  - `ClientBuilder.BuildCreateDto(..., bool noOfficialAddress = false, Guid? invoicingClientId = null)` and `BuildUpdateDto(..., bool noOfficialAddress = false, Guid? invoicingClientId = null)`

- [ ] **Step 1: Write the failing test**

Create `api/AleTrack/AleTrack.Tests/Features/Clients/ClientInvoicingWriteTests.cs`:

```csharp
using AleTrack.Common.Exceptions;
using AleTrack.Entities;
using AleTrack.Features.Clients.Commands.Create;
using AleTrack.Features.Clients.Commands.Delete;
using AleTrack.Features.Clients.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// Writing a client that is billed through another one: no official address of its own, a
/// payer recorded, and a payer that cannot be deleted out from under it.
/// </summary>
public sealed class ClientInvoicingWriteTests
{
    [Fact]
    public async Task Create_WithoutOfficialAddress_SavesNull()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var command = new CreateClientRequest
        {
            Data = ClientBuilder.BuildCreateDto(name: "Pub A", noOfficialAddress: true)
        };

        var endpoint = EndpointBuilder<CreateClientRequest, CreateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Clients.Add(It.Is<Client>(c =>
            c.Name == "Pub A" && c.OfficialAddress == null && c.InvoicingClientId == null)), Times.Once);
    }

    [Fact]
    public async Task Create_WithInvoicingClient_RecordsItsInternalId()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer]);

        var command = new CreateClientRequest
        {
            Data = ClientBuilder.BuildCreateDto(
                name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.PublicId)
        };

        var endpoint = EndpointBuilder<CreateClientRequest, CreateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Clients.Add(It.Is<Client>(c => c.InvoicingClientId == 42)), Times.Once);
    }

    [Fact]
    public async Task Update_ClearingInvoicingClient_SetsItBackToNull()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var client = ClientBuilder.BuildEntity(name: "Pub A", invoicingClientId: payer.Id);
        client.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, client]);

        var command = new UpdateClientRequest
        {
            Id = client.PublicId,
            Data = ClientBuilder.BuildUpdateDto(name: "Pub A", invoicingClientId: null)
        };

        var endpoint = EndpointBuilder<UpdateClientRequest, UpdateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        client.InvoicingClientId.Should().BeNull();
    }

    [Fact]
    public async Task Update_ClearingOfficialAddress_SetsItBackToNull()
    {
        var client = ClientBuilder.BuildEntity(name: "Pub A");
        client.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var command = new UpdateClientRequest
        {
            Id = client.PublicId,
            Data = ClientBuilder.BuildUpdateDto(name: "Pub A", noOfficialAddress: true)
        };

        var endpoint = EndpointBuilder<UpdateClientRequest, UpdateClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        client.OfficialAddress.Should().BeNull();
    }

    [Fact]
    public async Task Delete_ClientWithSubClients_Throws400()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(name: "Pub A", invoicingClientId: payer.Id);
        sub.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointBuilder<DeleteClientRequest, DeleteClientEndpoint>.Create(dbContext.Object);
        var act = () => endpoint.HandleAsync(new DeleteClientRequest { Id = payer.PublicId }, CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Delete_ClientWithoutSubClients_Deletes()
    {
        var client = ClientBuilder.BuildEntity(name: "Pub A");
        client.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client]);

        var endpoint = EndpointBuilder<DeleteClientRequest, DeleteClientEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(new DeleteClientRequest { Id = client.PublicId }, CancellationToken.None);

        dbContext.Verify(e => e.Clients.Remove(client), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ClientInvoicingWriteTests"`
Expected: compile error — `noOfficialAddress` / `invoicingClientId` are not parameters of `BuildCreateDto` / `BuildUpdateDto`.

- [ ] **Step 3: Make the DTOs carry the two new facts**

In `CreateClientDto.cs`, replace the `OfficialAddress` property and add the payer:

```csharp
    /// <summary>
    /// Official (billing) address. Omit for a client invoiced through
    /// <see cref="InvoicingClientId"/>.
    /// </summary>
    public AddressDto? OfficialAddress { get; set; }

    /// <summary>
    /// Info about clients' contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }

    /// <summary>
    /// Public ID of the client that receives this one's invoices, when another client pays.
    /// </summary>
    public Guid? InvoicingClientId { get; set; }
```

Apply the identical two changes to `UpdateClientDto.cs` (same property names, same doc comments).

- [ ] **Step 4: Gate the address validators**

In `CreateClientValidator.cs`, inside `CreateClientDtoValidator`, replace the official-address rule:

```csharp
        RuleFor(r => r.OfficialAddress).SetValidator(new AddressValidator()).When(r => r.OfficialAddress != null);
```

Apply the same change in `UpdateClientValidator.cs`. Read that file first — it may name the rule slightly differently:

```bash
sed -n 1,60p api/AleTrack/AleTrack/Features/Clients/Commands/Update/UpdateClientValidator.cs
```

- [ ] **Step 5: Resolve the payer on create**

In `CreateClientEndpoint.cs`, add the using and resolve before building the entity:

```csharp
using AleTrack.Features.Clients.Utils;
```

```csharp
    public override async Task HandleAsync(CreateClientRequest req, CancellationToken ct)
    {
        var invoicingClientId = await InvoicingClientResolver.ResolveAsync(
            dbContext, clientPublicId: null, req.Data.InvoicingClientId, ct);

        var client = new Client
        {
            Name = req.Data.Name,
            BusinessName = req.Data.BusinessName,
            Region = req.Data.Region,
            OfficialAddress = req.Data.OfficialAddress?.ToDbEntity(),
            ContactAddress = req.Data.ContactAddress?.ToDbEntity(),
            InvoicingClientId = invoicingClientId,
            Contacts = req.Data.Contacts
                .Select(c => new ClientContact
                {
                    Description = c.Description,
                    Type = c.Type,
                    Value = c.Value
                })
                .ToList()
        };
```

- [ ] **Step 6: Resolve the payer on update, and let both addresses be cleared**

In `UpdateClientEndpoint.cs`, add `using AleTrack.Features.Clients.Utils;` and replace the assignment block:

```csharp
        client!.Name = req.Data.Name;
        client.BusinessName = req.Data.BusinessName;
        client.Region = req.Data.Region;
        // Assigned unconditionally: both addresses are now optional, so an absent one in the
        // request means "clear it", not "leave it".
        client.OfficialAddress = req.Data.OfficialAddress?.ToDbEntity();
        client.ContactAddress = req.Data.ContactAddress?.ToDbEntity();
        client.InvoicingClientId = await InvoicingClientResolver.ResolveAsync(
            dbContext, req.Id, req.Data.InvoicingClientId, ct);
```

Note this also fixes `ContactAddress`, which previously could never be cleared. That is a behaviour change: verify no existing test asserts the old "keeps the old contact address" behaviour by running the Clients tests in Step 9; if one does, keep the old `if (req.Data.ContactAddress is not null)` guard for the contact address only and leave a comment saying why.

- [ ] **Step 7: Block deleting a payer**

In `DeleteClientEndpoint.cs`, insert before `dbContext.Clients.Remove(client!)`:

```csharp
        // Restrict on the FK is the backstop; this is the message. Soft delete would otherwise
        // leave sub-clients pointing at a row nobody can see.
        if (await dbContext.Clients.AnyAsync(c => c.InvoicingClientId == client!.Id, ct))
            ThrowHelper.BadRequest(
                $"Client {req.Id} invoices for other clients. Unlink them before deleting it.");
```

- [ ] **Step 8: Extend the DTO builders**

In `api/AleTrack/AleTrack.Tests/Builders/ClientBuilder.cs`, add the two parameters to both DTO builders and use them. `BuildCreateDto`:

```csharp
    public static CreateClientDto BuildCreateDto(
        string? name = null,
        string? businessName = null,
        Region region = Region.ZittauCity,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null,
        List<CreateClientContactDto>? contacts = null,
        bool noOfficialAddress = false,
        Guid? invoicingClientId = null)
    {
        return new CreateClientDto
        {
            Name = name ?? "Default Client",
            BusinessName = businessName,
            Region = region,
            OfficialAddress = noOfficialAddress ? null : officialAddress ?? AddressBuilder.BuildDto(),
            ContactAddress = contactAddress,
            InvoicingClientId = invoicingClientId,
            Contacts = contacts ??
            [
                new CreateClientContactDto
                {
                    Type = ContactType.Email,
                    Description = "Primary",
                    Value = "test@example.com"
                }
            ]
        };
    }
```

`BuildUpdateDto` — same two parameters, same `noOfficialAddress` handling, keeping its existing default address values:

```csharp
    public static UpdateClientDto BuildUpdateDto(
        string? name = null,
        string? businessName = null,
        Region region = Region.Berlin,
        AddressDto? officialAddress = null,
        AddressDto? contactAddress = null,
        List<UpdateClientContactDto>? contacts = null,
        bool noOfficialAddress = false,
        Guid? invoicingClientId = null)
    {
        return new UpdateClientDto
        {
            Name = name ?? "Updated Client",
            BusinessName = businessName ?? "Updated Business",
            Region = region,
            OfficialAddress = noOfficialAddress
                ? null
                : officialAddress ?? AddressBuilder.BuildDto(
                    city: "Updated City",
                    streetName: "Updated Street",
                    streetNumber: "2",
                    zip: "11111"
                ),
            ContactAddress = contactAddress,
            InvoicingClientId = invoicingClientId,
            Contacts = contacts ??
            [
                new UpdateClientContactDto
                {
                    Type = ContactType.Phone,
                    Description = "Updated",
                    Value = "+420123456789"
                }
            ]
        };
    }
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ClientInvoicingWriteTests"`
Expected: PASS (6 tests).

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~Clients"`
Expected: PASS — existing `CreateClientTests`, `UpdateClientTests`, `DeleteClientTests` unaffected.

- [ ] **Step 10: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Clients api/AleTrack/AleTrack.Tests
git commit -m "feat(api): write a client's invoicing client and optional official address"
```

---

### Task 4: Client read endpoints and API-client regeneration

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Clients/Queries/Detail/ClientDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Queries/Detail/GetClientDetailEndpoint.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Queries/List/ClientListItemDto.cs`
- Modify: `api/AleTrack/AleTrack/Features/Clients/Queries/List/GetClientListEndpoint.cs`
- Modify: `app/src/generated/api-client.ts` (regenerated, never hand-edited)
- Test: `api/AleTrack/AleTrack.Tests/Features/Clients/ClientInvoicingReadTests.cs`

**Interfaces:**
- Consumes: `Client.InvoicingClient`, `Client.InvoicedClients` (Task 1).
- Produces:
  - `ClientDto.OfficialAddress` is `AddressDto?`; new `Guid? InvoicingClientId`, `string? InvoicingClientName`, `List<LinkedClientDto> InvoicedClients`
  - `LinkedClientDto` (in the `Detail` namespace) with `Guid Id`, `string Name`
  - `ClientListItemDto` gains `Guid? InvoicingClientId`, `string? InvoicingClientName`
  - Frontend types `ClientDto.invoicingClientId`, `ClientDto.invoicingClientName`, `ClientDto.invoicedClients`, `ClientListItemDto.invoicingClientId`, `ClientListItemDto.invoicingClientName`, and `officialAddress` optional on both

- [ ] **Step 1: Write the failing test**

Create `api/AleTrack/AleTrack.Tests/Features/Clients/ClientInvoicingReadTests.cs`:

```csharp
using AleTrack.Common.Models;
using AleTrack.Features.Clients.Queries.Detail;
using AleTrack.Features.Clients.Queries.List;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;

namespace AleTrack.Tests.Features.Clients;

/// <summary>
/// What the two read models say about the payer relation — the detail from both ends, the
/// list from the sub-client's.
/// </summary>
public sealed class ClientInvoicingReadTests
{
    [Fact]
    public async Task Detail_SubClient_NamesItsPayerAndHasNoOfficialAddress()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(
            name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.Id, invoicingClient: payer);
        sub.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointBuilder<GetClientDetailRequest, GetClientDetailEndpoint, ClientDto>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetClientDetailRequest { Id = sub.PublicId }, CancellationToken.None);

        var result = endpoint.Response;
        result.OfficialAddress.Should().BeNull();
        result.InvoicingClientId.Should().Be(payer.PublicId);
        result.InvoicingClientName.Should().Be("Head Office");
        result.InvoicedClients.Should().BeEmpty();
    }

    [Fact]
    public async Task Detail_Payer_ListsItsSubClients()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(
            name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.Id, invoicingClient: payer);
        sub.Id = 5;
        payer.InvoicedClients.Add(sub);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointBuilder<GetClientDetailRequest, GetClientDetailEndpoint, ClientDto>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new GetClientDetailRequest { Id = payer.PublicId }, CancellationToken.None);

        var result = endpoint.Response;
        result.InvoicingClientId.Should().BeNull();
        result.InvoicedClients.Should().ContainSingle()
            .Which.Should().BeEquivalentTo(new { Id = sub.PublicId, Name = "Pub A" });
    }

    [Fact]
    public async Task List_SubClient_CarriesItsPayerName()
    {
        var payer = ClientBuilder.BuildEntity(name: "Head Office");
        payer.Id = 42;
        var sub = ClientBuilder.BuildEntity(
            name: "Pub A", noOfficialAddress: true, invoicingClientId: payer.Id, invoicingClient: payer);
        sub.Id = 5;
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [payer, sub]);

        var endpoint = EndpointBuilder<FilterableRequest, GetClientListEndpoint, List<ClientListItemDto>>
            .Create(dbContext.Object);
        await endpoint.HandleAsync(new FilterableRequest(), CancellationToken.None);

        var row = endpoint.Response.Single(c => c.Id == sub.PublicId);
        row.InvoicingClientId.Should().Be(payer.PublicId);
        row.InvoicingClientName.Should().Be("Head Office");
    }
}
```

Before running, check how an existing query test constructs the endpoint and reads the response, and copy that exact form:

```bash
sed -n 1,60p api/AleTrack/AleTrack.Tests/Features/Clients/GetClientListTests.cs
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ClientInvoicingReadTests"`
Expected: compile error — `ClientDto` has no `InvoicingClientId` / `InvoicingClientName` / `InvoicedClients`; `ClientListItemDto` has no payer fields.

- [ ] **Step 3: Extend the detail DTO**

In `ClientDto.cs`, replace `OfficialAddress` and append the relation fields plus the small nested DTO:

```csharp
    /// <summary>
    /// Official (billing) address. Null for a client invoiced through
    /// <see cref="InvoicingClientId"/>.
    /// </summary>
    public AddressDto? OfficialAddress { get; set; }

    /// <summary>
    /// Contact address
    /// </summary>
    public AddressDto? ContactAddress { get; set; }

    /// <summary>
    /// Public ID of the client that receives this one's invoices, when another client pays.
    /// </summary>
    public Guid? InvoicingClientId { get; set; }

    /// <inheritdoc cref="InvoicingClientId"/>
    public string? InvoicingClientName { get; set; }

    /// <summary>
    /// Clients whose invoices come to this one. Empty unless this client is a payer.
    /// </summary>
    public List<LinkedClientDto> InvoicedClients { get; set; } = [];

    /// <summary>
    /// Related contacts of the client
    /// </summary>
    public List<ClientContactDto> Contacts { get; set; } = [];
}

/// <summary>
/// A client named as the other end of the invoicing relation.
/// </summary>
public sealed record LinkedClientDto
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;
```

(The closing brace of `ClientDto` moves above `LinkedClientDto`; keep `ClientContactDto` where it is.)

- [ ] **Step 4: Project the new fields in the detail query**

In `GetClientDetailEndpoint.cs`, inside the `Select`:

```csharp
                OfficialAddress = c.OfficialAddress != null ? c.OfficialAddress.ToDto() : null,
                ContactAddress = c.ContactAddress != null
                    ? c.ContactAddress.ToDto()
                    : null,
                InvoicingClientId = c.InvoicingClient != null ? c.InvoicingClient.PublicId : null,
                InvoicingClientName = c.InvoicingClient != null ? c.InvoicingClient.Name : null,
                InvoicedClients = c.InvoicedClients
                    .Select(sub => new LinkedClientDto { Id = sub.PublicId, Name = sub.Name })
                    .ToList(),
```

- [ ] **Step 5: Extend the list DTO and query**

Append to `ClientListItemDto.cs`:

```csharp
    /// <summary>
    /// Public ID of the client that receives this one's invoices, when another client pays.
    /// </summary>
    public Guid? InvoicingClientId { get; set; }

    /// <inheritdoc cref="InvoicingClientId"/>
    public string? InvoicingClientName { get; set; }
```

In `GetClientListEndpoint.cs`, inside the `Select`:

```csharp
                Region = c.Region,
                InvoicingClientId = c.InvoicingClient != null ? c.InvoicingClient.PublicId : null,
                InvoicingClientName = c.InvoicingClient != null ? c.InvoicingClient.Name : null
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ClientInvoicing"`
Expected: PASS (Task 1, 2, 3 and 4 classes — 18 tests).

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: PASS, full suite.

- [ ] **Step 7: Regenerate the frontend API client**

Start the backend on port 8080 in one shell, from `api/AleTrack/`:

```bash
dotnet run --project AleTrack --launch-profile Local
```

Confirm nothing else holds the port and that the Swagger doc is this backend's — a stale service on 8080 silently produces a wrong client:

```bash
curl -s http://localhost:8080/swagger/v1/swagger.json | grep -c invoicingClientId
```

Expected: a non-zero count. Then, from `app/`:

```bash
yarn generate-api
```

- [ ] **Step 8: Verify the generated client carries the new fields**

Run from `app/`:

```bash
grep -n "invoicingClientId\|invoicingClientName\|invoicedClients" src/generated/api-client.ts | head -20
yarn typecheck
```

Expected: the grep finds the fields on `ClientDto` and `ClientListItemDto`; `yarn typecheck` passes (no frontend code reads the new fields yet, and `officialAddress` was already optional in the generated TS).

If `yarn typecheck` now fails because `officialAddress` became optional where the frontend assumed it, note the failing files and fix them in Task 12 — do not leave the repo un-typechecking; if the failures are in files Task 12 does not touch, fix them here with a `?.` and mention it in the commit body.

- [ ] **Step 9: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Clients api/AleTrack/AleTrack.Tests app/src/generated/api-client.ts
git commit -m "feat(api): expose a client's invoicing client on detail and list"
```

---

### Task 5: Backend address handling for a client without an official address

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Orders/Utils/OrderDeliveryAddressWriter.cs:30-33`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportQuery.cs` (`ResolveAddress`)
- Test: `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportQueryTests.cs`

**Interfaces:**
- Consumes: `Client.OfficialAddress` being nullable (Task 1).
- Produces:
  - `OrderDeliveryAddressWriter.ApplyAsync` throws 400 for `DeliveryAddressKind.Official` when the client has no official address. Signature unchanged.
  - `ShipmentExportQuery.ResolveAddress` falls through to the contact address when the official one is absent — the server-side twin of the frontend rule in Task 10.

- [ ] **Step 1: Write the failing test**

Append to `api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs` (match the file's existing `using`s and test style — read it first with `sed -n 1,40p`):

```csharp
    [Fact]
    public async Task ApplyAsync_OfficialKindForClientWithoutOfficialAddress_Throws400()
    {
        // Mirrors the guard already in place for a Contact kind the client cannot satisfy: the
        // frontend hides the option, but nothing stops a direct caller asking for it.
        var client = ClientBuilder.BuildEntity(name: "Pub A", noOfficialAddress: true);
        client.Id = 5;
        var order = new Order { Id = 1, PublicId = Guid.NewGuid(), ClientId = client.Id };
        var dbContext = AleTrackDbContextMockFactory.CreateMock(clients: [client], orders: [order]);

        var act = () => OrderDeliveryAddressWriter.ApplyAsync(
            dbContext.Object, order, client, DeliveryAddressKind.Official, placePublicId: null,
            CancellationToken.None);

        (await act.Should().ThrowAsync<AleTrackException>()).Which.StatusCode.Should().Be(400);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddressTests"`
Expected: FAIL — no exception thrown.

- [ ] **Step 3: Add the mirror guard**

In `OrderDeliveryAddressWriter.ApplyAsync`, beside the existing contact-address guard:

```csharp
        // The frontend merely hides the option; nothing stops a direct caller
        // from asking for a contact address the client does not have.
        if (kind == DeliveryAddressKind.Contact && client.ContactAddress is null)
            ThrowHelper.BadRequest($"Client {client.PublicId} has no contact address.");

        if (kind == DeliveryAddressKind.Official && client.OfficialAddress is null)
            ThrowHelper.BadRequest($"Client {client.PublicId} has no official address.");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OrderDeliveryAddress"`
Expected: PASS — the new test plus every existing one in the class.

- [ ] **Step 5: Write the failing test for the export's address fallback**

Read `ResolveAddress` and the test file's fixture helpers first:

```bash
sed -n 366,400p api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportQuery.cs
grep -n "Street\|CityLine" api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportQueryTests.cs | head
```

Add to `ShipmentExportQueryTests.cs`, built from that file's own fixtures:

```csharp
    [Fact]
    public async Task Build_StopWhoseClientHasOnlyAContactAddress_ExportsThatAddress()
    {
        // A client billed through its payer has no official address, and an Official-kind stop
        // would otherwise export a blank street and city — on the driver's own sheet.
        // Arrange a stop with SelectedAddressKind Official whose client has only a contact
        // address; act; assert the stop's Street and CityLine come from the contact address.
    }
```

Replace the comment with real arrange/act/assert code.

- [ ] **Step 6: Run it to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExportQueryTests"`
Expected: FAIL — `Street` and `CityLine` are null or blank.

- [ ] **Step 7: Reverse the fallback in the export query**

In `ShipmentExportQuery.ResolveAddress`, the tail currently prefers `OfficialAddress` and falls back to it for a Contact kind. Make the fallback work in both directions, keeping the existing remarks block and extending it:

```csharp
    /// <remarks>
    /// Same rule as <c>resolveDetailStopAddress</c> / <c>resolveFromAddresses</c> on the client:
    /// the chosen delivery place wins, and the two client addresses stand in for each other in
    /// either direction — a Contact kind falls back to Official as it always has, and an
    /// Official kind now falls through to Contact, because a client invoiced through a payer has
    /// no official address at all.
    /// </remarks>
```

and pick the address with the same either-direction expression the frontend uses:

```csharp
        var chosen = stop.SelectedAddressKind == DeliveryAddressKind.Contact
            ? stop.ContactAddress ?? stop.OfficialAddress
            : stop.OfficialAddress ?? stop.ContactAddress;

        return chosen is null ? (null, null, null) : SplitAddress(chosen);
```

Read the existing tail before replacing it — if `SplitAddress` already handles null, keep its own null handling rather than adding a second one.

- [ ] **Step 8: Run tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExport"`
Expected: PASS — the new test plus every existing export test.

- [ ] **Step 9: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Orders/Utils/OrderDeliveryAddressWriter.cs \
        api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportQuery.cs \
        api/AleTrack/AleTrack.Tests/Features/Orders/OrderDeliveryAddressTests.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportQueryTests.cs
git commit -m "fix(api): fall back between a client's two addresses in both directions"
```

---

### Task 6: Reconciler issues the default invoice to the payer

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentInvoiceReconciler.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentInvoiceGraph.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentInvoiceReconcilerTests.cs`

**Interfaces:**
- Consumes: `Client.InvoicingClientId`, `Client.InvoicingClient` (Task 1).
- Produces:
  - `BillableSource.PayingClientId` (`long`) and `BillableSource.PayingClient` (`Client?`), private to the reconciler.
  - `ShipmentInvoiceGraph.EligibleClientIds(shipment)` additionally includes the payer of every stop client.
  - The include chain loads `Order.Client.InvoicingClient`.
  - Behaviour: a fresh split opens one invoice per **paying** client; every line keeps `OrderingClientId`.

**Key subtlety:** `TrimRank` currently reads `invoice.ClientId != source.OrderingClientId` to mean "another client's invoice", which ranks it for trimming *before* the orderer's own. Under the redirect a sub-client's home invoice legitimately belongs to the payer, so that comparison must switch to `PayingClientId` or reconciliation will trim a sub-client's own pieces first.

- [ ] **Step 1: Write the failing tests**

Add to `ShipmentInvoiceReconcilerTests.cs`. First extend the existing `OrderStop` helper so a stop can carry a `Client` with a payer — add an optional parameter, leaving every current call site working:

```csharp
    private static OutgoingShipmentStop OrderStop(
        long clientId,
        int order,
        Client? client,
        params (long itemId, int qty)[] items)
    {
        var stop = OrderStop(clientId, order, items);
        stop.ClientOrder!.Client = client!;
        return stop;
    }

    /// <summary>A client billed through <paramref name="payer"/>.</summary>
    private static Client SubClient(long id, Client payer) =>
        new()
        {
            Id = id,
            PublicId = Guid.NewGuid(),
            Name = $"Sub {id}",
            InvoicingClientId = payer.Id,
            InvoicingClient = payer
        };

    private static Client Payer(long id) =>
        new() { Id = id, PublicId = Guid.NewGuid(), Name = $"Payer {id}" };
```

Then the new region of tests:

```csharp
    #region payer redirect

    [Fact]
    public void Reconcile_SubClientItems_OpenTheInvoiceForItsPayer()
    {
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, SubClient(ClientA, payer), (itemId: 1, qty: 10)));

        Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientC);
        InvoiceFor(shipment, ClientC).Lines.Should().OnlyContain(l => l.OrderingClientId == ClientA,
            "the pieces are still the sub-client's; only the bill moved");
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_TwoSubClientsOfOnePayer_ShareOneInvoice()
    {
        var payer = Payer(ClientC);
        var shipment = Shipment(
            OrderStop(ClientA, order: 1, SubClient(ClientA, payer), (itemId: 1, qty: 4)),
            OrderStop(ClientB, order: 2, SubClient(ClientB, payer), (itemId: 2, qty: 6)));

        Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientC);
        InvoiceFor(shipment, ClientC).Lines.Sum(l => l.Quantity).Should().Be(10);
        InvoiceFor(shipment, ClientC).Lines.Select(l => l.OrderingClientId)
            .Should().BeEquivalentTo(new[] { ClientA, ClientB });
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_PayerInvoiceGetsThePayerClientNavigation()
    {
        // The response is mapped from this same graph, so a payer invoice with only ClientId set
        // would surface as a blank client name on the first read.
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, SubClient(ClientA, payer), (itemId: 1, qty: 3)));

        Reconcile(shipment);

        InvoiceFor(shipment, ClientC).Client.Should().BeSameAs(payer);
    }

    [Fact]
    public void Reconcile_ExistingSubClientInvoice_IsLeftAlone()
    {
        // A run split before the relation existed must not have its invoices re-pointed
        // mid-flight: that would move money between clients without anyone asking.
        var payer = Payer(ClientC);
        var shipment = Shipment(OrderStop(ClientA, order: 1, (itemId: 1, qty: 5)));
        Reconcile(shipment);
        var existing = InvoiceFor(shipment, ClientA).PublicId;

        shipment.Stops.Single().ClientOrder!.Client = SubClient(ClientA, payer);
        var result = Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.PublicId.Should().Be(existing);
        InvoiceFor(shipment, ClientA).ClientId.Should().Be(ClientA);
        result.Adjustments.Should().BeEmpty();
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_SubClientQuantityDrops_TrimsItsOwnPayerInvoiceLast()
    {
        // TrimRank must rank the payer's invoice as the sub-client's *own* home, not as
        // "somebody else's" — otherwise a drop empties the line that should survive.
        var payer = Payer(ClientC);
        var sub = SubClient(ClientA, payer);
        var stop = OrderStop(ClientA, order: 1, sub, (itemId: 1, qty: 10));
        var shipment = Shipment(stop);
        Reconcile(shipment);

        stop.ClientOrder!.OrderItems.Single().Quantity = 4;
        Reconcile(shipment);

        InvoiceFor(shipment, ClientC).Lines.Single().Quantity.Should().Be(4);
        AssertBalanced(shipment);
    }

    [Fact]
    public void Reconcile_ClientWithoutPayer_IsUnchanged()
    {
        var shipment = Shipment(OrderStop(ClientA, order: 1, Payer(ClientA), (itemId: 1, qty: 7)));

        Reconcile(shipment);

        shipment.Invoices.Should().ContainSingle().Which.ClientId.Should().Be(ClientA);
        AssertBalanced(shipment);
    }

    #endregion
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentInvoiceReconcilerTests"`
Expected: the six new tests fail — invoices are opened for `ClientA`/`ClientB` rather than `ClientC`. The pre-existing tests in the class still pass.

- [ ] **Step 3: Add the paying client to `BillableSource`**

In `ShipmentInvoiceReconciler.cs`, inside `private sealed record BillableSource`, after `OrderingClientId`:

```csharp
        /// <summary>
        /// Client the invoice is issued to: the ordering client's payer when it has one,
        /// otherwise the ordering client itself.
        /// </summary>
        public required long PayingClientId { get; init; }

        /// <summary>
        /// The paying client entity when the graph had it loaded. Carried for the same reason
        /// as <see cref="OrderingClient"/>: a created invoice with a null navigation surfaces
        /// as a blank client name.
        /// </summary>
        public Client? PayingClient { get; init; }
```

- [ ] **Step 4: Fill it in `CollectSources`**

Add this helper next to `CollectSources` in the same file:

```csharp
    /// <summary>
    /// Who is billed for an ordering client's pieces. Falls back to the ordering client when the
    /// graph has no <c>Client</c> navigation loaded — the relation is unknowable then, and
    /// billing the orderer is what happened before the relation existed.
    /// </summary>
    private static (long Id, Client? Entity) PayerOf(long orderingClientId, Client? orderingClient) =>
        orderingClient?.InvoicingClientId is { } payerId
            ? (payerId, orderingClient.InvoicingClient)
            : (orderingClientId, orderingClient);
```

Then in each of the three `sources.Add(new BillableSource { ... })` blocks, resolve the payer just above the `Add` and pass it. For the order-item loop:

```csharp
            foreach (var item in stop.ClientOrder!.OrderItems)
            {
                var payer = PayerOf(stop.ClientOrder.ClientId, stop.ClientOrder.Client);
                sources.Add(new BillableSource
                {
                    Kind = InvoiceLineSourceKind.OrderItem,
                    ItemId = RequirePersisted(item.Id, nameof(OrderItem)),
                    OrderingClientId = stop.ClientOrder.ClientId,
                    OrderingClient = stop.ClientOrder.Client,
                    PayingClientId = payer.Id,
                    PayingClient = payer.Entity,
                    Quantity = item.Quantity,
                    Snapshot = SnapshotFor(shipment, stop, item)
                });
            }
```

For the supplier-goods loop, `var payer = PayerOf(order.ClientId, order.Client);` and add the same two properties. For the custom-extras loop, identically.

- [ ] **Step 5: Group and look up invoices by the payer**

Four edits in `Reconcile` and its helpers, all in `ShipmentInvoiceReconciler.cs`:

```csharp
        var billableClientIds = sources.Select(s => s.PayingClientId).Distinct().ToList();

        // 1. Every client who is billed gets an invoice to be billed on.
        foreach (var group in sources.GroupBy(s => s.PayingClientId))
        {
            if (shipment.Invoices.All(i => i.ClientId != group.Key))
                shipment.Invoices.Add(BuildInvoice(shipment, group.Key,
                    group.Select(s => s.PayingClient).FirstOrDefault(c => c is not null), sequence: 1));
        }
```

```csharp
    private static OutgoingShipmentInvoice HomeInvoiceFor(OutgoingShipment shipment, BillableSource source)
    {
        var home = shipment.Invoices
            .Where(i => i.ClientId == source.PayingClientId)
            .OrderBy(i => i.Sequence)
            .FirstOrDefault();

        if (home is not null)
            return home;

        home = BuildInvoice(shipment, source.PayingClientId, source.PayingClient,
            sequence: NextSequenceFor(shipment, source.PayingClientId));
        shipment.Invoices.Add(home);
        return home;
    }
```

```csharp
    /// <summary>
    /// Where a placement sits in the trim order: private pieces first, then invoices that are not
    /// the source's own home, then its home.
    /// </summary>
    /// <remarks>
    /// Compares against the <em>paying</em> client, not the ordering one. A sub-client's home
    /// invoice belongs to its payer, so an orderer comparison would rank that home as "somebody
    /// else's" and empty the very line that should survive a drop.
    /// </remarks>
    private static int TrimRank(OutgoingShipmentInvoice? invoice, BillableSource source) =>
        invoice is null ? 0
        : invoice.ClientId != source.PayingClientId ? 1
        : 2;
```

Leave step 3's "invoices with no reason left to exist" pass as it is: it already reads `billableClientIds`, which now holds payers.

- [ ] **Step 6: Run reconciler tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentInvoice"`
Expected: PASS — the six new tests plus every existing reconciler, ordering and endpoint test.

- [ ] **Step 7: Load the payer, and let it hold an invoice**

In `ShipmentInvoiceGraph.cs`, extend the include chain so the payer navigation is populated:

```csharp
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.Client)
                .ThenInclude(c => c.InvoicingClient)
```

and in `EligibleClientIds`, add the payers:

```csharp
    public static HashSet<long> EligibleClientIds(OutgoingShipment shipment)
    {
        var orders = shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .Select(s => s.ClientOrder!)
            .ToList();

        var ids = orders.Select(o => o.ClientId).ToHashSet();

        // A payer holds the invoices for its sub-clients' goods without necessarily having a
        // stop or an order of its own, so it must be a legal move target too.
        foreach (var payerId in orders.Select(o => o.Client?.InvoicingClientId).OfType<long>())
            ids.Add(payerId);

        // Extras need no pass of their own: each hangs off a stop's order, whose client
        // is already in the set above.

        foreach (var invoice in shipment.Invoices)
            ids.Add(invoice.ClientId);

        return ids;
    }
```

- [ ] **Step 8: Run the full backend suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: PASS, full suite.

- [ ] **Step 9: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentInvoiceReconciler.cs \
        api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentInvoiceGraph.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentInvoiceReconcilerTests.cs
git commit -m "feat(api): issue a sub-client's shipment invoice to its payer"
```

---

### Task 7: Export model and query — the grouped invoice part

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportModel.cs`
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportQuery.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportQueryTests.cs`

**Interfaces:**
- Consumes: the payer redirect (Task 6).
- Produces:
  - `ShipmentExportModel.Invoices` → `List<ShipmentExportInvoice>`
  - `ShipmentExportInvoice { string PayingClientName; int Sequence; List<ShipmentExportInvoiceParty> Parties; int TotalQuantity }`
  - `ShipmentExportInvoiceParty { string ClientName; bool IsPayer; List<ShipmentExportProduct> Products; int TotalQuantity }`
  - `ShipmentExportStop.InvoicedToClientName` → `string?`

- [ ] **Step 1: Write the failing test**

Read the existing test's fixture helpers first — they build a shipment graph and call the query:

```bash
sed -n 1,80p api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportQueryTests.cs
grep -n "private static\|Task<ShipmentExportModel>\|BuildAsync" api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportQueryTests.cs
```

Add tests in that file's own style, asserting these four behaviours (write them with the file's existing fixture builders rather than inventing new ones):

```csharp
    [Fact]
    public async Task Build_SubClientGoods_ReportOneInvoiceBlockForThePayer()
    {
        // One payer, two sub-clients: one block, two parties, the payer's own goods first.
        // Assert: model.Invoices has a single entry named for the payer, its Parties have the
        // two sub-client names, each party's TotalQuantity equals that sub-client's pieces, and
        // the block's TotalQuantity is their sum.
    }

    [Fact]
    public async Task Build_PayerWithNoStopOfItsOwn_StillAppearsInTheInvoicePart()
    {
        // The gap this closes: a cross-billed row is only appended to a client that has a stop,
        // so today a payer with no delivery appears nowhere in the export.
        // Assert: model.ClientStops contains no stop for the payer, and model.Invoices does
        // contain a block named for it.
    }

    [Fact]
    public async Task Build_SubClientStop_ReportsItsOwnPiecesAsInvoicedAndNamesThePayer()
    {
        // Assert: the sub-client's stop has InvoicedToClientName == the payer's name, and each
        // of its product rows has InvoicedQuantity equal to its delivered Quantity — not 0.
    }

    [Fact]
    public async Task Build_ClientWithoutPayer_KeepsTodaysInvoicedAttribution()
    {
        // The regression guard for manual line moves: a client with no payer must produce the
        // exact numbers it does today.
        // Assert: InvoicedToClientName is null and the per-row InvoicedQuantity values are
        // unchanged from the existing test for the same fixture.
    }
```

Replace each comment block with real arrange/act/assert code built from the fixture helpers you just read. Every assertion named in the comments must appear as an actual `Should()` call — a test whose body is only a comment is a plan failure, not a test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExportQueryTests"`
Expected: compile error — `ShipmentExportModel` has no `Invoices`, `ShipmentExportStop` has no `InvoicedToClientName`.

- [ ] **Step 3: Extend the export model**

In `ShipmentExportModel.cs`, add to `ShipmentExportModel` after `StockPurchases`:

```csharp
    /// <summary>
    /// Invoice split of the run, one block per paying client, each block broken down by the
    /// client whose goods are billed on it.
    /// </summary>
    /// <remarks>
    /// Additive: the stop entries are untouched, because what the driver reads did not change.
    /// This part exists for the office, and it is the only place a paying client with no
    /// delivery of its own appears at all.
    /// </remarks>
    public List<ShipmentExportInvoice> Invoices { get; init; } = [];
```

add to `ShipmentExportStop` after `DeliveryPlaceName`:

```csharp
    /// <summary>
    /// Name of the client this stop's goods are invoiced to, when that is not the stop's own
    /// client. Null in the ordinary case.
    /// </summary>
    public string? InvoicedToClientName { get; init; }
```

and append the two new records at the end of the file:

```csharp
/// <summary>
/// One paying client's invoice on the run, broken down by whose goods it bills.
/// </summary>
public sealed record ShipmentExportInvoice
{
    public required string PayingClientName { get; init; }

    /// <summary>Position among that client's invoices on this run, starting at 1.</summary>
    public int Sequence { get; init; }

    public List<ShipmentExportInvoiceParty> Parties { get; init; } = [];

    public int TotalQuantity => Parties.Sum(p => p.TotalQuantity);
}

/// <summary>
/// The goods of one client billed on an invoice.
/// </summary>
/// <remarks>
/// Rows carry their billed pieces in <see cref="ShipmentExportProduct.Quantity"/> and leave
/// <see cref="ShipmentExportProduct.InvoicedQuantity"/> null: inside an invoice block there is
/// only one number to report.
/// </remarks>
public sealed record ShipmentExportInvoiceParty
{
    public required string ClientName { get; init; }

    /// <summary>The paying client's own goods — listed first.</summary>
    public bool IsPayer { get; init; }

    public List<ShipmentExportProduct> Products { get; init; } = [];

    public int TotalQuantity => Products.Sum(p => p.Quantity);
}
```

- [ ] **Step 4: Widen what the invoice load returns**

In `ShipmentExportQuery.cs`, extend the private `InvoicedItem` record so a line's own attribution travels with it:

```csharp
    private sealed record InvoicedItem
    {
        public required string Name { get; init; }
        public ProductKind? Kind { get; init; }
        public double? PackageSize { get; init; }
        public required int Quantity { get; init; }
    }

    /// <summary>
    /// The reconciled split, in the two shapes the export reads it in: per (payer, item) for the
    /// stop tables, and grouped into invoice blocks for the Fakturace part.
    /// </summary>
    private sealed record InvoicedSplit
    {
        public required Dictionary<(long ClientId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem> ByPayer { get; init; }

        /// <summary>Billed pieces keyed by (payer, orderer, item) — what a party row reports.</summary>
        public required Dictionary<(long PayerId, long OrdererId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem> ByPayerAndOrderer { get; init; }

        /// <summary>Invoice identity per payer: its sequence and the payer's name.</summary>
        public required Dictionary<long, (int Sequence, string Name)> Payers { get; init; }

        /// <summary>Name of each client that ordered billed pieces.</summary>
        public required Dictionary<long, string> OrdererNames { get; init; }

        public static InvoicedSplit Empty => new()
        {
            ByPayer = [], ByPayerAndOrderer = [], Payers = [], OrdererNames = []
        };
    }
```

Rewrite `LoadInvoicedItemsAsync` to return it, keeping its existing remarks block verbatim:

```csharp
    private static async Task<InvoicedSplit> LoadInvoicedItemsAsync(
        AleTrackDbContext dbContext, Guid shipmentId, CancellationToken ct)
    {
        var split = await ShipmentInvoiceGraph.LoadReadOnlyAsync(dbContext, shipmentId, ct);
        if (split is null)
            return InvoicedSplit.Empty;

        ShipmentInvoiceReconciler.Reconcile(split);

        var lines = split.Shipment.Invoices
            .SelectMany(invoice => invoice.Lines.Select(line => (invoice, line)))
            .ToList();

        return new InvoicedSplit
        {
            ByPayer = lines
                .GroupBy(x => (
                    ClientId: x.invoice.ClientId,
                    x.line.SourceKind,
                    SourceItemId: ShipmentInvoiceGraph.SourceItemIdOf(x.line)))
                .ToDictionary(g => g.Key, ToInvoicedItem),
            ByPayerAndOrderer = lines
                .GroupBy(x => (
                    PayerId: x.invoice.ClientId,
                    OrdererId: x.line.OrderingClientId,
                    x.line.SourceKind,
                    SourceItemId: ShipmentInvoiceGraph.SourceItemIdOf(x.line)))
                .ToDictionary(g => g.Key, ToInvoicedItem),
            Payers = split.Shipment.Invoices
                .GroupBy(i => i.ClientId)
                .ToDictionary(
                    g => g.Key,
                    g => (g.Min(i => i.Sequence), g.Select(i => i.Client?.Name).FirstOrDefault() ?? Missing)),
            OrdererNames = lines
                .GroupBy(x => x.line.OrderingClientId)
                .ToDictionary(g => g.Key, g => OrdererNameOf(split.Shipment, g.Key))
        };
    }

    /// <summary>
    /// Facts off the line's own snapshot, like every displayed fact on an invoice: a product
    /// renamed after the split was made must not restate it.
    /// </summary>
    private static InvoicedItem ToInvoicedItem<TKey>(
        IGrouping<TKey, (OutgoingShipmentInvoice invoice, OutgoingShipmentInvoiceLine line)> group) =>
        new()
        {
            Name = group.Select(x => x.line.ProductName).First(),
            Kind = group.Select(x => x.line.Kind).First(),
            PackageSize = group.Select(x => x.line.PackageSize).First(),
            Quantity = group.Sum(x => x.line.Quantity)
        };

    private static string OrdererNameOf(OutgoingShipment shipment, long clientId) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null && s.ClientOrder.ClientId == clientId)
            .Select(s => s.ClientOrder!.Client?.Name)
            .FirstOrDefault(name => name is not null)
        ?? shipment.Invoices.FirstOrDefault(i => i.ClientId == clientId)?.Client?.Name
        ?? Missing;
```

Add `using static AleTrack.Features.OutgoingShipments.Queries.Export.ShipmentExportLabels;` to the file if it is not already there (`Missing` comes from it).

- [ ] **Step 5: Build the invoice blocks and thread the new stop field**

In the same file, add the block builder:

```csharp
    /// <summary>
    /// The run's invoice blocks, in route order of the paying client's first stop — a payer with
    /// no stop of its own sorts last.
    /// </summary>
    private static List<ShipmentExportInvoice> BuildInvoices(
        InvoicedSplit split,
        Dictionary<long, int> firstStopOrderByClient) =>
        split.ByPayerAndOrderer
            .GroupBy(entry => entry.Key.PayerId)
            .OrderBy(g => firstStopOrderByClient.TryGetValue(g.Key, out var stopOrder) ? stopOrder : int.MaxValue)
            .Select(payerGroup => BuildInvoice(split, payerGroup.Key, payerGroup))
            .ToList();

    private static ShipmentExportInvoice BuildInvoice(
        InvoicedSplit split,
        long payerId,
        IEnumerable<KeyValuePair<(long PayerId, long OrdererId, InvoiceLineSourceKind SourceKind, long SourceItemId), InvoicedItem>> lines)
    {
        var payer = split.Payers.TryGetValue(payerId, out var found) ? found : (Sequence: 1, Name: Missing);

        return new ShipmentExportInvoice
        {
            PayingClientName = payer.Name,
            Sequence = payer.Sequence,
            Parties = lines
                .GroupBy(entry => entry.Key.OrdererId)
                // The payer's own goods lead; the rest follow by name.
                .OrderByDescending(g => g.Key == payerId)
                .ThenBy(g => split.OrdererNames.GetValueOrDefault(g.Key, Missing), StringComparer.CurrentCulture)
                .Select(ordererGroup => new ShipmentExportInvoiceParty
                {
                    ClientName = split.OrdererNames.GetValueOrDefault(ordererGroup.Key, Missing),
                    IsPayer = ordererGroup.Key == payerId,
                    Products = ordererGroup
                        .Select(entry => new ShipmentExportProduct
                        {
                            Name = entry.Value.Name,
                            Kind = entry.Value.Kind,
                            PackageSize = entry.Value.PackageSize,
                            Quantity = entry.Value.Quantity
                        })
                        .OrderBy(p => p.Name, StringComparer.CurrentCulture)
                        .ToList()
                })
                .ToList()
        };
    }
```

`BuildInvoice` is a private method name the file may already use for something else — grep before adding, and prefix with `Export` if it collides.

Then update the call sites. Where `LoadInvoicedItemsAsync` is awaited (around line 163), keep the local name and pass `.ByPayer` into `ToStop`, and set the new model property:

```csharp
        var invoicedSplit = await LoadInvoicedItemsAsync(dbContext, shipmentId, ct);
```

In the model construction, add `Invoices = BuildInvoices(invoicedSplit, firstStopOrderByClient),` and change the stop projection to `.Select(stop => ToStop(stop, company, shipment.StockPurchases, invoicedSplit, deliveredKeysByClient, firstStopOrderByClient))`.

Change `ToStop` and `BuildProducts` to take `InvoicedSplit` instead of the bare dictionary, and give `ToStop` the payer name:

```csharp
            InvoicedToClientName = PayerNameFor(stop, split),
```

Add the two helpers that answer "does this stop's client have a payer, and what is billed for it":

```csharp
    /// <summary>
    /// Name of the client this stop's goods are billed to, or null when that is the stop's own
    /// client. Derived from the split rather than from the client row, so it agrees with the
    /// invoices actually built.
    /// </summary>
    private static string? PayerNameFor(RawStop stop, InvoicedSplit split)
    {
        if (stop.ClientId is null)
            return null;

        var payerId = split.ByPayerAndOrderer.Keys
            .Where(k => k.OrdererId == stop.ClientId.Value)
            .Select(k => (long?)k.PayerId)
            .FirstOrDefault();

        return payerId is null || payerId == stop.ClientId.Value
            ? null
            : split.Payers.TryGetValue(payerId.Value, out var payer) ? payer.Name : null;
    }
```

and in `BuildProducts`, replace the `InvoicedQuantity` expression so a sub-client's stop reads its own pieces off the payer's invoices:

```csharp
                // A client with no payer reads its own invoices, whatever their orderer — which
                // preserves the manual-move semantics this column has always had. A sub-client
                // reads the lines its own goods put on its payer's invoices instead, or the
                // column would be 0 for every row.
                InvoicedQuantity = stop.ClientId is null
                    ? null
                    : InvoicedQuantityFor(split, stop.ClientId.Value, product.SourceKind, product.SourceItemId)
```

```csharp
    private static int InvoicedQuantityFor(
        InvoicedSplit split, long stopClientId, InvoiceLineSourceKind sourceKind, long sourceItemId)
    {
        var byOrderer = split.ByPayerAndOrderer
            .Where(e => e.Key.OrdererId == stopClientId
                        && e.Key.PayerId != stopClientId
                        && e.Key.SourceKind == sourceKind
                        && e.Key.SourceItemId == sourceItemId)
            .Sum(e => e.Value.Quantity);

        if (byOrderer > 0)
            return byOrderer;

        return split.ByPayer.TryGetValue((stopClientId, sourceKind, sourceItemId), out var invoiced)
            ? invoiced.Quantity
            : 0;
    }
```

Keep the existing "cross-billed in" append in `BuildProducts` exactly as it is, reading `split.ByPayer`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExport"`
Expected: PASS — the four new tests plus every existing export query, workbook and document test.

- [ ] **Step 7: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportModel.cs \
        api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportQuery.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportQueryTests.cs
git commit -m "feat(api): group the shipment export's invoice split by paying client"
```

---

### Task 8: Excel — the Fakturace sheet

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportWorkbookBuilder.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportWorkbookBuilderTests.cs`

**Interfaces:**
- Consumes: `ShipmentExportModel.Invoices`, `ShipmentExportStop.InvoicedToClientName` (Task 7).
- Produces: `ShipmentExportWorkbookBuilder.InvoiceSheetName` = `"Fakturace"`. The sheet exists only when `model.Invoices` is non-empty.

- [ ] **Step 1: Probe the ClosedXML grouping API before writing the test**

Row grouping is the one thing in this task that may not survive a round-trip. Find out now, from `api/AleTrack/`:

```bash
grep -rn "Group\b" ~/.nuget/packages/closedxml/0.105.1/lib/*/ClosedXML.xml | head -20
```

If that yields nothing usable, write a five-line throwaway xUnit fact in the test file that groups two rows, saves to a `MemoryStream`, reloads with `new XLWorkbook(stream)` and asserts `sheet.Row(n).OutlineLevel` and `sheet.Row(n).IsHidden`. Run it, note the result, and delete it.

Record the outcome here before continuing: **grouping works / grouping does not round-trip**. If it does not, drop `.Collapse()` and the collapsed assertion from the steps below, keep the subtotal rows, and add a line to the spec's Exports section saying the sheet opens expanded.

- [ ] **Step 2: Write the failing test**

Read the existing test file's helpers, then add tests in its style:

```bash
grep -n "private static\|XLWorkbook\|Worksheet" api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportWorkbookBuilderTests.cs | head -30
```

Assert these behaviours with real code built from those helpers:

```csharp
    [Fact]
    public void Build_ModelWithInvoices_AddsTheFakturaceSheet()
    {
        // Arrange a model with one payer and two parties; build; reload the bytes with
        // new XLWorkbook(stream).
        // Assert: the workbook has a worksheet named "Fakturace"; it contains the payer's name
        // in a heading row, both party names, each party's subtotal, and the payer total.
    }

    [Fact]
    public void Build_ModelWithoutInvoices_OmitsTheFakturaceSheet()
    {
        // Assert: Worksheets contains no "Fakturace" — an empty sheet reads as data that failed
        // to load.
    }

    [Fact]
    public void Build_PartyRows_AreGroupedAndCollapsed()
    {
        // Only if Step 1 said grouping round-trips.
        // Assert: the product rows of a party have OutlineLevel 1 and IsHidden true, while the
        // party's own heading row has OutlineLevel 0.
    }

    [Fact]
    public void Build_SubClientStopSheet_NamesThePayer()
    {
        // Assert: the sub-client's stop sheet contains a "Fakturováno na" label cell and the
        // payer's name beside it.
    }
```

Replace each comment with actual arrange/act/assert code. A test body that is only a comment is a plan failure.

- [ ] **Step 3: Run tests to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExportWorkbookBuilderTests"`
Expected: FAIL — no `Fakturace` worksheet.

- [ ] **Step 4: Put the new Czech strings in the shared labels file**

Both writers use them, and `ShipmentExportLabels` exists so the two cannot drift into calling the same thing by two names. Add to `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportLabels.cs`:

```csharp
    /// <summary>Heading of the invoice part, in both writers.</summary>
    public const string Invoicing = "Fakturace";

    /// <summary>Label naming the client a stop's goods are billed to.</summary>
    public const string InvoicedTo = "Fakturováno na";
```

Use `Invoicing` and `InvoicedTo` in place of the literals everywhere in this task and in Task 9. Both files already have `using static … ShipmentExportLabels;`, so they are in scope unqualified.

- [ ] **Step 5: Write the sheet**

In `ShipmentExportWorkbookBuilder.cs`, add the constant beside `OverviewSheetName`:

```csharp
    /// <summary>Name of the sheet carrying the run's invoice split.</summary>
    public const string InvoiceSheetName = Invoicing;
```

register it as taken and write it in `Build`, after the overview and before the stop sheets:

```csharp
        var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { OverviewSheetName, InvoiceSheetName };

        WriteInvoiceSheet(workbook, model);

        foreach (var stop in model.SheetStops)
            WriteStopSheet(workbook, stop, usedNames);
```

and add the writer:

```csharp
    /// <summary>
    /// The run's invoice split: a heading per paying client, then its parties' goods with a
    /// subtotal each and the payer's total.
    /// </summary>
    /// <remarks>
    /// The parties' product rows are grouped so the sheet opens showing one line per client and
    /// expands in place — the office reads the totals first and the detail only when a number
    /// looks wrong.
    ///
    /// Omitted entirely for a run whose split is empty: an empty sheet reads as data that failed
    /// to load rather than as "nothing to bill".
    /// </remarks>
    private static void WriteInvoiceSheet(XLWorkbook workbook, ShipmentExportModel model)
    {
        if (model.Invoices.Count == 0)
            return;

        var sheet = workbook.Worksheets.Add(InvoiceSheetName);
        var row = 1;

        foreach (var invoice in model.Invoices)
        {
            sheet.Cell(row, 1).Value = invoice.PayingClientName;
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Fill.BackgroundColor = XLColor.FromHtml($"#{HeaderFill}");
            row++;

            foreach (var party in invoice.Parties)
            {
                sheet.Cell(row, 1).Value = party.ClientName;
                sheet.Cell(row, 1).Style.Font.Italic = true;
                sheet.Cell(row, 4).Value = party.TotalQuantity;
                sheet.Cell(row, 4).Style.NumberFormat.Format = QuantityFormat;
                sheet.Cell(row, 4).Style.Font.Bold = true;
                row++;

                var first = row;
                WriteProductTable(sheet, ref row, party.Products, withTotal: false);

                if (row > first)
                    sheet.Rows(first, row - 1).Group(collapse: true);
            }

            sheet.Cell(row, 1).Value = "Celkem";
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 1).Style.Border.TopBorder = XLBorderStyleValues.Thin;
            WriteTotalCell(sheet, row, 4, invoice.TotalQuantity);
            row += 2;
        }

        sheet.Columns().AdjustToContents();
    }
```

If `HeaderFill` does not exist in this file (it is declared in the document builder), use whatever fill the workbook's own `WriteTableHeader` applies — read it first and reuse that, rather than introducing a second grey.

If Step 1 found no round-tripping `Group`, drop the `sheet.Rows(...).Group(...)` line and its `first` local.

- [ ] **Step 6: Name the payer on a sub-client's stop sheet**

Find where `WriteStopSheet` writes the address labels and add the row beside them:

```bash
grep -n "PSČ a město\|Místo dodání" api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportWorkbookBuilder.cs
```

Add, immediately after the delivery-place label row and in the same idiom that file already uses for a label/value pair:

```csharp
        if (stop.InvoicedToClientName is not null)
            WriteLabel(sheet, ref row, InvoicedTo, stop.InvoicedToClientName);
```

Use the actual helper name found by the grep — do not invent `WriteLabel` if the file calls it something else.

- [ ] **Step 7: Run tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExportWorkbookBuilderTests"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportLabels.cs \
        api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportWorkbookBuilder.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportWorkbookBuilderTests.cs
git commit -m "feat(api): add the grouped Fakturace sheet to the Excel export"
```

---

### Task 9: Word — the Fakturace section

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportDocumentBuilder.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportDocumentBuilderTests.cs`

**Interfaces:**
- Consumes: `ShipmentExportModel.Invoices`, `ShipmentExportStop.InvoicedToClientName` (Task 7).
- Produces: no new public members — the section is written inside `Build`.

- [ ] **Step 1: Write the failing test**

Read the existing test file's helpers first — it already knows how to open the produced bytes and walk the body:

```bash
grep -n "private static\|WordprocessingDocument\|Descendants" api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportDocumentBuilderTests.cs | head -30
```

Add these tests in that style, with real assertions:

```csharp
    [Fact]
    public void Build_ModelWithInvoices_WritesAFakturaceSectionPerPayer()
    {
        // Assert: the document text contains "Fakturace", the payer's name as a heading, each
        // party name, each party subtotal and the payer total.
    }

    [Fact]
    public void Build_ModelWithoutInvoices_WritesNoFakturaceSection()
    {
        // Assert: the document text does not contain "Fakturace".
    }

    [Fact]
    public void Build_FakturaceTables_AreNeverAdjacent()
    {
        // The load-bearing rule this file documents: Word merges two tables that touch. Assert
        // no two Table elements are direct siblings anywhere in the body.
    }

    [Fact]
    public void Build_SubClientStopPage_NamesThePayer()
    {
        // Assert: the stop's page contains a "Fakturováno na" label row with the payer's name.
    }
```

Replace each comment with actual code.

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExportDocumentBuilderTests"`
Expected: FAIL — no "Fakturace" text in the document.

- [ ] **Step 3: Write the section**

In `ShipmentExportDocumentBuilder.cs`, call it from `Build` after the stop pages and before the section properties:

```csharp
            foreach (var stop in model.SheetStops)
                WriteStopPage(body, stop);

            WriteInvoicePages(body, model);
```

and add:

```csharp
    /// <summary>
    /// The run's invoice split, one page per paying client: its parties' goods as a table each,
    /// with a subtotal, and the payer's total under them.
    /// </summary>
    /// <remarks>
    /// A document cannot collapse, so the subtotals carry the structure the workbook's row
    /// grouping does. Each payer starts a fresh page for the same reason a stop does: this is
    /// handed over per client.
    /// </remarks>
    private static void WriteInvoicePages(Body body, ShipmentExportModel model)
    {
        if (model.Invoices.Count == 0)
            return;

        foreach (var invoice in model.Invoices)
        {
            body.AppendChild(PageBreak());
            body.AppendChild(Heading($"{Invoicing}: {invoice.PayingClientName}"));

            foreach (var party in invoice.Parties)
            {
                body.AppendChild(SectionHeading(party.IsPayer
                    ? $"{party.ClientName} · vlastní zboží"
                    : party.ClientName));

                WriteProductTable(body, party.Products);

                // A paragraph rather than a row on the table above: two tables in a row are
                // merged by Word, and the next party's table follows immediately.
                body.AppendChild(Paragraph($"Celkem {party.ClientName}: {Pieces(party.TotalQuantity)}"));
            }

            body.AppendChild(Paragraph($"Celkem faktura: {Pieces(invoice.TotalQuantity)}"));
        }
    }
```

Check `Paragraph`'s real signature before using it — it is called as `Paragraph("…", italic: true)` elsewhere, so a bold overload may not exist:

```bash
grep -n "private static Paragraph Paragraph\|private static Paragraph SectionHeading\|private static Paragraph Heading" api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportDocumentBuilder.cs
```

- [ ] **Step 4: Name the payer on a sub-client's page**

In `WriteStopPage`, after the delivery-place row:

```csharp
        if (stop.InvoicedToClientName is not null)
            details.AppendChild(LabelRow(InvoicedTo, stop.InvoicedToClientName));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentExportDocumentBuilderTests"`
Expected: PASS.

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: PASS, full backend suite.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Export/ShipmentExportDocumentBuilder.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentExportDocumentBuilderTests.cs
git commit -m "feat(api): add the Fakturace section to the Word export"
```

---

### Task 10: Frontend addresses — fallback, default kind, warning

**Files:**
- Modify: `app/src/features/clients/deliveryAddress.ts:23-34`
- Modify: `app/src/features/shipments/UnloadOrderList.tsx`
- Modify: `app/src/features/shipments/unloadOrder.ts`
- Modify: `app/src/features/shipments/ShipmentEditor.tsx` (stop row)
- Modify: the order editor's delivery-address picker (find it in Step 8)
- Test: `app/src/features/clients/deliveryAddress.test.ts`
- Test: `app/src/features/shipments/unloadOrder.test.ts`
- Test: `app/src/features/shipments/ShipmentDetail.test.tsx`
- Test: `app/src/features/shipments/ShipmentEditor.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (the generated client already types `officialAddress` as optional).
- Produces:
  - `resolveFromAddresses` falls through to the contact address when the official one is absent.
  - `UnloadStop.addressMissing: boolean` — true when the stop resolves to no address at all.
  - `defaultAddressKind(official, contact, places)` in `app/src/features/clients/deliveryAddress.ts` → `{ addressKind: DeliveryAddressKind; deliveryPlaceId?: string }`

- [ ] **Step 1: Write the failing tests**

Append to `app/src/features/clients/deliveryAddress.test.ts`:

```ts
  it('falls through to the contact address when there is no official one', () => {
    // A sub-client billed through its payer has no official address, and an Official kind
    // would otherwise render a blank line.
    const contact = { streetName: 'Dlouhá', streetNumber: '14', city: 'Brno', zip: '60200', latitude: 49.2, longitude: 16.6 };

    const r = resolveFromAddresses(DeliveryAddressKind.Official, undefined, contact);

    expect(r.addressText).toContain('Dlouhá');
    expect(r.lat).toBe(49.2);
  });

  it('returns an empty address text when the client has neither address', () => {
    const r = resolveFromAddresses(DeliveryAddressKind.Official, undefined, undefined);

    expect(r.addressText.trim()).toBe('');
    expect(r.lat).toBeUndefined();
  });
```

Append to `app/src/features/shipments/unloadOrder.test.ts` (match the file's existing fixture builders — read the top of the file first):

```ts
  it('flags a stop whose client has no address at all', () => {
    // Nothing blocks saving such a client, so the shipment is where it has to be visible.
    const stops = unloadOrder([stopWithNoAddress()]);

    expect(stops[0].addressMissing).toBe(true);
    expect(stops[0].subtitle ?? '').toBe('');
  });

  it('does not flag a stop that resolves an address', () => {
    const stops = unloadOrder([stopWithOfficialAddress()]);

    expect(stops[0].addressMissing).toBe(false);
  });
```

Append to `app/src/features/shipments/ShipmentDetail.test.tsx`, in the vykládka describe block:

```tsx
  it('warns on a vykládka stop whose client has no address', async () => {
    // Render the detail with a stop whose client has neither address, switch to the Vykládka
    // tab, and assert the warning is shown.
    expect(await screen.findByLabelText('Klient nemá vyplněnou dodací adresu')).toBeInTheDocument();
  });
```

Fill in the arrange half of that last test from the file's existing vykládka test — copy its setup and null out the stop's `officialAddress` and `contactAddress`.

- [ ] **Step 2: Run tests to verify they fail**

Run from `app/`:

```bash
yarn test:run src/features/clients/deliveryAddress.test.ts src/features/shipments/unloadOrder.test.ts
```

Expected: FAIL — the Official kind with no official address returns a blank text, and `addressMissing` is undefined.

- [ ] **Step 3: Reverse the fallback**

In `app/src/features/clients/deliveryAddress.ts`, replace `resolveFromAddresses`'s body, keeping its doc comment and extending it:

```ts
export function resolveFromAddresses(
  kind: DeliveryAddressKind,
  official: AddressDto | undefined,
  contact: AddressDto | undefined,
): { lat?: number; lng?: number; text: string; addressText: string } {
  // Either direction: Contact falls back to Official as it always has, and Official now falls
  // through to Contact — a client billed through its payer has no official address, and the
  // fallback is what keeps its stop from rendering a blank line.
  const chosen = kind === DeliveryAddressKind.Contact ? contact ?? official : official ?? contact;
  const isContact = chosen !== undefined && chosen === contact;
  const addressText = formatStreetAddress(chosen);

  return {
    lat: chosen?.latitude,
    lng: chosen?.longitude,
    text: `${addressText} · ${addrKindLabel(isContact ? DeliveryAddressKind.Contact : DeliveryAddressKind.Official)}`,
    addressText,
  };
}
```

Check `formatStreetAddress(undefined)` returns an empty-ish string rather than throwing:

```bash
grep -n "export function formatStreetAddress" -A 12 app/src/features/clients/deliveryPlaceFormat.ts
```

If it renders a dash or placeholder for `undefined`, have `resolveFromAddresses` return `addressText: ''` when `chosen` is undefined, so the caller can tell "no address" from "an address that formats oddly".

- [ ] **Step 4: Carry the flag on the unload stop**

In `app/src/features/shipments/unloadOrder.ts`, add to `UnloadStop` after `subtitle`:

```ts
  /** True when the stop's client has no resolvable address — nothing blocks saving such a
   *  client, so the shipment is where it has to be visible. */
  addressMissing: boolean;
```

and where the stop is built (around line 157):

```ts
    subtitle: resolveDetailStopAddress(stop).addressText,
    addressMissing: resolveDetailStopAddress(stop).addressText.trim().length === 0,
```

Resolve once rather than twice — hoist it:

```ts
    const resolved = resolveDetailStopAddress(stop);
```

and read `resolved.addressText` in both places, following whatever local style the surrounding `map` uses.

- [ ] **Step 5: Show the warning**

In `app/src/features/shipments/UnloadOrderList.tsx`, add the icon import beside the others:

```tsx
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
```

and in `UnloadStopBlock`, replace the subtitle line:

```tsx
          {stop.subtitle && (
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} noWrap>{stop.subtitle}</Typography>
          )}
          {stop.addressMissing && (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <WarningAmberOutlinedIcon
                aria-label="Klient nemá vyplněnou dodací adresu"
                sx={{ fontSize: 13, color: 'warning.main' }}
              />
              <Typography sx={{ fontSize: 11.5, color: 'warning.main' }}>
                Klient nemá vyplněnou dodací adresu
              </Typography>
            </Stack>
          )}
```

- [ ] **Step 6: Run tests to verify they pass**

Run from `app/`:

```bash
yarn test:run src/features/clients/deliveryAddress.test.ts src/features/shipments/unloadOrder.test.ts src/features/shipments/ShipmentDetail.test.tsx
```

Expected: PASS. If `stopAddress.test.ts` or `ShipmentEditor.test.tsx` now fail on the changed fallback, read the failing assertion: a test that asserted "Official with no official address renders blank" is asserting the old bug and should be updated; a test asserting the `· Kontaktní` / `· Fakturační` tail must keep passing, so fix the code if the tail is now wrong.

- [ ] **Step 7: Warn on the shipment editor's stop row too**

The editor is the screen where the address can still be fixed, so it carries the same warning. Find its stop row's address line:

```bash
grep -n "resolveStopAddress\|stopAddressText\|\.text}" app/src/features/shipments/ShipmentEditor.tsx | head
```

Write the failing test first, in `ShipmentEditor.test.tsx` and in that file's own idiom — render the editor with a stop whose client has neither address, and assert `screen.getByLabelText('Klient nemá vyplněnou dodací adresu')` is present. Run it, watch it fail, then render the same warning icon beside the row's address line, guarded on the resolved `addressText` being empty:

```tsx
{resolved.addressText.trim().length === 0 && (
  <WarningAmberOutlinedIcon
    aria-label="Klient nemá vyplněnou dodací adresu"
    sx={{ fontSize: 13, color: 'warning.main' }}
  />
)}
```

Run: `yarn test:run src/features/shipments/ShipmentEditor.test.tsx`
Expected: PASS.

- [ ] **Step 8: Default an order's address kind to one the client actually has**

The picker currently defaults to `Official`. A client billed through a payer has no official address, so the default must be the first kind that resolves.

Find the order editor and its default:

```bash
grep -rn "DeliveryAddressKind.Official" app/src/features --include=*.tsx | grep -v test
```

Write the failing unit test first, in `app/src/features/clients/deliveryAddress.test.ts`:

```ts
describe('defaultAddressKind', () => {
  it('prefers the official address when the client has one', () => {
    const r = defaultAddressKind(address(), address(), []);

    expect(r.addressKind).toBe(DeliveryAddressKind.Official);
    expect(r.deliveryPlaceId).toBeUndefined();
  });

  it('falls back to the contact address when there is no official one', () => {
    const r = defaultAddressKind(undefined, address(), []);

    expect(r.addressKind).toBe(DeliveryAddressKind.Contact);
  });

  it('falls back to the first delivery place when the client has neither address', () => {
    const r = defaultAddressKind(undefined, undefined, [{ id: 'place-1' } as ClientDeliveryPlaceDto]);

    expect(r.addressKind).toBe(DeliveryAddressKind.DeliveryPlace);
    expect(r.deliveryPlaceId).toBe('place-1');
  });

  it('falls back to Official when the client has nothing at all', () => {
    // The warning on the shipment is what tells the user; the picker still needs a value.
    const r = defaultAddressKind(undefined, undefined, []);

    expect(r.addressKind).toBe(DeliveryAddressKind.Official);
  });
});
```

`address()` is a small local fixture returning an `AddressDto`-shaped object — copy the one the file already uses.

Run: `yarn test:run src/features/clients/deliveryAddress.test.ts`
Expected: FAIL — `defaultAddressKind` is not exported.

Then add it to `app/src/features/clients/deliveryAddress.ts`:

```ts
/** The delivery address a new order defaults to: the first kind the client can actually
 *  satisfy. A client invoiced through a payer has no official address, and defaulting to it
 *  produced an order whose stop rendered a blank destination.
 *
 *  Falls back to `Official` for a client with nothing at all — the picker needs a value, and
 *  the shipment's own warning is what tells the user to fix the client. */
export function defaultAddressKind(
  official: AddressDto | undefined,
  contact: AddressDto | undefined,
  places: ClientDeliveryPlaceDto[],
): { addressKind: DeliveryAddressKind; deliveryPlaceId?: string } {
  if (official) return { addressKind: DeliveryAddressKind.Official };
  if (contact) return { addressKind: DeliveryAddressKind.Contact };
  if (places.length > 0) {
    return { addressKind: DeliveryAddressKind.DeliveryPlace, deliveryPlaceId: places[0].id };
  }
  return { addressKind: DeliveryAddressKind.Official };
}
```

Run: `yarn test:run src/features/clients/deliveryAddress.test.ts`
Expected: PASS.

- [ ] **Step 9: Use the default, and hide the option the client cannot satisfy**

In the order editor found in Step 8, replace the hardcoded `DeliveryAddressKind.Official` default with a `defaultAddressKind(...)` call fed by the selected client's addresses and places. The picker already hides `Contact` for a client with no contact address — find that guard and add the mirror for `Official`:

```bash
grep -n "contactAddress" app/src/features/orders/*.tsx | head
```

Add a test in the order editor's own test file asserting the `Fakturační` option is absent for a client with no official address, in that file's idiom.

Run: `yarn test:run src/features/orders`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/src/features/clients/deliveryAddress.ts app/src/features/clients/deliveryAddress.test.ts \
        app/src/features/shipments/unloadOrder.ts app/src/features/shipments/unloadOrder.test.ts \
        app/src/features/shipments/UnloadOrderList.tsx app/src/features/shipments/ShipmentDetail.test.tsx \
        app/src/features/shipments/ShipmentEditor.tsx app/src/features/shipments/ShipmentEditor.test.tsx \
        app/src/features/orders
git commit -m "feat(app): default an order to an address the client has, and warn where there is none"
```

---

### Task 11: Frontend invoice table — collapsible parties

**Files:**
- Modify: `app/src/features/shipments/shipmentInvoiceModel.ts`
- Modify: `app/src/features/shipments/ShipmentInvoicing.tsx:567-615`
- Test: `app/src/features/shipments/shipmentInvoiceModel.test.ts`
- Test: `app/src/features/shipments/ShipmentInvoicing.test.tsx`

**Interfaces:**
- Consumes: `ShipmentInvoiceLineDto.orderingClientId` / `orderingClientName` (already on the DTO), and the payer redirect making them differ (Task 6).
- Produces:
  - `InvoiceParty { clientId: string; clientName: string; isPayer: boolean; quantity: number; value: number; groups: LineGroup[] }`
  - `invoiceParties(invoice: ShipmentInvoiceDto): InvoiceParty[]`

- [ ] **Step 1: Write the failing tests**

Append to `app/src/features/shipments/shipmentInvoiceModel.test.ts` (reuse the file's existing line/invoice fixtures — read them first):

```ts
describe('invoiceParties', () => {
  it('returns a single party for an ordinary invoice', () => {
    const invoice = invoiceOf('head', [line({ orderingClientId: 'head', quantity: 4 })]);

    const parties = invoiceParties(invoice);

    expect(parties).toHaveLength(1);
    expect(parties[0].isPayer).toBe(true);
    expect(parties[0].quantity).toBe(4);
  });

  it('splits an invoice by ordering client, payer first', () => {
    const invoice = invoiceOf('head', [
      line({ orderingClientId: 'pubB', orderingClientName: 'Pub B', quantity: 2 }),
      line({ orderingClientId: 'head', orderingClientName: 'Head', quantity: 5 }),
      line({ orderingClientId: 'pubA', orderingClientName: 'Pub A', quantity: 3 }),
    ]);

    const parties = invoiceParties(invoice);

    expect(parties.map((p) => p.clientName)).toEqual(['Head', 'Pub A', 'Pub B']);
    expect(parties[0].isPayer).toBe(true);
    expect(parties.slice(1).every((p) => !p.isPayer)).toBe(true);
  });

  it('merges a party rows by product and sums its value', () => {
    const invoice = invoiceOf('head', [
      line({ orderingClientId: 'pubA', productId: 'p1', quantity: 2, priceWithVat: 10 }),
      line({ orderingClientId: 'pubA', productId: 'p1', quantity: 3, priceWithVat: 10 }),
    ]);

    const [party] = invoiceParties(invoice);

    expect(party.groups).toHaveLength(1);
    expect(party.groups[0].quantity).toBe(5);
    expect(party.quantity).toBe(5);
    expect(party.value).toBe(50);
  });
});
```

Append to `app/src/features/shipments/ShipmentInvoicing.test.tsx`:

```tsx
  it('shows a payer invoice as collapsed party rows and expands one on click', async () => {
    // Render with an invoice whose lines come from two sub-clients.
    // Assert: both sub-client names are visible, no product row is; clicking a party name
    // reveals that party's product rows only.
  });

  it('counts the linked clients on the band header', async () => {
    expect(await screen.findByText('2 propojených klientů')).toBeInTheDocument();
  });
```

Fill in the arrange/act halves from the file's existing band tests.

- [ ] **Step 2: Run tests to verify they fail**

Run from `app/`:

```bash
yarn test:run src/features/shipments/shipmentInvoiceModel.test.ts
```

Expected: FAIL — `invoiceParties` is not exported.

- [ ] **Step 3: Add the model function**

In `app/src/features/shipments/shipmentInvoiceModel.ts`, after `groupLineList`:

```ts
/** A client whose goods are billed on one invoice, and the rows that bill them. */
export interface InvoiceParty {
  clientId: string;
  clientName: string;
  /** True for the paying client's own lines, which sort first. */
  isPayer: boolean;
  quantity: number;
  value: number;
  groups: LineGroup[];
}

const PARTY_COLLATOR = new Intl.Collator('cs');

/**
 * Split one invoice by who ordered its pieces: the payer's own goods first, then the clients
 * billed through it, by name.
 *
 * Returns a single party for an ordinary invoice, so nothing changes for a client that pays
 * for its own goods — the UI only renders party rows once there is more than one.
 */
export function invoiceParties(invoice: ShipmentInvoiceDto): InvoiceParty[] {
  const map = new Map<string, ShipmentInvoiceLineDto[]>();
  for (const line of invoice.lines ?? []) {
    const key = line.orderingClientId ?? '';
    const lines = map.get(key);
    if (lines) lines.push(line);
    else map.set(key, [line]);
  }

  const payerId = invoice.clientId ?? '';

  return [...map.entries()]
    .map(([clientId, lines]) => ({
      clientId,
      clientName: lines[0].orderingClientName ?? '—',
      isPayer: clientId === payerId,
      quantity: lines.reduce((s, l) => s + (l.quantity ?? 0), 0),
      value: lines.reduce((s, l) => s + (l.priceWithVat ?? 0) * (l.quantity ?? 0), 0),
      groups: groupLineList(lines),
    }))
    .sort((a, b) => {
      if (a.isPayer !== b.isPayer) return a.isPayer ? -1 : 1;
      return PARTY_COLLATOR.compare(a.clientName, b.clientName);
    });
}
```

- [ ] **Step 4: Run the model tests to verify they pass**

Run: `yarn test:run src/features/shipments/shipmentInvoiceModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the parties**

In `app/src/features/shipments/ShipmentInvoicing.tsx`, import `invoiceParties` alongside the other model imports, then replace the `for (const group of groups)` loop inside the `band.invoices.flatMap` callback. Keep the invoice heading row and the empty-invoice row exactly as they are; change only how the product rows are produced:

```tsx
                            const parties = invoiceParties(invoice);
                            // One party is an ordinary invoice — render its rows directly, as
                            // before. Party headers appear only where there is something to
                            // separate.
                            if (parties.length <= 1) {
                              for (const group of groups) {
                                rows.push(
                                  <GroupRow
                                    key={`${invoice.id}-${group.productKey}`}
                                    invoice={invoice}
                                    group={group}
                                    editable={canEdit}
                                    onMove={() => setMoveTarget({ invoice, group })}
                                  />,
                                );
                              }
                              return rows;
                            }

                            for (const party of parties) {
                              const partyKey = `${invoice.id}:${party.clientId}`;
                              const open = !collapsed.has(partyKey);
                              rows.push(
                                <TableRow
                                  key={`${partyKey}-head`}
                                  hover
                                  onClick={() => toggleBand(partyKey)}
                                  sx={{ cursor: 'pointer', bgcolor: (t) => t.vars!.palette.brand.surface2 }}
                                >
                                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                      <ExpandMoreIcon
                                        sx={{
                                          fontSize: 15,
                                          transform: open ? 'rotate(180deg)' : 'none',
                                        }}
                                      />
                                      <span>{party.clientName}</span>
                                    </Stack>
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                    {num(party.quantity)} ks
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                                    {formatMoney(party.value)}
                                  </TableCell>
                                  <TableCell />
                                </TableRow>,
                              );

                              if (!open) continue;

                              for (const group of party.groups) {
                                rows.push(
                                  <GroupRow
                                    key={`${partyKey}-${group.productKey}`}
                                    invoice={invoice}
                                    group={group}
                                    editable={canEdit}
                                    onMove={() => setMoveTarget({ invoice, group })}
                                  />,
                                );
                              }
                            }
                            return rows;
```

Parties start collapsed, so seed them into `collapsed` when the data arrives. `ShipmentInvoicing.tsx` imports `useState` and `useMemo` but not `useEffect` — add it to that import first. Then, beside the existing state:

```tsx
  // Parties open closed: the payer's band is read as one line per client first, and the
  // product detail only when a number looks wrong.
  useEffect(() => {
    const partyKeys = (data.invoices ?? []).flatMap((invoice) => {
      const parties = invoiceParties(invoice);
      return parties.length > 1 ? parties.map((p) => `${invoice.id}:${p.clientId}`) : [];
    });
    if (partyKeys.length === 0) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const key of partyKeys) if (!prev.has(key)) next.add(key);
      return next;
    });
  }, [data.invoices]);
```

This makes a newly-arrived party collapsed without re-closing one the user opened, because a key already in `prev` is left alone. Note the caveat in the commit body: a party the user opens and that then leaves and re-enters the response comes back collapsed.

Finally, add the chip to the band header. Find the band header's existing pills:

```bash
grep -n "crossBilled\|Pill tint" app/src/features/shipments/ShipmentInvoicing.tsx | head -20
```

and add beside them, computing the count from the band's invoices:

```tsx
                  {linkedClientCount(band) > 0 && (
                    <Pill tint="greyTint" color="text.secondary">
                      {linkedClientCount(band)} propojených klientů
                    </Pill>
                  )}
```

with the helper in `shipmentInvoiceModel.ts`:

```ts
/** How many other clients' goods this band's invoices bill for. */
export function linkedClientCount(band: ClientBand): number {
  const ids = new Set<string>();
  for (const invoice of band.invoices) {
    for (const line of invoice.lines ?? []) {
      if (line.orderingClientId && line.orderingClientId !== invoice.clientId) {
        ids.add(line.orderingClientId);
      }
    }
  }
  return ids.size;
}
```

Add a unit test for `linkedClientCount` in `shipmentInvoiceModel.test.ts` in the same describe style as the others: zero for a single-client band, two for a band billing two sub-clients.

- [ ] **Step 6: Run tests to verify they pass**

Run from `app/`:

```bash
yarn test:run src/features/shipments/shipmentInvoiceModel.test.ts src/features/shipments/ShipmentInvoicing.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/features/shipments/shipmentInvoiceModel.ts app/src/features/shipments/shipmentInvoiceModel.test.ts \
        app/src/features/shipments/ShipmentInvoicing.tsx app/src/features/shipments/ShipmentInvoicing.test.tsx
git commit -m "feat(app): group a payer's invoice into collapsible per-client parties"
```

---

### Task 12: Frontend client screens

**Files:**
- Modify: `app/src/features/clients/ClientFormDrawer.tsx`
- Modify: `app/src/features/clients/ClientDetail.tsx:190-205`
- Modify: `app/src/features/clients/ClientsPage.tsx:190-245`
- Test: `app/src/features/clients/ClientFormDrawer.test.tsx`
- Test: `app/src/features/clients/ClientsPage.test.tsx`

**Interfaces:**
- Consumes: `ClientDto.invoicingClientId` / `invoicingClientName` / `invoicedClients`, `ClientListItemDto.invoicingClientId` / `invoicingClientName` (Task 4).
- Produces: no new exports — screen behaviour only.

- [ ] **Step 1: Write the failing tests**

Append to `app/src/features/clients/ClientFormDrawer.test.tsx` (read its existing render helper first):

```tsx
  it('saves a client with no official address', async () => {
    // Render for a new client, fill only the name and region, pick nothing for the address,
    // submit.
    // Assert: createMutation was called with officialAddress undefined.
  });

  it('offers only clients that can be a payer', async () => {
    // Render with a client list holding: a plain client, one that already has a payer, one
    // that is itself a payer, and the client being edited.
    // Assert: the "Propojený klient" combobox lists only the plain client.
  });

  it('sends the chosen payer', async () => {
    // Assert: updateMutation was called with data.invoicingClientId === the chosen client's id.
  });
```

Append to `app/src/features/clients/ClientsPage.test.tsx`:

```tsx
  it('shows the payer on a sub-client row', async () => {
    expect(await screen.findByText('Head Office')).toBeInTheDocument();
  });

  it('falls back to the contact address for a client with no official one', async () => {
    expect(await screen.findByText(/Dlouhá 14/)).toBeInTheDocument();
  });
```

Fill in the arrange halves from each file's existing tests.

- [ ] **Step 2: Run tests to verify they fail**

Run from `app/`:

```bash
yarn test:run src/features/clients/ClientFormDrawer.test.tsx src/features/clients/ClientsPage.test.tsx
```

Expected: FAIL — no `Propojený klient` field, no payer text on the row.

- [ ] **Step 3: Make the official address optional in the form**

In `app/src/features/clients/ClientFormDrawer.tsx`, the official address currently uses the required `addressSchema`. Switch it to the blankable one and require it only when the client has no payer, mirroring how `hasContact` already works:

```ts
const schema = z
  .object({
    name: z.string().trim().min(1, 'Zadejte název'),
    businessName: z.string().optional(),
    region: z.string().min(1, 'Vyberte region'),
    official: blankableAddressSchema,
    invoicingClientId: z.string().optional(),
```

and in the existing `superRefine` (read it first — it already validates the contact address), add:

```ts
    // A client billed through a payer needs no billing address of its own. One that pays for
    // itself still does, or nothing can be invoiced.
    const officialFilled = [v.official.streetName, v.official.streetNumber, v.official.city, v.official.zip]
      .some((s) => s?.trim());
    if (!v.invoicingClientId && !officialFilled) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['official', 'streetName'], message: 'Zadejte adresu nebo propojeného klienta' });
    }
```

Add `invoicingClientId: ''` to the `empty` defaults and to the `reset` in the `useEffect`:

```ts
            invoicingClientId: client.invoicingClientId ?? '',
```

- [ ] **Step 4: Add the payer picker**

The drawer needs the client list to offer options. Check how a sibling drawer gets one:

```bash
grep -rn "useClients\|useClientList" app/src/hooks/useClients.ts | head
```

Then, inside the form body above the address fields:

```tsx
      <Controller control={control} name="invoicingClientId" render={({ field }) => (
        <Combobox
          {...field}
          label="Propojený klient"
          placeholder="Fakturuje se přes jiného klienta…"
          options={payerOptions}
          helperText="Faktury za tohoto klienta vystavíme na vybraného klienta."
        />
      )} />
```

`ClientFormDrawer.tsx` imports `useEffect, useState` but not `useMemo`, and does not import `clientComboOptions` — add both:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { clientComboOptions } from 'src/features/clients/clientOptions';
```

with the options computed above the `return`:

```tsx
  // Only clients that can actually hold the bill: the relation is one hop, so a client that
  // already has a payer or is itself one is not offered, and neither is this client.
  const payerOptions = useMemo(
    () => clientComboOptions(
      (clients ?? []).filter((c) =>
        c.id !== client?.id
        && !c.invoicingClientId
        && !subClientIds.has(c.id ?? '')),
    ),
    [clients, client?.id, subClientIds],
  );

  // Clients that already pay for someone are excluded by their own ids appearing as a payer
  // on another row — the list DTO names the payer, so no extra call is needed.
  const subClientIds = useMemo(
    () => new Set((clients ?? []).map((c) => c.invoicingClientId).filter((id): id is string => Boolean(id))),
    [clients],
  );
```

Declare `subClientIds` before `payerOptions` so the dependency is defined. Match `Combobox`'s real props — read its signature first:

```bash
grep -n "export function Combobox" -A 25 app/src/components/common/Combobox.tsx
```

- [ ] **Step 5: Send the two new fields**

In the `submit` handler, geocode the official address only when one was entered, and put both fields on the payload:

```ts
    const officialFilled = [v.official.streetName, v.official.streetNumber, v.official.city, v.official.zip]
      .some((s) => s?.trim());

    let officialCoords: LatLng | null = null;
    let contactCoords: LatLng | null = null;
    try {
      [officialCoords, contactCoords] = await Promise.all([
        officialFilled ? geocodeAddress(v.official) : Promise.resolve(null),
        v.hasContact ? geocodeAddress(v.contact) : Promise.resolve(null),
      ]);
    } finally {
      setGeocoding(false);
    }
    officialCoords = officialCoords ?? coordsOf(client?.officialAddress);
    contactCoords = contactCoords ?? coordsOf(client?.contactAddress);
    // Only worth warning about an address that was actually entered.
    if (officialFilled && !officialCoords) {
      enqueueSnackbar('Adresu se nepodařilo najít na mapě — GPS zůstane prázdné.', { variant: 'warning' });
    }

    const common = {
      name: v.name,
      businessName: v.businessName?.trim() || undefined,
      region: Region[v.region as keyof typeof Region] as Region,
      officialAddress: officialFilled ? toAddressDto(v.official, officialCoords) : undefined,
      contactAddress: v.hasContact ? toAddressDto(v.contact, contactCoords) : undefined,
      invoicingClientId: v.invoicingClientId || undefined,
    };
```

- [ ] **Step 6: Show the relation on the detail**

In `app/src/features/clients/ClientDetail.tsx`, the official-address card already guards on `client.officialAddress`. Give the false branch a message and add the relation, in the card idiom used around it:

```tsx
            {client.officialAddress ? (
              <>
                <AddressBody a={client.officialAddress} />
                <PointMap lat={client.officialAddress.latitude} lng={client.officialAddress.longitude} color="#0E7C9B" />
              </>
            ) : (
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                {client.invoicingClientName
                  ? `Bez fakturační adresy — fakturuje se přes ${client.invoicingClientName}.`
                  : 'Bez fakturační adresy.'}
              </Typography>
            )}
```

and below that card, when the client is a payer:

```tsx
          {(client.invoicedClients?.length ?? 0) > 0 && (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>Propojení klienti</Typography>
              <Stack spacing={0.5}>
                {client.invoicedClients!.map((sub) => (
                  <Typography key={sub.id} sx={{ fontSize: 13 }}>{sub.name}</Typography>
                ))}
              </Stack>
            </Card>
          )}
```

Follow the file's own card/heading components rather than raw `Card` if it has them — read the surrounding 40 lines first.

- [ ] **Step 7: Show the payer in the list**

In `app/src/features/clients/ClientsPage.tsx`, the address column reads `detailFor(c.id)?.officialAddress`. Fall back:

```tsx
      sortValue: (c) => addrOneLine(detailFor(c.id)?.officialAddress ?? detailFor(c.id)?.contactAddress),
      render: (c) => <Typography color="text.secondary">{addrOneLine(detailFor(c.id)?.officialAddress ?? detailFor(c.id)?.contactAddress)}</Typography>,
```

and apply the same fallback to the `const address = addrOneLine(detail?.officialAddress);` line further down. Add a payer chip beside the client's name in the row — follow whatever chip the row already renders (grep `Chip` in the file) and label it with `c.invoicingClientName`.

- [ ] **Step 8: Run tests to verify they pass**

Run from `app/`:

```bash
yarn test:run src/features/clients
```

Expected: PASS, including the pre-existing `ClientFormDrawer` and `ClientsPage` tests.

- [ ] **Step 9: Commit**

```bash
git add app/src/features/clients
git commit -m "feat(app): link a client to its payer and drop the required billing address"
```

---

### Task 13: Full verification

**Files:** none modified unless a check fails.

**Interfaces:**
- Consumes: every prior task.
- Produces: a green backend suite, a green frontend suite, a clean typecheck and lint.

- [ ] **Step 1: Full backend suite**

Run from `api/AleTrack/`:

```bash
dotnet build AleTrack.sln
dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```

Expected: build with no new warnings, all tests PASS. Run the **whole** suite, not a filter — a filtered run has previously passed while the full one caught pre-existing failures.

- [ ] **Step 2: Full frontend suite, typecheck and lint**

Run from `app/`:

```bash
yarn test:run
yarn typecheck
yarn lint
```

Expected: all PASS with no errors.

- [ ] **Step 3: Confirm the generated client is in step with the backend**

Run from `app/`:

```bash
git diff --stat HEAD -- src/generated/api-client.ts
```

Expected: no output — the client was regenerated in Task 4 and no DTO has changed since. If it does show a diff, a later task changed a DTO without regenerating: start the backend on 8080, run `yarn generate-api`, re-run Step 2, and commit the regenerated client.

- [ ] **Step 4: Verify the migration applies to a local database**

Start the local Postgres from `api/AleTrack/`:

```bash
docker compose up -d
```

Apply from `api/AleTrack/AleTrack/`:

```bash
dotnet ef database update --connection "Host=localhost;Port=5433;Database=AleTrack;Username=postgres;Password=postgres"
```

Expected: applies cleanly. Then confirm the schema:

```bash
docker compose exec -T postgres psql -U postgres -d AleTrack -c "\d clients" | grep -i "invoicing_client_id\|official_address"
```

Expected: `invoicing_client_id` present, and the `official_address_*` columns no longer marked `not null`.

If `docker compose exec` names the service differently, read `api/AleTrack/docker-compose.yml` for the service name.

- [ ] **Step 5: Report**

State plainly which suites ran and their results, and name anything left out and why — the ClosedXML grouping outcome from Task 8 Step 1 in particular. Do not claim a check passed that was not run.

---

## Notes for the executor

- **Task 6 is the one with a hidden trap.** `TrimRank` compares against the ordering client today; leaving it that way makes a quantity drop empty a sub-client's own line first. The test `Reconcile_SubClientQuantityDrops_TrimsItsOwnPayerInvoiceLast` is what catches it.
- **Task 3 Step 6 changes existing behaviour** (`ContactAddress` becomes clearable). That is a fix, but confirm no test depended on the old behaviour before keeping it.
- **Pre-existing splits are deliberately left alone** (Task 6, `Reconcile_ExistingSubClientInvoice_IsLeftAlone`). If a reviewer asks why an in-progress shipment did not regroup, that is the answer, and the spec's *Pre-existing splits* section is the rationale.
- Several steps say "read the file first and match its idiom" rather than giving an exact line. Those are places where the surrounding code's own helper names matter more than a snippet invented here — follow the grep, then write code that looks like its neighbours.
