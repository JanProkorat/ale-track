# Price-list import, packaging remodel, seeder refresh

**Date:** 2026-08-10
**Status:** approved design, not yet planned

## Problem

Three things are wrong at once, and they share a root.

**Prices are stale and hand-maintained.** `AleTrack.Seeding/Builders/` holds ~3550 lines of
hand-written `new Product { … }` literals across `SvijanyProductsBuilder.cs` (1600),
`PrimatorProductsBuilder.cs` (1333) and `RohozecProductsBuilder.cs` (617), each with prices baked
into the source. They have drifted: the seeder prices Svijanská Desítka's crate at 296,00 Kč
(12,23 Kč/unit) while the brewery's list valid from 1 May 2026 says 318,00 Kč (13,14 Kč/unit).
There is no way to refresh them but to retype them, and no record of which price list any number
came from.

**Packaging is ambiguous.** `ProductKind.Bottle` renders as **"Basa"** (`app/src/lib/labels.ts:33`),
so a single 2 l container displays as a crate. `PackageSize` is named like a package but holds the
volume of one container. `UnitsPerPackage` is not entered at all — `ProductUnitsResolver` derives it
from a hardcoded crate table (0.5 → 20, 0.33 → 24, everything else → 1) and, for multipacks and
cans, from **regexes over the product name** ("Prim. Premium 8x", "6 piv"). `BottleSize` declares a
`TenLiters` bottle and `CanSize` a `TwoLiters` can.

**"2 l" means two different products.** The Svijany list has a `PLECHOVKY 2L` section — genuine 2 l
cans priced *za kus* — and a separate `DEKORATIVNÍ LAHVE, DŽBÁNY` section of 1 l and 2 l glass jugs.
The current model can only tell them apart via `Kind = Can` vs `Kind = Bottle`, and the second then
renders as "Basa".

## Sources

| Brewery | Document | Status |
|---|---|---|
| Svijany | `pivovarsvijany.cz/file/2336`, valid from 1 May 2026 | official, current, published by the brewery |
| Rohozec | `pivojede.cz/…/Ceník Rohozec od 1.05.2024 bez sl..pdf`, valid from 1 May 2024 | official but **two years old**, mirrored by a distributor; not on the brewery's own site |
| Primátor | none | publishes no price list; only retail e-shop and reseller catalogues |

Both available PDFs extract cleanly with `pdftotext -layout`.

## Decisions taken

1. **PDFs are converted offline into a committed catalog file.** The application never parses a PDF.
   Svijany's list is a two-column InDesign export whose bottle and keg rows interleave; in-app
   extraction would be brittle and would fail silently on a layout change, which for price data is
   the worst failure mode available.
2. **Products missing from an imported list are proposed for removal, never removed silently.** The
   user confirms in a preview. Items with stock on hand or on an open order are reported but kept.
3. **Container and sale unit are modelled separately.** One row per sellable thing; no normalisation
   into beer + variants (that would re-point `OrderItem`, inventory, shipment items, invoice lines
   and reports at a new FK — a far larger change than the problem warrants).
4. **Price refresh covers Svijany and Rohozec only.** Primátor keeps its current prices.
5. **An import records its provenance** — which brewery, which list, which effective date.
6. **Applying an import reprices open, unshipped orders.** This needs no code:
   `OutgoingShipmentStopItem` and `OutgoingShipmentInvoiceLine` already snapshot
   `unit_price_with_vat` / `unit_price_without_vat` at load and invoice time, so shipped and invoiced
   history is frozen. `OrderItem` carries no price column, so an unshipped order naturally follows
   the product's current price.

### Note on decision 4

Primátor cannot be left literally untouched. Renaming `PackageSize` and adding `Container` /
`SaleUnit` means `PrimatorProductsBuilder.cs` will not compile until its 1333 lines are updated. It
therefore receives a **mechanical, price-preserving field migration**: new field names, identical
prices, no provenance row, no claim of currency.

