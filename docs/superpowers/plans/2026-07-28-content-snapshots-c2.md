# Content Snapshots C2 — Billing Owns Its History

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop issued invoices and the incoming-deliveries chart from reading the current product row, so repricing or renaming a product no longer restates what was billed.

**Architecture:** `outgoing_shipment_invoice_lines` gains its own snapshot of the billed product's name, kind, package size and applied unit prices — it is its own historical record, billing a fraction of an item to a particular client, which is why it already snapshots `Quantity`. The reconciler writes that snapshot from a state-determined source: the live product while the run is `Created`, the C1 stop item once it is `Loaded`. Separately, `delivery_items` gains the three weight inputs so the Operations chart's incoming half stops reading products live.

**Tech Stack:** .NET 10, FastEndpoints, EF Core + Npgsql (Postgres 17), xUnit + FluentAssertions + Moq.EntityFrameworkCore. Frontend: React 19, Vite 6, MUI 7, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-28-content-snapshots-design.md`
**Predecessor:** `docs/superpowers/plans/2026-07-28-content-snapshots-c1.md` (shipped)

## Global Constraints

- Backend commands run from `api/AleTrack/`. Build: `dotnet build AleTrack.sln`. Test: `dotnet test AleTrack.Tests/AleTrack.Tests.csproj`.
- Tests are pure unit tests over a mocked DbContext (`AleTrackDbContextMockFactory.CreateMock(...)`). No database is available to the suite.
- Code comments in **English only**; user-visible frontend strings in **Czech**.
- **No request or response DTO shape changes, so no `yarn generate-api` in C2.** `app/src/generated/api-client.ts` is already modified in the working tree by concurrent work — leave it exactly as it is and never stage it.
- The working tree contains substantial unrelated in-progress work (inventory panel, `ProductCombobox`, `ProductOrdering`, product sorting, `app/src/dbg.test.tsx`). **Stage only the files each task names.** Never stage `appsettings.*.json`, `Program.cs`, `launchSettings.json`, `d.txt`, `r.txt`, `r2.txt`.
- Enums are stored as `integer`. `OutgoingShipmentState`: Created 0, Loaded 1, InTransit 2, Delivered 3, Cancelled 4. `InvoiceLineSourceKind`: confirm the member order in `Common/Enums/` before writing backfill SQL against it.
- `UPDATE … FROM` in Postgres cannot see the update target inside the FROM join tree — filter on it with `EXISTS`, not a join. The C1 migration hit exactly this (42P01); follow the corrected form in `20260728122839_ShipmentContentSnapshots.cs:135-150`.
- Baseline at the start of C2: **491 tests passing**, build clean.
- Branch: `feat/25-history-integrity-guards`.

## Decision this plan makes beyond the approved spec

`ShipmentInvoiceMapper` was refactored after the spec was approved: it now sorts lines through `ProductOrdering.Compare` using `Type`, `PlatoDegree` and `PackageSize` read off `item.Product`. That created a question the spec does not answer — which of those follow the snapshot?

The plan applies the spec's own principle, *snapshot facts, read presentation live*:

| Value | Source | Why |
|---|---|---|
| `Name`, `Kind`, `PackageSize`, `PriceWithVat` | the line's snapshot | displayed on the invoice; facts about what was billed |
| `Type`, `PlatoDegree` | the live product | sort keys only, never rendered on an invoice line — ordering is presentation, like brewery colour in C1 |

So `PackageSize` comes from the snapshot in both roles (it is displayed *and* sorted on), and the two sort-only keys stay live. A corrected degree therefore re-sorts an old invoice, which is harmless; a corrected price does not restate it, which is the point.

---

### Task 1: Invoice line snapshot columns

**Files:**
- Modify: `api/AleTrack/AleTrack/Entities/OutgoingShipmentInvoiceLine.cs`
- Create: migration `<stamp>_InvoiceLineSnapshots.cs` (generated, then hand-edited to add the backfill)

**Interfaces:**
- Consumes: nothing.
- Produces: `OutgoingShipmentInvoiceLine.ProductName` (string), `.Kind` (`ProductKind?`), `.PackageSize` (double?), `.UnitPriceWithVat` (decimal?), `.UnitPriceWithoutVat` (decimal?). Tasks 2 and 3 consume these.

- [ ] **Step 1: Add the columns to the entity**

In `Entities/OutgoingShipmentInvoiceLine.cs`, after the `Quantity` property:

```csharp
    /// <summary>
    /// Name of what was billed, as it was when the line was drawn up. For a
    /// <see cref="InvoiceLineSourceKind.CustomExtraItem"/> line this is the extra's description.
    /// </summary>
    /// <remarks>
    /// The line does not simply point at the run's stop item, because it is its own historical
    /// record: it bills a fraction of an item to a particular client, which is why
    /// <see cref="Quantity"/> is already snapshotted here rather than read from the source.
    /// Repricing a product used to restate every invoice that ever contained it.
    /// </remarks>
    [MaxLength(100)]
    [Column("product_name")]
    public string ProductName { get; set; } = string.Empty;

    /// <summary>
    /// Product kind as it was when the line was drawn up. Null for a custom extra, which has no
    /// product at all.
    /// </summary>
    [Column("kind")]
    public ProductKind? Kind { get; set; }

    /// <summary>
    /// Container volume in litres as it was when the line was drawn up. Null for a custom extra.
    /// </summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>
    /// Unit price with VAT actually applied to this line. Null for a custom extra, which carries
    /// no price today.
    /// </summary>
    /// <remarks>
    /// The <em>applied</em> price, deliberately separate from the product's current one: when
    /// client-specific price overrides arrive, the rule stays live and relational while the
    /// resolved price freezes here, on the line it was charged on.
    /// </remarks>
    [Column("unit_price_with_vat")]
    public decimal? UnitPriceWithVat { get; set; }

    /// <summary>
    /// Unit price without VAT actually applied to this line. Null for a custom extra.
    /// </summary>
    [Column("unit_price_without_vat")]
    public decimal? UnitPriceWithoutVat { get; set; }
