# Client-specific product prices

A client can have a set of custom product prices that applies to all of their
orders. The rule stays live and relational; the price it resolves to freezes on
the invoice line it was charged on — so repricing affects future invoices and
never restates a past one.

`OutgoingShipmentInvoiceLine.UnitPriceWithVat` was written with exactly this
feature in mind and already documents the intent in its own remarks. This design
fills in the rule side that comment anticipated.

## Data model

New entity `ClientProductPrice` → table `client_product_prices`.

| column | type | notes |
|---|---|---|
| `client_id` | `long` FK | Cascade — deleting a client drops its price list |
| `product_id` | `long` FK | **Restrict** |
| `price_with_vat` | `decimal` | The only operator-entered value |

Unique index on `(client_id, product_id)` — one price per client per product.

`product_id` is `Restrict`, not the EF default `Cascade`, for the reason
established for `OrderItem.Product` (commit 4764968): a product must not be
deletable out from under rows that reference it without the caller noticing.

The base class is `PublicEntity` — **not** softly deletable. Removing an override
reverts the client to the catalog price, and it cannot rewrite history, because
every invoice line already froze its own `UnitPriceWithVat` at billing time. A
soft-delete flag here would carry no information anything reads.

New navigation on `Client`:

```csharp
/// <summary>
/// Custom product prices that apply to every order from this client
/// </summary>
public List<ClientProductPrice> ProductPrices { get; set; } = [];
```

Register the `DbSet` on `AleTrackDbContext` and add an EF configuration under
`Infrastructure/Persistence/Configurations/` carrying the unique index.

## Resolution

One helper: `Common/Utils/ClientPriceResolver.cs`, alongside the existing
cross-feature `ProductOrdering.cs`. Two parts:

- `LoadAsync(dbContext, clientId, ct)` → `ClientPriceList`, a dictionary
  `productId → priceWithVat`.
- `ClientPriceList.Resolve(product)` → the four effective price fields.

### The formula

Only `PriceWithVat` is stored. The other three are scaled from the product's own
ratios — the same approach `BulkPriceDrawer.tsx:79-81` already takes on the
frontend when bulk-repricing a brewery:

```
ratio = override / product.PriceWithVat

PriceWithVat            = override
PriceWithoutVat         = product.PriceWithoutVat        * ratio
PriceForUnitWithVat     = product.PriceForUnitWithVat    * ratio
PriceForUnitWithoutVat  = product.PriceForUnitWithoutVat * ratio
```

Money rounds to 2 decimals. Null source fields stay null.

Deriving from the product's own ratio rather than a hardcoded `1.21` divisor
keeps each product's real effective VAT rate intact.

**Edge case — a product priced at zero.** The ratio is undefined. `PriceWithVat`
takes the override; the three derived fields keep the product's own values.

### Why a lookup rather than a SQL LEFT JOIN

`ShipmentContentSnapshotWriter` is deliberately DbContext-free — its remarks say
so, and that property is what lets it run inside a state transition without
touching persistence. A lookup can be passed into it; a JOIN in a projection
cannot. Using the lookup form everywhere gives one implementation and one test
suite across every path, and a client's override list is a handful of rows.

Constraint to record: no current query filters or sorts by price. If one ever
does, applying the override after projection would desync from that sort, and
that path needs the JOIN form instead.

Concretely, in `GetProductsByClientHistoryEndpoint` the override is applied to
the materialised list **after** `ToListAsync()` — `ApplyFilterAndSort` runs
server-side against catalog prices, which is exactly why the constraint above
matters.

## Where prices surface

The complete inventory of price surfaces in the product, and what each needs.

| surface | source today | change |
|---|---|---|
| `ShipmentContentSnapshotWriter.Snapshot()`:80 | `product.PriceWithVat` | **Resolve here** — the load-bearing change |
| `ShipmentInvoicing.tsx` | invoice lines ← stop-item snapshot | None — inherits the above |
| `GetProductsByClientHistoryEndpoint` | `p.PriceWithVat` | Resolve; already client-scoped by route |
| Order detail item rows | *no price at all today* | New price fields on `OrderItemDto` |
| `breweries/Cenik.tsx`, `BulkPriceDrawer.tsx` | catalog | None — brewery-owned, not client-scoped |
| Reports | — | None; reports carry no money |

### Freeze semantics

The resolved price lands on the stop-item snapshot at the transition into
`Loaded`, which is the same boundary `ShipmentMutability` freezes content at.
Consequences, which are the intended behaviour:

- Editing a client's price affects every order not yet loaded.
- An order already loaded and invoiced is untouched.

