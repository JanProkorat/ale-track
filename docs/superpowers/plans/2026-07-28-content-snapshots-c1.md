# Content Snapshots C1 — Reports Own Their History

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the volume reports read what a run actually carried, snapshotted onto rows the run owns, so editing a product or renaming a client no longer rewrites delivered history.

**Architecture:** A new `outgoing_shipment_stop_items` table holds one snapshotted line per delivered order line, written by `ShipmentContentSnapshotWriter` on the `→ Loaded` transition and deleted on a revert to `Created`. Client attribution moves onto the stop next to the delivery address it already snapshots. `DeliveredLineQuery` re-bases from `OrderItems` onto the new table; brewery colour stays a live join because it is presentation, and `WeightKg` stays derived so formula corrections still propagate.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql (Postgres 17), xUnit + FluentAssertions + Moq.EntityFrameworkCore.

**Spec:** `docs/superpowers/specs/2026-07-28-content-snapshots-design.md`

## Global Constraints

- Backend commands run from `api/AleTrack/`. Build: `dotnet build AleTrack.sln`. Test: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`.
- Tests are pure unit tests over a mocked DbContext (`AleTrackDbContextMockFactory.CreateMock(...)`). No database is available to the suite.
- Code comments in **English only**.
- **No `yarn generate-api` anywhere in part C**, and `app/src/generated/api-client.ts` must not change. C1 touches no frontend file at all.
- Never edit or stage `appsettings.*.json`, `Program.cs`, `launchSettings.json`, `d.txt`, `r.txt`, `r2.txt`, or the untracked `app/src/**` work in progress (`ProductCombobox*`, `productComboModel*`, `dbg.test.tsx`, `InventoryItemFormDrawer.tsx`, `useBreweries.ts`).
- Enums are stored as `integer`. `OutgoingShipmentState`: Created 0, Loaded 1, InTransit 2, Delivered 3, Cancelled 4. `OutgoingShipmentStopKind`: Order 0, Custom 1.
- Migrations are generated with `dotnet ef migrations add`, never applied to a remote database from here.
- `app/src/dbg.test.tsx` fails on `dev` already and is untracked scratch work. It is not in scope and must not be touched.
- Branch: `feat/25-history-integrity-guards`, continuing from part B.

---

### Task 1: The stop-items table, stop client attribution, and the backfill

**Files:**
- Create: `api/AleTrack/AleTrack/Entities/OutgoingShipmentStopItem.cs`
- Create: `api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/OutgoingShipmentStopItemConfiguration.cs`
- Modify: `api/AleTrack/AleTrack/Entities/OutgoingShipmentStop.cs` (add client snapshot + `Items`, drop `ClientOrderId`)
- Modify: `api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs` (add the DbSet next to `OutgoingShipmentLoadingStates` at line 141)
- Create: migration `<stamp>_ShipmentContentSnapshots.cs` (generated, then hand-edited to add the backfill)

**Interfaces:**
- Consumes: nothing.
- Produces: `OutgoingShipmentStopItem` with properties `StopId`, `OrderItemId`, `ProductId`, `ProductName`, `Kind`, `Type`, `PackageSize`, `UnitsPerPackage`, `Quantity`, `UnitPriceWithVat`, `UnitPriceWithoutVat`, `BreweryPublicId`, `BreweryName`, navs `Stop`/`OrderItem`/`Product`; `OutgoingShipmentStop.Items`, `.ClientPublicId`, `.ClientName`, `.ClientRegion`; `AleTrackDbContext.OutgoingShipmentStopItems`. Every later task consumes these.

- [ ] **Step 1: Create the entity**

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AleTrack.Common.Enums;
using AleTrack.Entities.BaseEntities;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Entities;

/// <summary>
/// One line of what a stop actually carried, snapshotted when the run was loaded.
/// </summary>
/// <remarks>
/// The run owns these rows. <see cref="OrderItemId"/> and <see cref="ProductId"/> are
/// provenance only — both are <c>SET NULL</c>, so retiring a product or unlinking an order
/// costs the trail but never the history.
///
/// The weight is not stored. <see cref="Kind"/>, <see cref="PackageSize"/> and
/// <see cref="UnitsPerPackage"/> are the inputs to <c>ProductWeightCalculator</c>, which stays
/// live: a formula correction (FiveKilos returning 2 instead of 5, the missing bottle-crate
/// weights) fixes a computation that was always wrong and should propagate, while a data
/// correction (a package size fixed from 10 l to 0.5 l) must not rewrite what was delivered.
/// Storing a computed weight would freeze both.
/// </remarks>
[Table("outgoing_shipment_stop_items")]
public sealed class OutgoingShipmentStopItem : PublicEntity
{
    /// <summary>
    /// ID of the owning <see cref="OutgoingShipmentStop"/>.
    /// </summary>
    [Column("stop_id")]
    public long StopId { get; set; }

    /// <summary>
    /// The <see cref="OrderItem"/> this line was snapshotted from. Provenance only.
    /// </summary>
    [Column("order_item_id")]
    public long? OrderItemId { get; set; }

    /// <summary>
    /// The <see cref="Product"/> this line was snapshotted from. Provenance only.
    /// </summary>
    [Column("product_id")]
    public long? ProductId { get; set; }

    /// <summary>Product name as it was when the run was loaded.</summary>
    [MaxLength(50)]
    [Column("product_name")]
    public string ProductName { get; set; } = null!;

    /// <summary>Product kind as it was when the run was loaded. Weight input.</summary>
    [Column("kind")]
    public ProductKind Kind { get; set; }

    /// <summary>Product type as it was when the run was loaded. Report grouping.</summary>
    [Column("type")]
    public ProductType Type { get; set; }

    /// <summary>Container volume in litres as it was when the run was loaded. Weight input.</summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>Containers per sellable unit as it was when the run was loaded. Weight input.</summary>
    [Column("units_per_package")]
    public int UnitsPerPackage { get; set; } = 1;

    /// <summary>Pieces carried.</summary>
    [Column("quantity")]
    public int Quantity { get; set; }

    /// <summary>Unit price with VAT as it was when the run was loaded.</summary>
    [Column("unit_price_with_vat")]
    public decimal UnitPriceWithVat { get; set; }

    /// <summary>Unit price without VAT as it was when the run was loaded.</summary>
    [Column("unit_price_without_vat")]
    public decimal? UnitPriceWithoutVat { get; set; }

    /// <summary>
    /// Public ID of the brewery that supplied the line. Snapshotted rather than joined so the
    /// report grouping survives the brewery row going away.
    /// </summary>
    [Column("brewery_public_id")]
    public Guid BreweryPublicId { get; set; }

    /// <summary>Brewery name as it was when the run was loaded.</summary>
    [MaxLength(50)]
    [Column("brewery_name")]
    public string BreweryName { get; set; } = null!;

    /// <summary>The owning stop.</summary>
    public OutgoingShipmentStop Stop { get; set; } = null!;

    /// <summary>Provenance link to the order line. Null once that line is gone.</summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public OrderItem? OrderItem { get; set; }

    /// <summary>Provenance link to the product. Null once it is hard-deleted.</summary>
    [DeleteBehavior(DeleteBehavior.SetNull)]
    public Product? Product { get; set; }
}
```

- [ ] **Step 2: Add the client snapshot and the items collection to the stop, and drop the dead scalar**

In `Entities/OutgoingShipmentStop.cs`, **delete** this property entirely:

```csharp
    /// <summary>
    /// ID of the order associated with this stop. Null for custom stops.
    /// </summary>
    [Column("client_order_id")]
    public long? ClientOrderId { get; set; }
```

Nothing reads it. The relationship is keyed on `orders.outgoing_shipment_stop_id` with `Order` as the dependent, and `HistoryBuilder.cs:231-234` already documents this column as a mapped scalar EF does not use as the key.

Then add, after `AddressChangedAt`:

```csharp
    /// <summary>
    /// Public ID of the client this stop delivered to, snapshotted when the run was loaded.
    /// Null for custom stops and for stops on runs that never left Created.
    /// </summary>
    /// <remarks>
    /// The stop already snapshots the delivery address; client attribution completes that
    /// pattern. Reports group by client and region, so renaming a client or moving it between
    /// regions used to rewrite past reports.
    /// </remarks>
    [Column("client_public_id")]
    public Guid? ClientPublicId { get; set; }

    /// <summary>Client name as it was when the run was loaded.</summary>
    [MaxLength(100)]
    [Column("client_name")]
    public string? ClientName { get; set; }

    /// <summary>Client region as it was when the run was loaded.</summary>
    [Column("client_region")]
    public Region? ClientRegion { get; set; }
```

And, next to the other navigations:

```csharp
    /// <summary>
    /// What this stop carried, snapshotted at loading time. Empty while the run is still in
    /// Created.
    /// </summary>
    public ICollection<OutgoingShipmentStopItem> Items { get; set; } = [];
```

- [ ] **Step 3: Add the configuration**

```csharp
using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class OutgoingShipmentStopItemConfiguration : IEntityTypeConfiguration<OutgoingShipmentStopItem>
{
    public void Configure(EntityTypeBuilder<OutgoingShipmentStopItem> builder)
    {
        // The stop owns these rows: they die with it and are rebuilt on every transition into
        // Loaded, so cascade is correct here in a way it is not for the provenance links.
        builder.HasOne(i => i.Stop)
            .WithMany(s => s.Items)
            .HasForeignKey(i => i.StopId)
            .OnDelete(DeleteBehavior.Cascade);

        // Every report query filters by shipment state and delivery date and then aggregates
        // per stop, so this is the access path that matters.
        builder.HasIndex(i => i.StopId);
    }
}
```

- [ ] **Step 4: Add the DbSet**

In `Infrastructure/Persistence/AleTrackDbContext.cs`, directly after the `OutgoingShipmentLoadingStates` property (line 141):

```csharp
    /// <summary>
    /// DbSet of <see cref="OutgoingShipmentStopItem"/>
    /// </summary>
    public virtual DbSet<OutgoingShipmentStopItem> OutgoingShipmentStopItems => Set<OutgoingShipmentStopItem>();
```

- [ ] **Step 5: Fix the test builder's use of the dropped column so the solution compiles**

`AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs` sets `ClientOrderId = order.Id` on the stop in four places (`Build`, `AddSecondClient`, `AddSecondStopForSameClient`, `AddSecondShipment`). Delete all four assignment lines. The line below each of them — `order.OutgoingShipmentStop = stop;` plus `order.OutgoingShipmentStopId = stop.Id;` — is what actually establishes the relationship and stays.

- [ ] **Step 6: Build**

Run: `cd api/AleTrack && dotnet build AleTrack.sln`
Expected: 0 errors. If anything else still references `OutgoingShipmentStop.ClientOrderId`, the compiler names it — delete those uses too; nothing legitimately needs it.

- [ ] **Step 7: Generate the migration**

Run from `api/AleTrack/AleTrack/`:

```bash
dotnet ef migrations add ShipmentContentSnapshots
```

Expected `Up`: creates `outgoing_shipment_stop_items` with its index and three foreign keys; adds `client_public_id`, `client_name`, `client_region` to `outgoing_shipment_stops`; drops `client_order_id`.

- [ ] **Step 8: Append the backfill to the migration**

At the **end** of the generated `Up` method, add:

```csharp
            // Backfill. Snapshot columns are populated from the values live right now, which is
            // the most the existing data can support: pre-migration history therefore reflects
            // product and client values as of this migration, not as of the delivery. Stated
            // rather than hidden behind a read-time fallback — the read paths deliberately have
            // none, so a snapshot-writer bug stays distinguishable from genuinely old data.
            //
            // Only runs for shipments past Created (Loaded 1, InTransit 2, Delivered 3,
            // Cancelled 4): a run still being planned gets its snapshot when it is loaded.
            migrationBuilder.Sql("""
                INSERT INTO outgoing_shipment_stop_items
                    (public_id, stop_id, order_item_id, product_id, product_name, kind, type,
                     package_size, units_per_package, quantity,
                     unit_price_with_vat, unit_price_without_vat,
                     brewery_public_id, brewery_name)
                SELECT gen_random_uuid(), s.id, oi.id, p.id, p.name, p.kind, p.type,
                       p.package_size, p.units_per_package, oi.quantity,
                       p.price_with_vat, p.price_without_vat,
                       b.public_id, b.name
                FROM outgoing_shipment_stops s
                JOIN outgoing_shipments sh ON sh.id = s.outgoing_shipment_id
                JOIN orders o ON o.outgoing_shipment_stop_id = s.id
                JOIN order_items oi ON oi.order_id = o.id
                JOIN products p ON p.id = oi.product_id
                JOIN breweries b ON b.id = p.brewery_id
                WHERE s.kind = 0 AND sh.state IN (1, 2, 3, 4);
                """);

            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_stops s
                SET client_public_id = c.public_id,
                    client_name = c.name,
                    client_region = c.region
                FROM orders o
                JOIN clients c ON c.id = o.client_id
                JOIN outgoing_shipments sh ON sh.id = s.outgoing_shipment_id
                WHERE o.outgoing_shipment_stop_id = s.id
                  AND s.kind = 0
                  AND sh.state IN (1, 2, 3, 4);
                """);
```

`gen_random_uuid()` is built into Postgres 13+, so no extension is needed on either the local Postgres 17 container or Supabase.

The generated `Down` needs nothing extra: it drops the table and the three columns, which discards the backfilled data with them.

- [ ] **Step 9: Run the full suite**

Run: `cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all 459 still pass. Nothing reads the new table yet, so this task is purely additive to behaviour.

- [ ] **Step 10: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/OutgoingShipmentStopItem.cs \
        api/AleTrack/AleTrack/Entities/OutgoingShipmentStop.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Configurations/OutgoingShipmentStopItemConfiguration.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/AleTrackDbContext.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/ \
        api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs
git commit -m "feat(shipments): give stops their own snapshotted content rows"
```

---

### Task 2: The snapshot writer

**Files:**
- Create: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentContentSnapshotWriter.cs`
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentContentSnapshotWriterTests.cs` (create)

**Interfaces:**
- Consumes: `OutgoingShipmentStopItem`, `OutgoingShipmentStop.Items`/`.ClientPublicId`/`.ClientName`/`.ClientRegion` (Task 1).
- Produces:
  - `static void ShipmentContentSnapshotWriter.Apply(OutgoingShipment shipment)`
  - `static void ShipmentContentSnapshotWriter.Clear(OutgoingShipment shipment)`

  Both consumed by Task 3. `Apply` replaces each order stop's `Items` and fills its client snapshot; `Clear` empties both. Neither touches the DbContext — orphan removal handles deletion, because `stop_id` is required and cascading.

- [ ] **Step 1: Write the failing tests**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

/// <summary>
/// Builds the rows the run owns. Everything the reports later read comes from here, so the
/// values are asserted field by field rather than by count.
/// </summary>
public sealed class ShipmentContentSnapshotWriterTests
{
    [Fact]
    public void Apply_CopiesProductAndBreweryFactsOntoTheStop()
    {
        var f = Fixture();

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        var item = f.Shipment.Stops.Single().Items.Should().ContainSingle().Subject;
        item.ProductName.Should().Be("Albrecht 12°");
        item.Kind.Should().Be(ProductKind.Bottle);
        item.Type.Should().Be(ProductType.PaleLager);
        item.PackageSize.Should().Be(0.5);
        item.UnitsPerPackage.Should().Be(20);
        item.Quantity.Should().Be(6);
        item.UnitPriceWithVat.Should().Be(11.49m);
        item.UnitPriceWithoutVat.Should().Be(9.50m);
        item.BreweryName.Should().Be("Pivovar Zittau");
        item.BreweryPublicId.Should().Be(f.Brewery.PublicId);
        item.OrderItemId.Should().Be(f.Item.Id, "provenance is kept even though it is not read");
        item.ProductId.Should().Be(f.Product.Id);
    }

    [Fact]
    public void Apply_CopiesClientAttributionOntoTheStop()
    {
        var f = Fixture();

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        var stop = f.Shipment.Stops.Single();
        stop.ClientPublicId.Should().Be(f.Client.PublicId);
        stop.ClientName.Should().Be("Hospoda U Kotvy");
        stop.ClientRegion.Should().Be(Region.ZittauCity);
    }

    /// <summary>
    /// Editing the product after the snapshot must not reach back into it. This is the whole
    /// point of the table.
    /// </summary>
    [Fact]
    public void Apply_SnapshotIsIndependentOfLaterProductEdits()
    {
        var f = Fixture();
        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        f.Product.Name = "Přejmenováno";
        f.Product.PriceWithVat = 99m;
        f.Product.PackageSize = 10;

        var item = f.Shipment.Stops.Single().Items.Single();
        item.ProductName.Should().Be("Albrecht 12°");
        item.UnitPriceWithVat.Should().Be(11.49m);
        item.PackageSize.Should().Be(0.5);
    }

    [Fact]
    public void Apply_IsIdempotent_ReplacingRatherThanAppending()
    {
        var f = Fixture();

        ShipmentContentSnapshotWriter.Apply(f.Shipment);
        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        f.Shipment.Stops.Single().Items.Should().HaveCount(1);
    }

    [Fact]
    public void Apply_SkipsCustomStops()
    {
        var f = Fixture();
        f.Shipment.Stops.Add(new OutgoingShipmentStop
        {
            PublicId = Guid.NewGuid(),
            Kind = OutgoingShipmentStopKind.Custom,
            Order = 2,
            Label = "Čerpací stanice",
            Latitude = 49.2m,
            Longitude = 16.6m
        });

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        var custom = f.Shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Custom);
        custom.Items.Should().BeEmpty();
        custom.ClientName.Should().BeNull();
    }

    /// <summary>
    /// A retired product still has to snapshot: it is exactly the case the reports must survive.
    /// </summary>
    [Fact]
    public void Apply_SnapshotsARetiredProduct()
    {
        var f = Fixture();
        f.Product.IsDeleted = true;

        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        f.Shipment.Stops.Single().Items.Single().ProductName.Should().Be("Albrecht 12°");
    }

    /// <summary>
    /// Reverting to Created makes the content editable again, so a stale snapshot is worse than
    /// none. It is rebuilt on the next transition into Loaded.
    /// </summary>
    [Fact]
    public void Clear_RemovesItemsAndClientAttribution()
    {
        var f = Fixture();
        ShipmentContentSnapshotWriter.Apply(f.Shipment);

        ShipmentContentSnapshotWriter.Clear(f.Shipment);

        var stop = f.Shipment.Stops.Single();
        stop.Items.Should().BeEmpty();
        stop.ClientPublicId.Should().BeNull();
        stop.ClientName.Should().BeNull();
        stop.ClientRegion.Should().BeNull();
    }

    private sealed record Graph(
        OutgoingShipment Shipment, Client Client, Brewery Brewery, Product Product, OrderItem Item);

    private static Graph Fixture()
    {
        var brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau", color: "#E69F00");
        brewery.Id = 1;

        var client = ClientBuilder.BuildEntity(
            name: "Hospoda U Kotvy",
            region: Region.ZittauCity,
            officialAddress: AddressBuilder.BuildEntity());
        client.Id = 1;

        var product = ProductBuilder.BuildEntity(
            name: "Albrecht 12°",
            kind: ProductKind.Bottle,
            type: ProductType.PaleLager,
            packageSize: 0.5,
            priceWithVat: 11.49m);
        product.Id = 41;
        product.UnitsPerPackage = 20;
        product.PriceWithoutVat = 9.50m;
        product.Brewery = brewery;
        product.BreweryId = brewery.Id;

        var item = new OrderItem
        {
            Id = 51,
            PublicId = Guid.NewGuid(),
            Product = product,
            ProductId = product.Id,
            Quantity = 6
        };

        var order = OrderBuilder.BuildEntity(publicId: Guid.NewGuid(), client: client, orderItems: [item]);
        order.Id = 101;

        var shipment = OutgoingShipmentBuilder.BuildEntity(
            publicId: Guid.NewGuid(),
            deliveryDate: DateTime.UtcNow.AddDays(1),
            state: OutgoingShipmentState.Created,
            stops:
            [
                new OutgoingShipmentStop
                {
                    PublicId = Guid.NewGuid(),
                    Kind = OutgoingShipmentStopKind.Order,
                    Order = 1,
                    ClientOrder = order
                }
            ]);

        return new Graph(shipment, client, brewery, product, item);
    }
}
```

Check `ProductBuilder.BuildEntity`'s parameter list before relying on it — it accepts `publicId, name, description, kind, type, alcoholPercentage, platoDegree, packageSize, priceWithVat, priceForUnitWithVat, priceForUnitWithoutVat` but **not** `unitsPerPackage` or `priceWithoutVat`, which is why those two are assigned after construction. `ClientBuilder.BuildEntity` accepts `name` and `region`; confirm the exact names.

- [ ] **Step 2: Run to verify it fails**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentContentSnapshotWriterTests"`
Expected: compile error — `ShipmentContentSnapshotWriter` does not exist.

- [ ] **Step 3: Implement**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Copies what a run carries onto rows the run owns.
/// </summary>
/// <remarks>
/// Runs on the transition into <see cref="OutgoingShipmentState.Loaded"/>, the same boundary at
/// which <see cref="ShipmentMutability"/> freezes content — which is what stops the snapshot and
/// the shipment from ever diverging.
///
/// Neither method touches the DbContext. <c>stop_id</c> is required and cascading, so clearing a
/// stop's <see cref="OutgoingShipmentStop.Items"/> collection makes the rows orphans and EF
/// deletes them on save.
/// </remarks>
public static class ShipmentContentSnapshotWriter
{
    /// <summary>
    /// Replaces every order stop's snapshotted content and client attribution. Idempotent:
    /// re-loading a run rebuilds rather than appends.
    /// </summary>
    public static void Apply(OutgoingShipment shipment)
    {
        foreach (var stop in shipment.Stops.Where(s => s.Kind == OutgoingShipmentStopKind.Order && s.ClientOrder is not null))
        {
            var order = stop.ClientOrder!;

            stop.ClientPublicId = order.Client?.PublicId;
            stop.ClientName = order.Client?.Name;
            stop.ClientRegion = order.Client?.Region;

            stop.Items = [.. order.OrderItems.Select(item => Snapshot(stop, item))];
        }
    }

    /// <summary>
    /// Discards the snapshot. Called when a run reverts to
    /// <see cref="OutgoingShipmentState.Created"/> and its content becomes editable again.
    /// </summary>
    public static void Clear(OutgoingShipment shipment)
    {
        foreach (var stop in shipment.Stops)
        {
            stop.Items = [];
            stop.ClientPublicId = null;
            stop.ClientName = null;
            stop.ClientRegion = null;
        }
    }

    private static OutgoingShipmentStopItem Snapshot(OutgoingShipmentStop stop, OrderItem item)
    {
        var product = item.Product;

        return new OutgoingShipmentStopItem
        {
            PublicId = Guid.NewGuid(),
            Stop = stop,
            OrderItemId = item.Id == 0 ? null : item.Id,
            OrderItem = item,
            ProductId = product?.Id == 0 ? null : product?.Id,
            Product = product,
            ProductName = product?.Name ?? string.Empty,
            Kind = product?.Kind ?? ProductKind.Other,
            Type = product?.Type ?? default,
            PackageSize = product?.PackageSize,
            UnitsPerPackage = product?.UnitsPerPackage ?? 1,
            Quantity = item.Quantity,
            UnitPriceWithVat = product?.PriceWithVat ?? 0m,
            UnitPriceWithoutVat = product?.PriceWithoutVat,
            BreweryPublicId = product?.Brewery?.PublicId ?? Guid.Empty,
            BreweryName = product?.Brewery?.Name ?? string.Empty
        };
    }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentContentSnapshotWriterTests"`
Expected: all PASS.

- [ ] **Step 5: Prove the snapshot test earns its place**

Temporarily change `ProductName = product?.Name ?? string.Empty` to read from a mutable source, e.g. replace the whole `Snapshot` body's `ProductName` with `ProductName = "wrong"`, run the filter again, and confirm `Apply_CopiesProductAndBreweryFactsOntoTheStop` and `Apply_SnapshotIsIndependentOfLaterProductEdits` both fail. Then revert.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentContentSnapshotWriter.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentContentSnapshotWriterTests.cs
git commit -m "feat(shipments): snapshot carried content onto the stop at loading time"
```

---

### Task 3: Wire the writer into the shipment update

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentEndpoint.cs` (the load's includes; the transition block around line 130-150)
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/UpdateOutgoingShipmentTests.cs`

**Interfaces:**
- Consumes: `ShipmentContentSnapshotWriter.Apply` / `.Clear` (Task 2); the existing `isTransitioningToLoaded` local already computed in the handler.
- Produces: nothing for later tasks.

- [ ] **Step 1: Write the failing tests**

Append to `UpdateOutgoingShipmentTests.cs`, reusing the `BuildFreezeFixture` / `EchoDto` / `MockForFreeze` helpers already in that class from part B. Note `BuildFreezeFixture` builds a stop whose order has **no** items, so add one in the test:

```csharp
    /// <summary>
    /// The snapshot is written at the same boundary that freezes content, which is what keeps
    /// the two from diverging.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_TransitionToLoaded_WritesTheContentSnapshot()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Created);
        var product = ProductBuilder.BuildEntity(name: "Albrecht 12°", priceWithVat: 11.49m);
        product.Id = 41;
        product.Brewery = BreweryBuilder.BuildEntity(name: "Pivovar Zittau");
        f.Order.OrderItems = [new OrderItem { Id = 51, PublicId = Guid.NewGuid(), Product = product, ProductId = product.Id, Quantity = 6 }];

        var db = MockForFreeze(f);
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object);

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.Loaded)
        }, CancellationToken.None);

        var stop = f.Shipment.Stops.Single(s => s.Kind == OutgoingShipmentStopKind.Order);
        stop.Items.Should().ContainSingle();
        stop.Items.Single().ProductName.Should().Be("Albrecht 12°");
        stop.Items.Single().UnitPriceWithVat.Should().Be(11.49m);
        stop.ClientName.Should().Be(f.Order.Client.Name);
    }

    /// <summary>
    /// Reverting makes content editable again, so the snapshot must go rather than go stale.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_RevertToCreated_DiscardsTheContentSnapshot()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var stop = f.Shipment.Stops.Single();
        stop.Items = [new OutgoingShipmentStopItem { PublicId = Guid.NewGuid(), ProductName = "Albrecht 12°", Quantity = 6, BreweryName = "Pivovar Zittau" }];
        stop.ClientPublicId = Guid.NewGuid();
        stop.ClientName = "Hospoda U Kotvy";
        stop.ClientRegion = Region.ZittauCity;

        var db = MockForFreeze(f);
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object);

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.Created)
        }, CancellationToken.None);

        stop.Items.Should().BeEmpty();
        stop.ClientName.Should().BeNull();
    }

    /// <summary>
    /// Advancing past Loaded must not re-snapshot: by then the source order items are frozen,
    /// but re-running the writer would hand out new rows and new IDs for no reason.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_AdvanceLoadedToInTransit_LeavesTheSnapshotAlone()
    {
        var f = BuildFreezeFixture(OutgoingShipmentState.Loaded);
        var stop = f.Shipment.Stops.Single();
        var existing = new OutgoingShipmentStopItem { PublicId = Guid.NewGuid(), ProductName = "Albrecht 12°", Quantity = 6, BreweryName = "Pivovar Zittau" };
        stop.Items = [existing];

        var db = MockForFreeze(f);
        var endpoint = EndpointBuilder<UpdateOutgoingShipmentRequest, UpdateOutgoingShipmentEndpoint>.Create(db.Object);

        await endpoint.HandleAsync(new UpdateOutgoingShipmentRequest
        {
            Id = f.Shipment.PublicId,
            Data = EchoDto(f, OutgoingShipmentState.InTransit)
        }, CancellationToken.None);

        stop.Items.Should().ContainSingle().Which.Should().BeSameAs(existing);
    }
```

- [ ] **Step 2: Run to verify the first two fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~UpdateOutgoingShipmentTests"`
Expected: `WritesTheContentSnapshot` and `DiscardsTheContentSnapshot` FAIL; `LeavesTheSnapshotAlone` already passes (nothing writes yet).

- [ ] **Step 3: Extend the load so the writer can see what it needs**

The handler's existing include chain reaches `Stops → ClientOrder → OrderItems → Product` but not the product's brewery nor the order's client, and not the existing snapshot rows. Add to the chain:

```csharp
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder!)
                .ThenInclude(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                        .ThenInclude(p => p!.Brewery)
        .Include(os => os.Stops)
            .ThenInclude(s => s.ClientOrder!)
                .ThenInclude(o => o.Client)
        // Loaded so a revert can orphan them: stop_id is required and cascading, so clearing
        // the collection is what deletes the rows.
        .Include(os => os.Stops)
            .ThenInclude(s => s.Items)
```

- [ ] **Step 4: Call the writer on the two transitions**

The handler already computes `isTransitioningToLoaded` before assigning the new state. Add a sibling local next to it:

```csharp
        var isRevertingToCreated = outgoingShipment.State != OutgoingShipmentState.Created
                                   && req.Data.State == OutgoingShipmentState.Created;
```

Then, next to the existing `if (isTransitioningToLoaded) SubtractFromInventory(outgoingShipment);` call:

```csharp
        // Snapshot at the same boundary that freezes content, so the two cannot diverge.
        if (isTransitioningToLoaded)
            ShipmentContentSnapshotWriter.Apply(outgoingShipment);

        // Reverting reopens the content for editing, so a kept snapshot would go stale. It is
        // rebuilt on the next transition into Loaded.
        if (isRevertingToCreated)
            ShipmentContentSnapshotWriter.Clear(outgoingShipment);
```

- [ ] **Step 5: Run the full suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass, including the three new tests.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Commands/Update/UpdateOutgoingShipmentEndpoint.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/UpdateOutgoingShipmentTests.cs
git commit -m "feat(shipments): write the content snapshot when a run is loaded"
```

---

### Task 4: Teach the test harness about stop items

**Files:**
- Modify: `api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs`
- Modify: `api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs`

**Interfaces:**
- Consumes: `AleTrackDbContext.OutgoingShipmentStopItems` (Task 1), `ShipmentContentSnapshotWriter.Apply` (Task 2).
- Produces: `AleTrackDbContextMockFactory.CreateMock(..., outgoingShipmentStopItems: ...)`; `DeliveredShipmentFixture.StopItems`. Task 5's tests consume both.

This task changes no production code and is expected to leave the suite green throughout — it exists so Task 5 can be a pure behaviour change.

- [ ] **Step 1: Add the parameter to the mock factory**

`CreateMock` has a long optional-parameter list forwarded to a private overload which then calls `ReturnsDbSet` per set. Follow `outgoingShipmentLoadingStates` exactly — it appears in three places (the public signature at ~line 59, the forwarding call at ~line 84, the private signature at ~line 126, and the setup at ~line 148). Add:

```csharp
        ICollection<OutgoingShipmentStopItem>? outgoingShipmentStopItems = null,
```

```csharp
            outgoingShipmentStopItems ?? [],
```

```csharp
        ICollection<OutgoingShipmentStopItem> outgoingShipmentStopItems,
```

```csharp
        dbContextMock.Setup<DbSet<OutgoingShipmentStopItem>>(x => x.OutgoingShipmentStopItems).ReturnsDbSet(outgoingShipmentStopItems);
```

Keep the position consistent across all four so the positional forwarding call still lines up. Add the matching `<param>` doc line to the XML comment block.

- [ ] **Step 2: Make `DeliveredShipmentBuilder` produce stop items**

Every fixture path funnels through `BuildLines`, and every path then calls `CreateMock`. Rather than duplicating snapshot construction, have the builder run the real writer so the fixture and production cannot drift.

In `BuildLines`, after the loop assigns `order.OrderItems`, the caller has the stop; so instead add a helper called by each path right after `order.OrderItems = orderItems;`:

```csharp
    /// <summary>
    /// Populates snapshotted content on every stop of every given shipment, the same way
    /// production does, by running the real writer. Using the writer rather than hand-built rows
    /// keeps the fixture from drifting away from what a loaded run actually stores.
    /// </summary>
    /// <remarks>
    /// Takes every shipment and returns every row, because <c>Apply</c> rebuilds a whole
    /// shipment's stops rather than appending to one: calling it after adding a second stop
    /// re-snapshots the first as well. Accumulating the return value across calls would
    /// therefore double-count. Callers pass the result straight to <c>CreateMock</c>.
    /// </remarks>
    private static List<OutgoingShipmentStopItem> SnapshotAll(params OutgoingShipment[] shipments)
    {
        var items = new List<OutgoingShipmentStopItem>();

        foreach (var shipment in shipments)
        {
            ShipmentContentSnapshotWriter.Apply(shipment);
            items.AddRange(shipment.Stops.SelectMany(s => s.Items));
        }

        // The mocked DbSet is queried by the report projection, which navigates si.Stop and
        // groups by si.StopId, so both need to be real.
        var nextId = 1000L;
        foreach (var item in items)
        {
            item.Id = nextId++;
            item.StopId = item.Stop.Id;
        }

        return items;
    }
```

Call it once per fixture path, immediately before that path's `CreateMock` call, and pass the result as `outgoingShipmentStopItems:`. **Do not accumulate it into the previous fixture's list** — the return value is already the complete set:

- `Build`: `var stopItems = SnapshotAll(shipment);`
- `AddSecondClient` and `AddSecondStopForSameClient`: `var stopItems = SnapshotAll(fixture.Shipment);` — the second stop is already on that shipment by this point.
- `AddSecondShipment`: `var stopItems = SnapshotAll(fixture.Shipment, secondShipment);`
- `WithIncomingDelivery`: `var stopItems = SnapshotAll(fixture.Shipment);` — it re-mocks the context, so the outgoing side must still be present.

Each path then returns `fixture with { DbContext = dbContext, OrderItems = allOrderItems, StopItems = stopItems }`.

`Apply` needs `stop.ClientOrder.Client` and `item.Product.Brewery` populated, which the builder already wires.

Add `StopItems` to the fixture record and carry it through each `fixture with { ... }`:

```csharp
public sealed record DeliveredShipmentFixture(
    Mock<AleTrackDbContext> DbContext,
    OutgoingShipment Shipment,
    Order Order,
    Client Client,
    Brewery Brewery,
    Driver Driver,
    List<OrderItem> OrderItems,
    List<OutgoingShipmentStopItem> StopItems);
```

`WithIncomingDelivery` also calls `CreateMock`; pass `fixture.StopItems` there so the outgoing side keeps working when a test adds a Dovoz.

- [ ] **Step 3: Run the full suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass. Nothing reads the new DbSet yet, so this is inert.

- [ ] **Step 4: Commit**

```bash
git add api/AleTrack/AleTrack.Tests/Mocks/AleTrackDbContextMockFactory.cs \
        api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs
git commit -m "test(reports): build snapshotted stop content in the delivered-shipment fixture"
```

---

### Task 5: Re-base `DeliveredLineQuery` onto the snapshot

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Reports/Utils/DeliveredLineRow.cs`
- Modify: `api/AleTrack/AleTrack/Features/Reports/Queries/DeliveryVolume/GetDeliveryVolumeEndpoint.cs:56` (the `ClientsServed` distinct-count)
- Test: `api/AleTrack/AleTrack.Tests/Features/Reports/DeliveredLineQueryTests.cs` (create)
- Test: `api/AleTrack/AleTrack.Tests/Features/Reports/ClientVolumeReportTests.cs`, `DeliveryVolumeReportTests.cs`, `OperationsReportTests.cs` (only if a dropped field is referenced)

**Interfaces:**
- Consumes: `AleTrackDbContext.OutgoingShipmentStopItems`, the stop's client snapshot (Task 1); the fixture's `StopItems` (Task 4).
- Produces: `DeliveredLineRow` **without** `ClientId` and `BreweryId` (both `long`, both unused after this change) — `GetDeliveryVolumeEndpoint` must switch its `ClientsServed` count from `r.ClientId` to `r.ClientPublicId`. Everything else on the row keeps its name and type.

- [ ] **Step 1: Write the headline regression test**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Features.Reports.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Tests.Features.Reports;

/// <summary>
/// The delivered-line projection reads what the run recorded, not what the product says now.
/// </summary>
public sealed class DeliveredLineQueryTests
{
    [Fact]
    public async Task Project_ReadsTheSnapshot_NotTheLiveProduct()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Bottle, ProductType.PaleLager, 0.5, quantity: 20)]);

        var before = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31))
            .ToListAsync();

        // Restate the product the way correcting seed data did on 2026-07-28: a bottle that
        // was recorded as 0.5 l is now said to be a 10 l package, at a different price.
        var product = f.OrderItems.Single().Product;
        product.PackageSize = 10;
        product.Name = "Přejmenováno";
        product.PriceWithVat = 99m;

        var after = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31))
            .ToListAsync();

        after.Should().BeEquivalentTo(before, "a product edit must not restate delivered history");
        after.Single().PackageSize.Should().Be(0.5);
    }

    [Fact]
    public async Task Project_ReadsClientAttributionFromTheStop_NotTheLiveClient()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)],
            region: Region.ZittauCity);

        f.Client.Name = "Přejmenovaný klient";
        f.Client.Region = Region.Berlin;

        var rows = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31))
            .ToListAsync();

        rows.Single().ClientName.Should().Be("Hospoda U Kotvy");
        rows.Single().ClientRegion.Should().Be(Region.ZittauCity);
    }

    /// <summary>
    /// Colour is presentation, not history: recolouring a brewery repaints old charts too.
    /// </summary>
    [Fact]
    public async Task Project_ReadsBreweryColourLive_AndBreweryNameFromTheSnapshot()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)]);

        f.Brewery.Color = "#123456";
        f.Brewery.Name = "Přejmenovaný pivovar";

        var row = (await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31))
            .ToListAsync()).Single();

        row.BreweryColor.Should().Be("#123456", "colour is presentation and follows the brewery");
        row.BreweryName.Should().Be("Pivovar Zittau", "the name is a fact and follows the snapshot");
    }

    /// <summary>
    /// The formula stays live on purpose, so correcting it moves history — unlike correcting the
    /// data it consumes.
    /// </summary>
    [Fact]
    public async Task Project_DerivesWeightRatherThanStoringIt()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Delivered,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)]);

        var row = (await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31))
            .ToListAsync()).Single();

        row.WeightKg.Should().BeGreaterThan(0m);
    }

    [Fact]
    public async Task Project_ExcludesShipmentsThatAreNotDelivered()
    {
        var f = DeliveredShipmentBuilder.Build(
            deliveryDate: new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            state: OutgoingShipmentState.Cancelled,
            lines: [new(ProductKind.Keg, ProductType.PaleLager, 50, quantity: 2)]);

        var rows = await DeliveredLineQuery
            .Project(f.DbContext.Object, new DateOnly(2026, 7, 1), new DateOnly(2026, 7, 31))
            .ToListAsync();

        rows.Should().BeEmpty();
    }
}
```

- [ ] **Step 2: Run to verify the first three fail**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~DeliveredLineQueryTests"`
Expected: `ReadsTheSnapshot_NotTheLiveProduct`, `ReadsClientAttributionFromTheStop_NotTheLiveClient` and `ReadsBreweryColourLive_AndBreweryNameFromTheSnapshot` FAIL, because the projection still reads the live product and client.

- [ ] **Step 3: Drop the two unused `long` id fields from the row**

In `DeliveredLineRow`, delete `public long ClientId { get; init; }` and `public long BreweryId { get; init; }`. Nothing groups by them: `ClientVolume` groups by `ClientPublicId` and `DeliveryVolume` by `BreweryPublicId`. `GetDeliveryVolumeEndpoint:56` counts distinct `r.ClientId` — change it to:

```csharp
            ClientsServed = rows.Select(r => r.ClientPublicId).Distinct().Count(),
```

- [ ] **Step 4: Re-base the projection**

Replace `DeliveredLineQuery.Project` with:

```csharp
    /// <summary>
    /// Snapshotted stop lines on delivered shipments whose delivery date falls inside the window.
    /// Only <see cref="OutgoingShipmentStopKind.Order"/> stops carry products; custom stops and
    /// client/custom extra items are excluded from v1 volume by design (see the module spec).
    /// </summary>
    /// <remarks>
    /// Reads the run's own snapshot rather than the live product, so editing a product or
    /// renaming a client no longer restates delivered history. Brewery colour is the deliberate
    /// exception: it is presentation, so recolouring a brewery repaints old charts too.
    ///
    /// Callers must materialize (e.g. <c>ToListAsync</c>) before touching
    /// <see cref="DeliveredLineRow.Date"/> or <see cref="DeliveredLineRow.WeightKg"/> — both are
    /// computed in memory and composing a further <c>.Where</c>/<c>.OrderBy</c> onto the
    /// still-deferred <see cref="IQueryable{T}"/> reproduces the untranslatable-property bug.
    /// <c>Moq.EntityFrameworkCore</c> mocks LINQ-to-objects, so this mistake passes tests and
    /// only fails against a real Npgsql provider.
    /// </remarks>
    public static IQueryable<DeliveredLineRow> Project(AleTrackDbContext dbContext, DateOnly from, DateOnly to)
    {
        // Kind=Utc is mandatory: DeliveryDate is timestamptz and Npgsql rejects Unspecified.
        var fromDate = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var toDate = to.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        return dbContext.OutgoingShipmentStopItems
            .Where(si => si.Stop.Kind == OutgoingShipmentStopKind.Order
                         && si.Stop.OutgoingShipment.State == OutgoingShipmentState.Delivered
                         && si.Stop.OutgoingShipment.DeliveryDate != null
                         && si.Stop.OutgoingShipment.DeliveryDate >= fromDate
                         && si.Stop.OutgoingShipment.DeliveryDate <= toDate)
            .Select(si => new DeliveredLineRow
            {
                DeliveredAtUtc = si.Stop.OutgoingShipment.DeliveryDate!.Value,
                ClientPublicId = si.Stop.ClientPublicId!.Value,
                ClientName = si.Stop.ClientName!,
                ClientRegion = si.Stop.ClientRegion!.Value,
                BreweryPublicId = si.BreweryPublicId,
                BreweryName = si.BreweryName,
                BreweryColor = dbContext.Breweries
                    .Where(b => b.PublicId == si.BreweryPublicId)
                    .Select(b => b.Color)
                    .FirstOrDefault(),
                StopId = si.StopId,
                Kind = si.Kind,
                Type = si.Type,
                Quantity = si.Quantity,
                PackageSize = si.PackageSize,
                UnitsPerPackage = si.UnitsPerPackage
            });
    }
```

Update the class summary above it from "order lines that actually reached the client" to name the snapshot as the source.

- [ ] **Step 5: Run the full suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass. The three existing report test classes drive the handlers through the fixture, which Task 4 taught to build stop items, so they should need no edits. If one fails on a null `ClientName`, the cause is a fixture path that calls `CreateMock` without passing `outgoingShipmentStopItems` or without running `SnapshotStop` — fix the builder, not the assertion.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Reports api/AleTrack/AleTrack.Tests/Features/Reports
git commit -m "fix(reports): read delivered volume from the run's snapshot, not live products"
```

---

### Task 6: Seed snapshots in the generated history

**Files:**
- Modify: `api/AleTrack/AleTrack.Seeding/Builders/HistoryBuilder.cs` (the `BuildOrderStops` helper at ~line 236, and the shipment assembly at ~line 114)

**Interfaces:**
- Consumes: `ShipmentContentSnapshotWriter.Apply` (Task 2).
- Produces: nothing.

- [ ] **Step 1: Snapshot each generated run**

`HistoryBuilder` generates historical runs, all of them `Delivered`, by assembling `Stops = BuildOrderStops(orders)`. Because every generated run is past `Created`, each needs its snapshot — otherwise seeded demo data produces empty volume reports once Task 5 lands.

`AleTrack.Seeding` already references the API project, so the writer is directly usable. After the `OutgoingShipment` is constructed with its stops (around line 114), call:

```csharp
        // Every generated run is Delivered, so it must carry the snapshot a real run gets on
        // its transition into Loaded — the volume reports read nothing else.
        ShipmentContentSnapshotWriter.Apply(shipment);
```

Add `using AleTrack.Features.OutgoingShipments.Utils;` at the top. The writer needs `stop.ClientOrder.Client` and `item.Product.Brewery` set on the in-memory graph; `HistoryBuilder` already builds orders from a client and products from a brewery, so confirm both navigations are assigned and assign them if not — `Apply` degrades to empty strings rather than throwing, which would seed useless rows silently.

Update the `BuildOrderStops` doc comment: it currently warns only about `ClientOrderId`, a column that no longer exists after Task 1. Replace that paragraph with a note that assigning `ClientOrder` sets the real foreign key on `orders.outgoing_shipment_stop_id`.

- [ ] **Step 2: Build the seeding project**

Run: `cd api/AleTrack && dotnet build AleTrack.sln`
Expected: 0 errors.

- [ ] **Step 3: Run the full suite**

Run: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`
Expected: all pass. `AleTrack.Seeding` has no tests; this step guards against having broken the shared projects.

- [ ] **Step 4: Commit**

```bash
git add api/AleTrack/AleTrack.Seeding/Builders/HistoryBuilder.cs
git commit -m "fix(seeding): snapshot content on the generated historical runs"
```

---

## Final verification

- [ ] `cd api/AleTrack && dotnet build AleTrack.sln` — 0 errors
- [ ] `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` — full suite green; note the count against the 459 that passed after part B
- [ ] `git status` — no change to `app/` at all, and `appsettings.*.json`, `Program.cs`, `launchSettings.json`, `d.txt`, `r.txt`, `r2.txt` and the untracked `app/src` work still unstaged
- [ ] Confirm the migration's `Up` contains both the schema changes and the two backfill `Sql` calls, and that `Down` drops the table and columns

### Deferred to manual verification

The backfill SQL cannot be exercised by the mocked-DbContext suite. Before calling part C done, against the local Postgres:

```bash
cd api/AleTrack && docker compose up -d
cd AleTrack && dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"
```

Then check that the inserted row count matches the source query:

```sql
SELECT count(*) FROM outgoing_shipment_stop_items;
SELECT count(*) FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN outgoing_shipment_stops s ON s.id = o.outgoing_shipment_stop_id
JOIN outgoing_shipments sh ON sh.id = s.outgoing_shipment_id
WHERE s.kind = 0 AND sh.state IN (1, 2, 3, 4);
```

and that no order stop on a past run was left without attribution:

```sql
SELECT count(*) FROM outgoing_shipment_stops s
JOIN outgoing_shipments sh ON sh.id = s.outgoing_shipment_id
WHERE s.kind = 0 AND sh.state IN (1, 2, 3, 4) AND s.client_public_id IS NULL;
```

Expected: the two counts equal, and the third zero.