```

Add `using System.ComponentModel.DataAnnotations;` if it is not already imported (the file has `System.ComponentModel.DataAnnotations.Schema` for `[Column]`, which is a different namespace).

`ProductName` is `MaxLength(100)` rather than the products table's 50 because a custom extra's description is `MaxLength(200)` on `OrderCustomExtraItem` — 100 covers every real description while keeping the column narrow. Truncation is handled in Task 2.

- [ ] **Step 2: Generate the migration**

```bash
cd api/AleTrack/AleTrack && dotnet ef migrations add InvoiceLineSnapshots
```

Expected `Up`: five `AddColumn` calls on `outgoing_shipment_invoice_lines`, all nullable except `product_name`, which is non-nullable with a `""` default.

- [ ] **Step 3: Append the backfill**

At the end of the generated `Up`:

```csharp
            // Backfill from values live right now — the same limitation, stated the same way, as
            // the C1 stop-item backfill: pre-migration invoices reflect product values as of this
            // migration rather than as of issue. The read path has no fallback, so this is what
            // keeps historical lines rendering at all.
            //
            // Order-item lines take the product's facts; custom-extra lines take the extra's
            // description and keep null prices, which is what the mapper already returned for
            // them.
            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_invoice_lines l
                SET product_name = left(p.name, 100),
                    kind = p.kind,
                    package_size = p.package_size,
                    unit_price_with_vat = p.price_with_vat,
                    unit_price_without_vat = p.price_without_vat
                FROM order_items oi
                JOIN products p ON p.id = oi.product_id
                WHERE l.order_item_id = oi.id;
                """);

            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_invoice_lines l
                SET product_name = left(e.description, 100)
                FROM order_custom_extra_items e
                WHERE l.custom_extra_item_id = e.id;
                """);
```

Both filter on the update target only through its own columns, so neither needs the `EXISTS` workaround.

The custom-extra table is `order_custom_extra_items`, confirmed against `AleTrackDbContextModelSnapshot.cs:731`.

- [ ] **Step 4: Build and run the full suite**

```bash
cd api/AleTrack && dotnet build AleTrack.sln && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```
Expected: 0 errors, all 491 still passing. Nothing reads or writes the new columns yet.

- [ ] **Step 5: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/OutgoingShipmentInvoiceLine.cs \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/
git commit -m "feat(invoicing): give invoice lines their own product snapshot"
```

---

### Task 2: The reconciler writes the snapshot

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentInvoiceReconciler.cs` (`BillableSource` at line 76, `CollectSources` at line 265, `BuildLine` at line 359)
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentInvoiceReconcilerTests.cs` (extend; create if absent)