### Order detail reads the snapshot when one exists

For an order that has already been loaded, an item row shows the **frozen**
snapshot price, not the live-resolved one. Otherwise a delivered order would
display a price different from the invoice the client received. This follows the
principle already committed in issue #25 — historical records stop reading live
data. Orders not yet loaded resolve live.

So `OrderItemDto.UnitPriceWithVat` is filled from the item's
`OutgoingShipmentStopItem.UnitPriceWithVat` when a snapshot row exists (reachable
via `OutgoingShipmentStopItem.OrderItemId`), and from `ClientPriceResolver`
otherwise.

`CatalogPriceWithVat` stays **null for snapshot-fed rows**. The snapshot never
recorded what the catalog price was at the time, and putting today's catalog
price beside a frozen one would be actively misleading. The practical effect is
that the "special price" marker shows on orders still being composed and drops
away once the order is loaded — which is correct: at that point the frozen number
is the whole truth.

## API surface

New slice `Features/ClientProductPrices/`, mirroring `Features/ClientDeliveryPlaces/`:
`RequirePermission(ModuleType.Clients, …)`, `ThrowHelper.PublicEntityNotFound`,
`DontCatchExceptions()`, `public sealed` endpoints.

| endpoint | route | permission |
|---|---|---|
| `GetClientProductPricesEndpoint` | `GET clients/{ClientId:guid}/product-prices` | `Clients` / `View` |
| `SaveClientProductPriceEndpoint` | `PUT clients/{ClientId:guid}/product-prices/{ProductId:guid}` | `Clients` / `Edit` |
| `DeleteClientProductPriceEndpoint` | `DELETE clients/{ClientId:guid}/product-prices/{ProductId:guid}` | `Clients` / `Edit` |

`PUT` is an upsert. There is one value per `(client, product)` pair, so a
create/update split would add a 409 path and buy nothing.

The list query filters out soft-deleted products (`!p.IsDeleted`), so a price
pointing at a removed product stops appearing in the Ceník card. The row itself
survives — `product_id` is `Restrict`, and nothing benefits from deleting it.

A validator on the save request enforces `PriceWithVat` is present and greater
than zero.

### DTO changes

Both additive and non-breaking:

- `ProductListItemDto` gains `CatalogPriceWithVat: decimal?` — non-null **only**
  when an override applies. `PriceWithVat` keeps meaning "the effective price",
  so existing consumers keep working, and a non-null `CatalogPriceWithVat` is
  the signal that this row is a special price. On the global product list, where
  no client is in scope, it is always null.
- `OrderItemDto` gains `UnitPriceWithVat: decimal` and
  `CatalogPriceWithVat: decimal?`.

These are backend DTO changes, so `yarn generate-api` and its frontend
consumption land in the same commit.

## UI

### Ceník card on ClientDetail

A `CollapsibleCard` with a count pill, following the Kontakty / Dodací místa
pattern already on the page. Each row shows the product name, its brewery, the
client price, and the catalog price as secondary. Adding a row uses the existing
brewery-grouped `ProductCombobox` from #25. Gated on `canEdit('clients')`.

Mobile gets the `mobileCard` treatment used by the other client collections.

### OrderEditor

Where a catalog row has a non-null `catalogPriceWithVat`, the client price
renders as primary with the catalog price struck through beside it, plus a marker
making clear the total is not list price. Cart totals
(`OrderEditor.tsx:439`, `:770`) already read `priceWithVat`, so they become
correct with no arithmetic change.

### Order detail

Item rows gain a unit price and line total, with the same override marker.

All new copy is Czech; identifiers and comments English.

## Testing

**`ClientPriceResolver` unit tests** — pure, no DbContext: ratio math, a
zero-priced product, null derived fields staying null, rounding, and
no-override passthrough.

**Endpoint tests** (Moq.EntityFrameworkCore, per the repo's existing pattern):
upsert creates then overwrites; delete reverts to catalog; 404 on an unknown
client or product; validator rejects a non-positive price.

**Snapshot test** — a loaded shipment for a client holding an override bills the
override, and repricing afterwards leaves that invoice untouched.

**Frontend** — the Ceník card's interactions, and the override marker rendering
in the OrderEditor catalog and on order detail. Per `app/CLAUDE.md`, mock the
resource hook so it can express loading, error and no-data.

## Out of scope

Deliberately excluded; each is addable later without reshaping the above.

- Percentage discounts instead of absolute prices.
- Validity date ranges on an override.
- Brewery-wide or product-category-wide overrides.
- Price-list templates shared across clients.
- A "the catalog price moved, this override may be stale" warning.