### Note on decision 1 and Rohozec

Rohozec's 2024 CSV belongs in the repo for seeding, but should not be applied to a production
catalog — it would reprice live products to two-year-old numbers. Production waits for a current
list from `pivorohozec@pivorohozec.cz`.

## Packaging model

Three persisted fields replace the overloaded pair, and `UnitsPerPackage` stops being guessed.

```
Container              ProductContainer   Keg | Bottle | Can | Jug | Other
ContainerVolumeLiters  double?            volume of ONE container (renamed from PackageSize)
SaleUnit               ProductSaleUnit    Single | Crate | Multipack | Tray
UnitsPerPackage        int                explicit — imported or entered, never parsed
```

`Jug` is a dekorativní lahev / džbán. There is no `Duopack` value — a duopack is `Multipack` with
`Units = 2`. There is no `TopClip` value — the list prices cans per piece and per tray only, so the
six-can sub-bundle is not a sellable unit.

`ProductUnitsResolver` is **deleted**, both the crate table and the name regexes. The lists state
pack sizes explicitly, and they are not uniform: a tray is 24 × 0,5 l but **12** × 0,33 l. No
hardcoded table would have got that right.

`Product.Kind` becomes `[NotMapped]` and derived, so `DisplayOrder`, `nakladkaGrouping`,
`VolumeTab` and `productSort` keep working without change. Precedence: `Container.Keg` → `Keg`;
`SaleUnit.Multipack` → `Multipack`; `SaleUnit.Crate` → `Bottle`; `Container.Can` → `Can`;
otherwise `Other`.

| Container / SaleUnit / volume | derived `Kind` | label |
|---|---|---|
| Keg, Single, 30 l | Keg | Sud 30 l |
| Bottle, Crate, 20 × 0,5 l | Bottle | **Basa 20×0,5 l** |
| Can, Tray, 24 × 0,5 l | Can | Tray 24×0,5 l |
| Can, Single, 2 l | Can | **Plechovka 2 l** |
| Jug, Single, 2 l | Other | **Džbán 2 l** |
| Bottle, Multipack, 8 × 0,5 l | Multipack | Multipack 8×0,5 l |
| Bottle, Multipack, 2 × 1 l | Multipack | Duopack 2×1 l |

Only a real crate says "Basa". `ProductWeightCalculator` takes `Container` instead of `Kind`; `Jug`
uses glass-bottle tare.

`ProductType` needs no new values — it already carries `Lemonade`, `Mix` and `OriginalCraftLager`,
which is what the Svijanela rows and "Pivo přímo ze sklepa" require.

## Catalog format

One CSV per brewery per effective date, committed under `AleTrack.Seeding/Catalog/`. The import
endpoint accepts the same format, and both sides share one parser at
`Features/Products/Import/PriceListCatalogParser.cs` — the seeder already references
`Features.Products.Utils`, so this follows the existing dependency direction.

```csv
# brewery: Svijany
# effective_from: 2026-05-01
# source: pivovarsvijany.cz/file/2336
public_id,name,type,alcohol,plato,container,volume_l,sale_unit,units,unit_novat,unit_vat,pack_novat,pack_vat
Svijanská Desítka,PaleDraftBeer,4.0,10,Bottle,0.5,Crate,20,13.14,15.90,,318.00
Svijanská Desítka,PaleDraftBeer,4.0,10,Keg,50,Single,1,15.37,18.60,1537.19,1860.00
Svijanský Máz,PaleLager,4.8,11,Can,2,Single,1,,,119.83,145.00
Svijanský Kvasničák,PaleStrong,6.0,13,Jug,2,Single,1,,,404.96,490.00
```

The four price columns map onto the entity as
`unit_novat` → `PriceForUnitWithoutVat`, `unit_vat` → `PriceForUnitWithVat`,
`pack_novat` → `PriceWithoutVat`, `pack_vat` → `PriceWithVat`. `pack_vat` is the only required
price; the others may be blank.