**Interfaces:**
- Consumes: the columns from Task 1; `OutgoingShipmentStop.Items` and `OutgoingShipmentStopItem` from C1.
- Produces: `BillableSource` gains `ProductName`, `Kind`, `PackageSize`, `UnitPriceWithVat`, `UnitPriceWithoutVat`; every line the reconciler builds carries them. Task 3 reads them off the line.

- [ ] **Step 1: Write the failing tests**

`ShipmentInvoiceReconcilerTests.cs` already exists — read its fixture helpers and follow them. The five cases:

```csharp
    /// <summary>
    /// While the run is still being planned the live product is the current truth, so that is
    /// what a new line records.
    /// </summary>
    [Fact]
    public void Reconcile_CreatedShipment_SnapshotsFromTheLiveProduct()
    {
        // Arrange a Created shipment with one order item priced 11.49, no stop items, no invoices.
        // Act: Reconcile.
        // Assert the built line's ProductName / UnitPriceWithVat / Kind / PackageSize match the
        // product.
    }

    /// <summary>
    /// From Loaded onward the run's own snapshot is the truth, and the product may already have
    /// moved on.
    /// </summary>
    [Fact]
    public void Reconcile_LoadedShipment_SnapshotsFromTheStopItem()
    {
        // Arrange a Loaded shipment whose stop carries a stop item recording 11.49, while the
        // live product now says 99. No invoices yet.
        // Act: Reconcile.
        // Assert the built line records 11.49, not 99.
    }

    /// <summary>
    /// Refreshing while Created keeps a planned run's invoices in step with a price correction;
    /// from Loaded onward the line is frozen.
    /// </summary>
    [Fact]
    public void Reconcile_LoadedShipment_DoesNotRefreshAnExistingLine()
    {
        // Arrange a Loaded shipment with an existing line recording 11.49 and a stop item now
        // recording 99 (as if the snapshot were rebuilt).
        // Act: Reconcile.
        // Assert the line still records 11.49.
    }

    [Fact]
    public void Reconcile_CreatedShipment_RefreshesAnExistingLine()
    {
        // Same shape, shipment in Created, product now 99: the line must move to 99.
    }

    [Fact]
    public void Reconcile_CustomExtraLine_SnapshotsTheDescriptionAndNoPrice()
    {
        // Assert ProductName is the extra's description and both prices are null.
    }
```

Fill each body from the existing file's fixture helpers rather than inventing new ones.

- [ ] **Step 2: Run to verify they fail**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentInvoiceReconcilerTests"
```
Expected: the snapshot assertions FAIL — nothing populates the columns.

- [ ] **Step 3: Carry the snapshot facts on `BillableSource`**

`BillableSource` already carries `Name`. Widen it, replacing that property:

```csharp
        /// <summary>
        /// What to record on a line billing this source: its name and, for an order item, the
        /// product facts and applied prices.
        /// </summary>
        /// <remarks>
        /// Resolved once here rather than at line-build time because the correct source depends on
        /// the run's state — the live product while it is Created, the run's own stop item from
        /// Loaded onward — and <c>CollectSources</c> is the only place with both in scope.
        /// </remarks>
        public LineSnapshot Snapshot { get; init; } = LineSnapshot.Empty;
```

and add the record next to it:

```csharp
    /// <summary>
    /// The product facts a new invoice line records.
    /// </summary>
    private sealed record LineSnapshot(
        string ProductName,
        ProductKind? Kind,
        double? PackageSize,
        decimal? UnitPriceWithVat,
        decimal? UnitPriceWithoutVat)
    {
        public static readonly LineSnapshot Empty = new(string.Empty, null, null, null, null);
    }
```

Every existing read of `source.Name` must move to `source.Snapshot.ProductName` — grep for `.Name` within the file and update each; the adjustment reporting (`InvoiceAdjustment.ItemName`) is one of them.

- [ ] **Step 4: Resolve the right source in `CollectSources`**

`CollectSources` already walks `shipment.Stops` and has the stop in scope, so it can reach the stop item. Inside the order-item loop:

```csharp
                // Created means the product is still the current truth and no stop items exist
                // yet; from Loaded onward the run's own snapshot is what the line must agree with.
                var stopItem = ShipmentMutability.IsContentEditable(shipment.State)
                    ? null
                    : stop.Items.FirstOrDefault(si => si.OrderItemId == item.Id);

                var snapshot = stopItem is not null
                    ? new LineSnapshot(
                        stopItem.ProductName,
                        stopItem.Kind,
                        stopItem.PackageSize,
                        stopItem.UnitPriceWithVat,
                        stopItem.UnitPriceWithoutVat)
                    : new LineSnapshot(
                        Truncate(item.Product?.Name),
                        item.Product?.Kind,
                        item.Product?.PackageSize,
                        item.Product?.PriceWithVat,
                        item.Product?.PriceWithoutVat);
```

and set `Snapshot = snapshot` on the `BillableSource`. For the custom-extra sources built further down:

```csharp
                    Snapshot = new LineSnapshot(Truncate(extra.Description), null, null, null, null),
```

Add the helper, since `product_name` is 100 chars and a description may be 200:

```csharp
    /// <summary>
    /// Fits a name into the snapshot column. A custom extra's description may be 200 characters
    /// where the column holds 100; truncating beats failing the save.
    /// </summary>
    private static string Truncate(string? name) =>
        name is null ? string.Empty : name.Length <= 100 ? name : name[..100];
```

`ShipmentMutability` lives in the same namespace, so no new using is needed.

- [ ] **Step 5: Write the snapshot in `BuildLine`, and refresh while `Created`**

In `BuildLine`, after `Quantity = quantity`:

```csharp
            ProductName = source.Snapshot.ProductName,
            Kind = source.Snapshot.Kind,
            PackageSize = source.Snapshot.PackageSize,
            UnitPriceWithVat = source.Snapshot.UnitPriceWithVat,
            UnitPriceWithoutVat = source.Snapshot.UnitPriceWithoutVat
```

Then, where `Reconcile` walks the lines that already exist for a source (the quantity-adjustment path), refresh them only while the run is editable:

```csharp
        // A planned run's invoices should follow a price correction; an issued one must not. The
        // boundary is the same one that freezes shipment content.
        if (ShipmentMutability.IsContentEditable(shipment.State))
            Refresh(existingLine, source.Snapshot);
```

with

```csharp
    private static void Refresh(OutgoingShipmentInvoiceLine line, LineSnapshot snapshot)
    {
        line.ProductName = snapshot.ProductName;
        line.Kind = snapshot.Kind;
        line.PackageSize = snapshot.PackageSize;
        line.UnitPriceWithVat = snapshot.UnitPriceWithVat;
        line.UnitPriceWithoutVat = snapshot.UnitPriceWithoutVat;
    }
```

Read `Reconcile` before placing this — put the call where existing lines for a matched source are already being visited, so it runs once per line and not once per source.

Reconciliation runs on read and `GetShipmentInvoicesEndpoint.cs:77` already saves what it changed, so refreshing here adds no new write-on-GET.

- [ ] **Step 6: Run the full suite**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```
Expected: all pass, including the five new cases.

- [ ] **Step 7: Prove the freeze test earns its place**

Change the refresh guard to unconditional (`Refresh(existingLine, source.Snapshot);` with no `if`), run the filter, and confirm `Reconcile_LoadedShipment_DoesNotRefreshAnExistingLine` fails. Revert.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Utils/ShipmentInvoiceReconciler.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/
git commit -m "feat(invoicing): record the billed product on each invoice line"
```

---

### Task 3: The mapper reads the snapshot

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Invoices/ShipmentInvoiceMapper.cs` (`FromOrderItem`, `FromCustomExtra`)
- Test: `api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/ShipmentInvoiceEndpointsTests.cs` — there is no separate mapper test class; invoice mapping is covered through the endpoint here.

**Interfaces:**
- Consumes: the line columns from Task 1, populated by Task 2.
- Produces: nothing for later tasks.

**Existing test that encodes the old behaviour:** `GetInvoices_LinesCarryProductDetailAndPrice` (line 55) asserts a line carries the product's detail and price — the live read this task removes. It must be revisited rather than worked around: either its fixture starts populating the line's snapshot (if it builds lines by hand) or it starts driving reconciliation (which now populates them). Whichever it is, the assertion should end up naming the snapshot as the source. **Do not weaken it to make it pass.**

- [ ] **Step 1: Write the headline regression test**