Blank cells are derived — `pack = unit × units`, or `unit = pack ÷ units`; without-VAT from
with-VAT ÷ 1.21 only when neither is printed — rounded to two decimals, half away from zero. The
21 % rate is a parser constant matching the `DPH 21%` stated on both lists; a future rate change
means a new constant, not a reinterpretation of old files. Every derived value is **flagged as
derived in the preview**, because the lists round per-0,5 l and per-keg independently and a derived
figure can differ from the printed one by a haléř.

`#` metadata lines are optional and ignored by the CSV reader. For an upload the brewery comes from
the route and the effective date from a form field; for a seeder file the metadata lines are the
record.

### Two conventions the source lists impose

**`unit_*` is the list's per-0,5 l reference price, not the price of one container.** Every list
prints two figures for a keg: 17,42 Kč per half-litre *and* 1 045 Kč per keg. The entity already
encodes exactly that split — the existing Rohozec seed row carries
`PriceForUnitWithVat = 17.42m` beside `PriceWithVat = 1045.00m` — so the catalogue keeps it rather
than inventing a third meaning. Consequence: the parser's `pack = unit × units` derivation is only
meaningful when the container is 0,5 l, so both price columns are always supplied for kegs, jugs and
2 l cans, and the derivation never fires for them.

**`public_id` is optional but carried where it exists.** The Rohozec builder assigns fixed
`PublicId`s (`a0000000-…-0001` upward) on purpose; reading its products from a file would otherwise
mint fresh GUIDs on every seed and silently discard that. A blank cell means "generate one". Product
names also stay in the builders' existing short form (`Roh. Skalák`) rather than the printed
`ROHOZEC Skalák`, so switching a builder to its catalogue file is not read as renaming every
product.

## Matching and diff

Natural key:
`(BreweryId, NormalizedName, Container, ContainerVolumeLiters, SaleUnit, UnitsPerPackage)`.

Normalisation is load-bearing, not cosmetic: the list says `Svijanský Máz 11%`, the database says
`Svijanský Máz`. Without stripping the trailing degree token (`\s+\d{1,2}\s*[%°]$`) and the trailing
size suffix on jugs (`– 2L`), the first import would duplicate the entire catalog instead of
matching it. Trim, collapse inner whitespace, compare case-insensitively, keep diacritics.

Two endpoints, both `ModuleType.Breweries` / `PermissionLevel.Edit`:

- `POST breweries/{breweryId:guid}/price-list/preview` — multipart file plus effective date. Writes
  nothing. Returns the diff and a `sourceHash` (SHA-256 of the normalised content).
- `POST breweries/{breweryId:guid}/price-list/apply` — the same file, date, and that `sourceHash`.
  Re-parses and re-verifies; `409` if the hash no longer matches, so you cannot apply a different
  file than the one you reviewed. Stateless — no server-side pending-import record.

Diff buckets, evaluated in this order so each row lands in exactly one:

| Bucket | Meaning |
|---|---|
| `Added` | natural key absent from the database |
| `Repriced` | matched, and **only** price fields differ |
| `Changed` | matched, and at least one non-price field differs (`type`, `alcohol`, `plato`), with or without a price change |
| `Unchanged` | matched, nothing differs |
| `ToRemove` | in the database, absent from the list, safe to remove |
| `Blocked` | in the database, absent from the list, but in use |

`Blocked` means absent from the list **and** either `InventoryItem.Quantity > 0` or referenced by an
`OrderItem` whose order state is `New`, `Planning` or `Delivering`. Blocked rows are reported and
left untouched.

Apply runs in a single transaction. Removals go through `dbContext.Products.Remove()`, which
`AleTrackDbContext` (line 209) turns into `IsDeleted = true` — so a removal is recoverable and
existing order-item restrictions are respected.