```csharp
    /// <summary>
    /// The billing correctness bug from #25. Correcting the Svijany seed data on 2026-07-28 moved
    /// Svijanský Vozka from 12.09 to 11.49, and every historical invoice containing it changed
    /// with it. Nothing flagged that.
    /// </summary>
    [Fact]
    public void ToDto_RepricingTheProduct_DoesNotRestateAnIssuedInvoice()
    {
        // Arrange a Delivered shipment with one invoice line snapshotting 11.49 while the live
        // product now says 99.
        // Act: ShipmentInvoiceMapper.ToDto(split, reconcileResult).
        // Assert the line's PriceWithVat is 11.49 and its Name is the snapshotted one.
    }

    [Fact]
    public void ToDto_RenamingTheProduct_DoesNotRestateAnIssuedInvoice()
    {
        // Same shape, asserting Name and Kind/PackageSize follow the snapshot.
    }

    /// <summary>
    /// Sort-only keys stay live: ordering is presentation, so a corrected degree may re-sort an
    /// old invoice. What must not move is what the line says was billed.
    /// </summary>
    [Fact]
    public void ToDto_OrdersLinesByLiveProductType_WhileDisplayingSnapshottedFacts()
    {
        // Two lines whose live products sort one way and whose snapshotted names sort the other;
        // assert the order follows ProductOrdering over the live Type/PlatoDegree and the
        // rendered names are the snapshotted ones.
    }

    [Fact]
    public void ToDto_CustomExtraLine_ShowsTheSnapshottedDescriptionAndNoPrice()
    {
        // Assert Name is the line's ProductName, PriceWithVat and Kind are null.
    }
```

- [ ] **Step 2: Run to verify the first two fail**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~ShipmentInvoiceMapperTests"
```
Expected: the reprice and rename cases FAIL, reading 99 and the new name off the live product.

- [ ] **Step 3: Read the displayed facts off the line**

In `FromOrderItem`, the DTO currently reads four values from `item.Product`. Replace those four:

```csharp
            // Displayed facts come from the line's own snapshot: repricing or renaming a product
            // must not restate an invoice that was already issued.
            Name = line.ProductName,
            Kind = line.Kind,
            PackageSize = line.PackageSize,
            PriceWithVat = line.UnitPriceWithVat,
```

`ProductId` keeps reading `item.Product?.PublicId` — it is a provenance link the UI uses to navigate, not a displayed fact.

The `SortedLine` the method returns keeps `Type` and `PlatoDegree` from `item.Product` (sort-only, presentation), but takes `PackageSize` from the line so the value it sorts on is the value it shows:

```csharp
        return new SortedLine(
            dto,
            item.Product?.Type ?? ProductType.Other,
            item.Product?.PlatoDegree,
            line.PackageSize);
```

In `FromCustomExtra`, replace `Name = extra.Description` with `Name = line.ProductName` and leave the nulls as they are. Update its comment to say the description now travels on the line.

- [ ] **Step 4: Run the full suite**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```
Expected: all pass. Existing invoice tests that build lines by hand may now assert on an empty `Name` — set `ProductName` on those fixture lines rather than weakening the assertion.

- [ ] **Step 5: Commit**

```bash
git add api/AleTrack/AleTrack/Features/OutgoingShipments/Queries/Invoices/ShipmentInvoiceMapper.cs \
        api/AleTrack/AleTrack.Tests/Features/OutgoingShipments/
git commit -m "fix(invoicing): show what was billed, not what the product costs now"
```

---

### Task 4: Delivery-item weight inputs

**Files:**
- Modify: `api/AleTrack/AleTrack/Entities/DeliveryItem.cs`
- Create: `api/AleTrack/AleTrack/Features/ProductDeliveries/Utils/DeliveryItemSnapshot.cs`
- Modify: `api/AleTrack/AleTrack/Features/ProductDeliveries/Commands/Create/CreateProductsDeliveryEndpoint.cs:115,221`
- Modify: `api/AleTrack/AleTrack/Features/ProductDeliveries/Commands/Update/UpdateProductDeliveryEndpoint.cs:182`
- Create: migration `<stamp>_DeliveryItemWeightInputs.cs` (generated, then hand-edited)
- Test: `api/AleTrack/AleTrack.Tests/Features/ProductDeliveries/DeliveryItemSnapshotTests.cs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `DeliveryItem.Kind` (`ProductKind`), `.PackageSize` (double?), `.UnitsPerPackage` (int); `static DeliveryItemSnapshot.Apply(DeliveryItem item, Product product)`. Task 5 reads the columns.

- [ ] **Step 1: Add the columns**

In `Entities/DeliveryItem.cs`, after `Quantity`:

```csharp
    /// <summary>Product kind as it was when this line was booked in. Weight input.</summary>
    /// <remarks>
    /// The Operations report's incoming-versus-outgoing chart derives a weight from these three,
    /// and the outgoing half already reads a snapshot. Leaving this side live would have left one
    /// series moving under a product edit while the other stayed put.
    /// </remarks>
    [Column("kind")]
    public ProductKind Kind { get; set; }

    /// <summary>Container volume in litres as it was when this line was booked in. Weight input.</summary>
    [Column("package_size")]
    public double? PackageSize { get; set; }

    /// <summary>Containers per sellable unit as it was when this line was booked in. Weight input.</summary>
    [Column("units_per_package")]
    public int UnitsPerPackage { get; set; } = 1;
```

Add `using AleTrack.Common.Enums;` if absent.

- [ ] **Step 2: Write the failing test**

```csharp
using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Utils;
using AleTrack.Tests.Builders;
using FluentAssertions;

namespace AleTrack.Tests.Features.ProductDeliveries;

public sealed class DeliveryItemSnapshotTests
{
    [Fact]
    public void Apply_CopiesTheWeightInputs()
    {
        var product = ProductBuilder.BuildEntity(kind: ProductKind.Bottle, packageSize: 0.5);
        product.UnitsPerPackage = 20;
        var item = new DeliveryItem { Product = product, Quantity = 4 };

        DeliveryItemSnapshot.Apply(item, product);

        item.Kind.Should().Be(ProductKind.Bottle);
        item.PackageSize.Should().Be(0.5);
        item.UnitsPerPackage.Should().Be(20);
    }

    [Fact]
    public void Apply_IsIndependentOfLaterProductEdits()
    {
        var product = ProductBuilder.BuildEntity(kind: ProductKind.Bottle, packageSize: 0.5);
        product.UnitsPerPackage = 20;
        var item = new DeliveryItem { Product = product, Quantity = 4 };

        DeliveryItemSnapshot.Apply(item, product);
        product.PackageSize = 10;
        product.UnitsPerPackage = 1;

        item.PackageSize.Should().Be(0.5);
        item.UnitsPerPackage.Should().Be(20);
    }
}
```

- [ ] **Step 3: Run to verify it fails**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~DeliveryItemSnapshotTests"
```
Expected: compile error — `DeliveryItemSnapshot` does not exist.

- [ ] **Step 4: Implement the helper**

```csharp
using AleTrack.Entities;

namespace AleTrack.Features.ProductDeliveries.Utils;

/// <summary>
/// Records the weight inputs of the product a delivery line books in.
/// </summary>
/// <remarks>
/// Written whenever the line is written. One helper rather than three inline copies, because the
/// create endpoint builds delivery items in two places and the update endpoint in a third —
/// duplicating the copy is how one of them ends up forgotten.
/// </remarks>
public static class DeliveryItemSnapshot
{
    public static void Apply(DeliveryItem item, Product product)
    {
        item.Kind = product.Kind;
        item.PackageSize = product.PackageSize;
        item.UnitsPerPackage = product.UnitsPerPackage;
    }
}
```

- [ ] **Step 5: Call it at all three construction sites**

Each site builds a `DeliveryItem` inside a `Select` or a loop with the resolved product in hand. Convert each object initializer to set the three fields directly rather than calling `Apply` from inside an expression-bodied `Select` — for the two `Select` sites, replace

```csharp
                    .Select(p => new DeliveryItem
                    {
                        Product = relatedProducts.First(rp => rp.PublicId == p.ProductId),
                        Quantity = p.Quantity,
                        Note = p.Note
                    })
```

with

```csharp
                    .Select(p =>
                    {
                        var product = relatedProducts.First(rp => rp.PublicId == p.ProductId);
                        var item = new DeliveryItem
                        {
                            Product = product,
                            Quantity = p.Quantity,
                            Note = p.Note
                        };
                        DeliveryItemSnapshot.Apply(item, product);
                        return item;
                    })
```

adjusting the product-lookup expression per site (`relatedProducts` in the create endpoint, `products` in the update endpoint). For the loop site at `CreateProductsDeliveryEndpoint.cs:221`, add `DeliveryItemSnapshot.Apply(item, relatedProduct);` after constructing the item into a local and before `deliveryItems.Add(item)`.