A rename surfaces as an add plus a remove. Acceptable given every removal is confirmed, but callers
should know.

## Provenance

New `PriceListImport` entity: brewery, `effective_from` (`DateOnly`), source name, source hash,
`imported_at` (`DateTimeOffset`, from the injected `TimeProvider`), importing user, and the added /
updated / removed counts. Plus `Product.PriceEffectiveFrom` (`DateOnly?`) so an individual price can
name the list that set it.

## Seeder

`SvijanyProductsBuilder` and `RohozecProductsBuilder` shrink to roughly 30 lines each, reading their
catalog CSV through the shared parser. Catalog files are marked `CopyToOutputDirectory`.
`PrimatorProductsBuilder` gets the mechanical field migration described above.

## EF migration

Adds `container`, `sale_unit`, `price_effective_from`; creates `price_list_imports`; renames
`package_size` → `container_volume_liters`; backfills; then drops `kind`. `units_per_package` is
already populated and is preserved.

| old `kind` + volume | → Container / SaleUnit |
|---|---|
| Keg, any | Keg / Single |
| Bottle, 0.33 or 0.5 | Bottle / Crate |
| Bottle, 0.75 | Bottle / Single |
| Bottle, 1 or 2 | **Jug** / Single |
| Can, 0.33 or 0.5 | Can / `Units > 1 ? Tray : Single` |
| Can, 2 | Can / Single |
| Multipack | `name ~ "plech" ? Can : Bottle` / Multipack |
| Other | Other / Single |

The `Multipack` row is the only case the data cannot answer; it infers container from the name and
the affected rows are listed in the migration's own comment. `BottleSize.TenLiters` appears only in
tests — no product row uses it — so it needs no mapping.

## Frontend

`app/src/lib/labels.ts` loses the `Bottle: 'Basa'` map in favour of a `packagingLabel()` helper
implementing the table above. The product form gains `Container`, `SaleUnit` and an explicit units
input. A new import screen uploads the CSV, renders the diff buckets, and applies. The API client is
regenerated in the same commit as the backend change, per `CLAUDE.md`.

## Testing

- **Parser** — metadata lines, blank-cell derivation, malformed numbers, duplicate natural keys.
- **Normalisation and matching** — degree suffix, jug size suffix, whitespace, case.
- **Diff** — every bucket, including both `Blocked` reasons.
- **Apply** — hash mismatch returns 409; transaction rolls back as a unit; removal is soft not hard;
  provenance row written with the injected `TimeProvider`'s timestamp.
- **Packaging** — the label and derived-`Kind` table above; weight per container.
- **Migration** — one case per mapping row.
- **Regression** — the existing 645 tests stay green.

## Delivery order

The change is large enough that it wants natural resume points. Each phase compiles, passes tests,
and is independently reviewable.

1. **Packaging model** — new enums, entity fields, derived `Kind`, weight calculator, EF migration
   with backfill, delete `ProductUnitsResolver`. All three seeder builders mechanically migrated;
   no price changes yet. Frontend labels and product form updated, API client regenerated.
2. **Catalog parser** — format, parsing, derivation, normalisation. Pure unit-tested code, no
   endpoints. Svijany and Rohozec CSVs committed; their builders switched to reading them, which is
   where the price refresh actually lands.
3. **Import endpoints** — preview and apply, diff buckets, blocked detection, provenance entity.
4. **Import UI** — upload, diff table, apply.

Phase 1 carries the migration and the widest blast radius; phase 2 is where the stale prices are
fixed and is worth landing even if 3 and 4 slip.

## Out of scope

Volume-discount bands, deposits (3 Kč per bottle, 1 000 Kč per keg, 100 Kč per crate) and the
per-hectolitre propagation contribution all appear in the Svijany PDF but are commercial terms, not
product attributes, and are not imported. Two-tier can bundling (TopClip inside Tray) is not
modelled. Client-specific price overrides remain unbuilt.