Add `using AleTrack.Features.ProductDeliveries.Utils;` to both endpoints.

- [ ] **Step 6: Generate the migration and append the backfill**

```bash
cd api/AleTrack/AleTrack && dotnet ef migrations add DeliveryItemWeightInputs
```

Then at the end of `Up`:

```csharp
            // Backfill from values live right now, as with the other snapshots in this work.
            migrationBuilder.Sql("""
                UPDATE delivery_items di
                SET kind = p.kind,
                    package_size = p.package_size,
                    units_per_package = p.units_per_package
                FROM products p
                WHERE di.product_id = p.id;
                """);
```

- [ ] **Step 7: Run the full suite**

```bash
cd api/AleTrack && dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```
Expected: all pass. Existing `ProductDeliveries` tests assert on quantities and notes, not the new columns, so they should be unaffected.

- [ ] **Step 8: Commit**

```bash
git add api/AleTrack/AleTrack/Entities/DeliveryItem.cs \
        api/AleTrack/AleTrack/Features/ProductDeliveries \
        api/AleTrack/AleTrack/Infrastructure/Persistence/Migrations/ \
        api/AleTrack/AleTrack.Tests/Features/ProductDeliveries
git commit -m "feat(deliveries): record the weight inputs on each booked-in line"
```

---

### Task 5: The Operations chart reads the delivery snapshot

**Files:**
- Modify: `api/AleTrack/AleTrack/Features/Reports/Queries/Operations/GetOperationsEndpoint.cs:105-113`
- Modify: `api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs` (`WithIncomingDelivery`)
- Test: `api/AleTrack/AleTrack.Tests/Features/Reports/OperationsReportTests.cs`

**Interfaces:**
- Consumes: `DeliveryItem.Kind`, `.PackageSize`, `.UnitsPerPackage` (Task 4); `DeliveryItemSnapshot.Apply` (Task 4).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `OperationsReportTests.cs`:

```csharp
    /// <summary>
    /// The incoming half of the chart must hold as still as the outgoing half, or one series moves
    /// under a product edit while the other stays put.
    /// </summary>
    [Fact]
    public async Task HandleAsync_IncomingWeights_DoNotFollowLaterProductEdits()
    {
        // Build a fixture with WithIncomingDelivery, read the report, then change the delivered
        // product's PackageSize and UnitsPerPackage and read it again. IncomingWeightKg must match.
    }
```

Follow the existing fixture and assertion style in that file.

- [ ] **Step 2: Teach the fixture to snapshot the incoming line**

In `DeliveredShipmentBuilder.WithIncomingDelivery`, after the `DeliveryItem` is constructed:

```csharp
        // Booking a line in records the product's weight inputs; the report reads nothing else.
        DeliveryItemSnapshot.Apply(item, product);
```

Add the using. Without this the new test passes vacuously — every weight would read zero on both sides.

- [ ] **Step 3: Run to verify it fails**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj --filter "FullyQualifiedName~OperationsReportTests"
```
Expected: the new test FAILS, the second read differing from the first.

- [ ] **Step 4: Read the snapshot**

In `GetOperationsEndpoint`, the incoming projection reads `di.Product.Kind`, `di.Product.PackageSize` and `di.Product.UnitsPerPackage`. Replace those three with `di.Kind`, `di.PackageSize`, `di.UnitsPerPackage`, and extend the comment above the query:

```csharp
            // Reads the line's own recorded weight inputs rather than the product's current ones,
            // matching the outgoing half — DeliveredLineQuery reads the run's snapshot. The
            // formula stays live on both sides, so correcting it still moves history.
```

- [ ] **Step 5: Run the full suite**

```bash
dotnet test AleTrack.Tests/AleTrack.Tests.csproj
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add api/AleTrack/AleTrack/Features/Reports/Queries/Operations/GetOperationsEndpoint.cs \
        api/AleTrack/AleTrack.Tests/Builders/DeliveredShipmentBuilder.cs \
        api/AleTrack/AleTrack.Tests/Features/Reports/OperationsReportTests.cs
git commit -m "fix(reports): read incoming weights from the booked line, not the live product"
```

---

### Task 6: Say so in the product form

**Files:**
- Modify: `app/src/features/breweries/ProductFormDrawer.tsx` (the `FormDrawer` body, around line 123-189)
- Test: `app/src/features/breweries/ProductFormDrawer.test.tsx` (create)

**Interfaces:**
- Consumes: the `editing` boolean already computed in the component.
- Produces: nothing.

The behaviour changed under the user's feet: editing a product used to restate history and now does not. A line in the form is what makes that legible.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { theme } from 'src/theme/theme';
import { ProductFormDrawer } from './ProductFormDrawer';

describe('ProductFormDrawer', () => {
  it('says an edit will not reach issued invoices or past reports', () => {
    // Render with editing (a product supplied) and assert the note is present.
  });

  it('shows no such note when creating a product', () => {
    // Render without a product and assert the note is absent.
  });
});
```

Read `ProductFormDrawer`'s props (line 66) and `FormDrawer`'s API before filling these in — the drawer likely needs `open`, `onClose` and `onSubmit`, and MUI drawers render into a portal, so `screen` rather than the render result is the right query root.

- [ ] **Step 2: Run to verify it fails**

```bash
cd app && yarn test:run ProductFormDrawer
```
Expected: FAIL — the note is not rendered.

- [ ] **Step 3: Add the note**

Inside the `FormDrawer` body, after the last `Stack` of fields and before the closing tag:

```tsx
      {editing && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Změna se nepromítne do vystavených faktur ani do historie reportů — ty nesou údaje
          platné v době vývozu.
        </Typography>
      )}
```

`Typography` is already imported. Deliberately unconditional on usage rather than gated behind an in-use check: the statement is true of every product, and a usage count would mean a DTO change and a codegen run for no extra information.

- [ ] **Step 4: Run the frontend checks**

```bash
cd app && yarn test:run --exclude "src/dbg.test.tsx" && yarn build
```
Expected: green. `src/dbg.test.tsx` is untracked scratch work that already fails on `dev`; excluding it is not covering anything up. Confirm `git status` shows no change to `src/generated/api-client.ts` beyond what the working tree already had.

- [ ] **Step 5: Commit**

```bash
git add app/src/features/breweries/ProductFormDrawer.tsx \
        app/src/features/breweries/ProductFormDrawer.test.tsx
git commit -m "feat(products): say that editing a product leaves history alone"
```

---

## Final verification

- [ ] `cd api/AleTrack && dotnet build AleTrack.sln` — 0 errors
- [ ] `dotnet test AleTrack.Tests/AleTrack.Tests.csproj` — green; note the count against the 491 at the start of C2
- [ ] `cd app && yarn test:run --exclude "src/dbg.test.tsx" && yarn build` — green
- [ ] `git status` — the unrelated in-progress work (inventory, `ProductCombobox`, `ProductOrdering`, product sorting, `api-client.ts`, `d.txt`/`r.txt`/`r2.txt`) still unstaged and unmodified by this work
- [ ] Both new migrations contain their backfill `Sql` calls, and no `UPDATE … FROM` references the update target inside a join

### Deferred to manual verification

The two backfills cannot be exercised by the mocked-DbContext suite. Against the local Postgres:

```bash
cd api/AleTrack && docker compose up -d
cd AleTrack && dotnet ef database update --connection "Host=localhost;Port=5432;Database=AleTrack;Username=postgres;Password=postgres"
```

Then confirm no historical line was left blank:

```sql
SELECT count(*) FROM outgoing_shipment_invoice_lines WHERE product_name = '';
SELECT count(*) FROM delivery_items WHERE kind IS NULL;
```

Expected: both zero. A non-zero first count means a line whose `order_item_id` and `custom_extra_item_id` are both null, which reconciliation should make impossible — worth investigating rather than patching.

## After C2

Issue #25 is then closed in full: A (product retirement), B (record freezing), C1 (report history), C2 (billing and incoming history). Worth noting in the issue when closing that two of its proposals were deliberately dropped — the 1:N `Order`⇄`Stop` widening and the `client_order_id` foreign key — because the stop owning its content made both unnecessary.

Follow-ups this work deliberately left alone:

- `IsShipmentLoadingConfirmed`, `QuantityFromInventory` and `InventoryItemId` still live on `order_items` though they describe the loading a run is doing.
- Brewery soft-delete, for symmetry with products; the `RESTRICT` foreign key already prevents the data loss.
- Client-specific price overrides, which the spec's separation of the live rule from the frozen applied price was designed to accommodate: `outgoing_shipment_invoice_lines.unit_price_with_vat` is now the place the resolved price lands.
