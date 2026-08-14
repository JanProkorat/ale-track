# Garážový prodej — walk-in sales from stock

**Date:** 2026-08-13
**Status:** Design approved, ready for planning
**Branch:** `feature/garage-sales`
**Prototype:** `docs/prototype/aletrack-prototype.html` — module built and clickable at `#/sales`

## Problem

Stock reaches the warehouse through Dovozy zboží and leaves it two ways today:
a Vývoz delivers it to a client, or a `dokládka` tops up an order at loading
time. Both paths are driven by an order.

There is a third, entirely unmodelled path: a customer drives to the HQ and buys
off the shelf. Some pay cash on the spot, some need an invoice. Nothing records
who bought what, for how much, or on what terms — and nothing decrements
`inventory_items.quantity`, so every counter sale silently desynchronises Sklad
from reality.

This module adds that record and makes it the third writer of the stock ledger.
The `Sklad` nav group is renamed **Garážový prodej** and gains a **Prodeje**
item alongside Dovozy zboží and Sklad.

## Decisions

| Question | Decision |
|---|---|
| Lifecycle | `Draft` → `Completed`. Stock moves on completion, not on save |
| Who may complete | Anyone with `Sales: Edit`; a completed sale is immutable |
| Buyer identity | Either an existing `Client` **or** a free-text walk-in, chosen per sale |
| Payment | `Cash` (paid on the spot) or `Invoice` (billing block + paid flag + due date) |
| Invoice document | **Not generated here.** The block captures data; the accounting software issues the document |
| Line pricing | Prefilled from the product's `PriceWithVat`, overridable per line, snapshotted on the sale |
| Free-form stock (`Vratné basy`) | Sellable; no ceník price, so the price is typed and required before completion |
| Overselling | **Blocked**, not warned — at the input, at save, and again at the confirm step |
| Storno / refund | Out of scope for v1 |
| Display number | Derived from the id (`#A1B2C3`), matching orders/shipments/deliveries |

### Rejected alternatives

**One-shot sale (save = stock deducted).** Fewest clicks for the common cash
case, but it makes every mistake a correction record and gives no natural place
to show a before/after stock preview. The draft state costs one button and buys
an inspectable intermediate — the same trade Dovozy already makes with
`Dokončit → naskladnit`.

**Reusing `Order` with a `Walkin` flag.** An order is a *request* — it carries a
client, a required delivery date, reminder states, a shipment link and a
loading/invoicing lifecycle, none of which apply at the counter. Bending it
would add a nullable client, a nullable date and a "skip the whole shipment
pipeline" branch through code that is currently linear.

**A generic `StockMovement` ledger that all three writers post to.** The right
long-term shape, and the wrong change to make while introducing a feature: it
would have to be retrofitted onto Dovozy's naskladnění and the dokládka path in
the same breath. Noted under Known gaps instead.

**Reusing the owned `Address` type for the billing block.** `Address` marks
`StreetName`, `StreetNumber`, `City` and `Zip` `[Required]`. A walk-in invoice
frequently arrives as a name plus an IČO and nothing else, so the billing block
gets its own owned type with nullable parts.

## Data model

### `Sale : PublicEntity` → `sales`

| Column | Type | Notes |
|---|---|---|
| `sale_date` | `DateOnly` | When the goods changed hands |
| `state` | `SaleState` | `Draft` \| `Completed`. Stored as `integer` — this repo has no `HaveConversion<string>()` convention and every existing enum column is an int, so members may only ever be appended |
| `buyer_kind` | `SaleBuyerKind` | `Client` \| `Walkin` |
| `client_id` | `long?` | FK → `clients.id`, `DeleteBehavior.Restrict`. Non-null iff `buyer_kind = Client` |
| `buyer_name` | `string?` (100) | Free text. Non-null path only; optional even then for anonymous cash |
| `payment` | `SalePaymentMethod` | `Cash` \| `Invoice` |
| `note` | `string?` (500) | |
| `completed_at` | `DateTimeOffset?` | Set once, on completion |
| `sold_by_user_id` | `long?` | FK → `users.id`, `SetNull` — the till operator, for accountability |

Billing is an owned type `SaleBillingDetails` (`[Owned]`, all columns prefixed
`billing_`), present only for `payment = Invoice`: `Name` (100, required when
present), `CompanyId` (IČO, 20), `VatId` (DIČ, 20), `StreetName`,
`StreetNumber`, `City`, `Zip` (all 50, all nullable), `DueDate` (`DateOnly?`),
`IsPaid` (`bool`), `PaidDate` (`DateOnly?`).

`Restrict` on `client_id` matches `OrderItem.Product` — a client who has bought
something cannot be deleted out from under the sales history.

### `SaleItem : PublicEntity` → `sale_items`

Every line **snapshots** what was sold, following
`OutgoingShipmentStopItem` exactly: the record must stay readable after a
product is retired or the ceník moves.

| Column | Type | Notes |
|---|---|---|
| `sale_id` | `long` | FK → `sales.id`, cascade |
| `inventory_item_id` | `long?` | FK → `inventory_items.id`, `SetNull`. Which stock row this line drains |
| `product_id` | `long?` | FK → `products.id`, `SetNull`. Provenance only |
| `name` | `string` (100) | Snapshot — product name, or the free item's name |
| `package_size` | `double?` | Snapshot, for display (`30 l`) |
| `quantity` | `int` | |
| `unit_price_with_vat` | `decimal` | **Charged** price |
| `list_price_with_vat` | `decimal?` | Ceník price at the time of sale; null for free-form items |

Holding both prices is what lets the UI render `ceník 1 290 Kč · sleva 90 Kč`
and, later, lets a report separate discounting from list revenue. `SetNull` on
both FKs keeps a completed sale intact when a product is hard-deleted; the
snapshot columns carry the display.

`Sale.Items` is a `List<SaleItem>`; both entities register on
`AleTrackDbContext` (`Sales`, `SaleItems`). Indexes: `sale_items.sale_id`,
`sale_items.inventory_item_id`, `sales.client_id`, `sales.state`, and
`sales.sale_date` (the list sorts and filters on it).

### Permissions

`ModuleType` gains `Sales`. This is an **enum member appended to a persisted
enum** — `user_module_permissions` stores it, and the frontend's `MODULE_KEYS`
mirrors it. Append at the end; do not reorder.

Existing users get no `Sales` row, which resolves to `none` — the module is
invisible until an admin grants it. That is the intended fail-closed default and
should be called out in the PR, because **no existing account can see Prodeje
until permissions are edited**.

### Migration `AddSales`

Two tables, one owned-type column set, one enum value, the indexes above. No
data change and no backfill. Migrations are not auto-applied in this repo —
`dotnet ef database update` runs manually before the branch is usable.

## Endpoints

`Features/Sales/{Commands,Queries}/…`, matching `Features/InventoryItems`.
All carry `RequirePermission(ModuleType.Sales, …)` and `DontCatchExceptions()`.

| Endpoint | Route | Level | Notes |
|---|---|---|---|
| `GetSalesListEndpoint` | `GET sales` | View | Filter by state + unpaid, sorted newest first |
| `GetSaleDetailEndpoint` | `GET sales/{id:guid}` | View | Lines + billing |
| `CreateSaleEndpoint` | `POST sales` | Edit | Always creates in `Draft` |
| `UpdateSaleEndpoint` | `PUT sales/{id:guid}` | Edit | 409 on a completed sale |
| `CompleteSaleEndpoint` | `POST sales/{id:guid}/complete` | Edit | The stock write-path |
| `SetSalePaidEndpoint` | `PATCH sales/{id:guid}/paid` | Edit | Invoice sales only |
| `DeleteSaleEndpoint` | `DELETE sales/{id:guid}` | Edit | Drafts only; 409 otherwise |

Completion is its own command rather than a state field on `UpdateSaleDto`,
because it is not an edit: it moves stock, it is irreversible in v1, and it has
its own failure mode (insufficient stock) that a general update has no business
returning.

### Validation split

Per `rules/validation.md`, shape in the validator and domain state in the
endpoint:

| Rule | Level | Result |
|---|---|---|
| At least one line; quantity ≥ 1; unit price ≥ 0 | Validator | 400 |
| `ClientId` required iff `BuyerKind = Client`; `BuyerName` forbidden then | Validator | 400 `Sales.BuyerFieldsMismatch` |
| Billing block required iff `Payment = Invoice`; `Name` non-empty | Validator | 400 `Sales.BillingNameRequired` |
| Client exists | Endpoint | 404 |
| Every `InventoryItemId` exists | Endpoint | 404 |
| Sale is still `Draft` | Endpoint | 409 `Sales.AlreadyCompleted` |
| Every line's price is set (completion only) | Endpoint | 409 `Sales.PriceMissing` |
| Every line's quantity ≤ current stock (completion only) | Endpoint | 409 `Sales.InsufficientStock` |

`Sales.InsufficientStock` returns the offending line names via `AddError` so the
UI can say *which* item is short, not just that something is.

## The stock write-path

`CompleteSaleEndpoint` is the only place stock decreases outside a Vývoz:

1. Load the sale with `Items` and their `InventoryItem`s — **tracked**, since
   they are about to be updated (the one documented exception to `AsNoTracking`).
2. Guard: state is `Draft`; every price set; every `quantity ≤ InventoryItem.Quantity`.
3. Decrement each `InventoryItem.Quantity` and set `State = Completed`,
   `CompletedAt = timeProvider.GetUtcNow()`.
4. `SaveChangesAsync` — one transaction covering both the state flip and every
   decrement, so a sale can never be marked completed with the stock unmoved.

**Rows that reach zero are kept, not deleted.** A product at `0 ks` must stay
visible in Sklad as out-of-stock; deleting the row would also break the
`SetNull` provenance on every historical line pointing at it.

**Concurrency.** Two tills completing sales of the last kegs simultaneously
could both pass the guard and drive the quantity negative. The realistic
concurrency here is one person at one counter, so v1 does not add a rowversion
— but the decrement clamps at zero and the condition is re-checked inside the
same `SaveChanges`. Recorded under Known gaps rather than pretended away.

## Frontend

The backend DTO change requires `yarn generate-api` against a locally-running
backend **in the same commit**.

**Permissions.** `MODULE_KEYS` gains `'sales'`; the Uživatelé permission matrix
is driven from that list and needs no separate edit. Czech label *Prodeje*.

**Navigation.** `AppShell`'s nav group `Sklad` becomes `Garážový prodej`, its
items `Dovozy zboží` · `Sklad` · `Prodeje`, with the prototype's cart icon.

**Screens** — `src/features/sales/`, following the four-state URL convention
(`/sales`, `/sales/new`, `/sales/:id`, `/sales/:id/edit`) with `SalesPage`
dispatching on `view` and `useParams().id`:

- `SalesPage` — stat strip (prodejů/obrat tento měsíc, rozpracované,
  nezaplaceno), `SegControl` filter, `DataTable`, all inside `QueryBoundary`.
- `SaleDetail` — draft/vyskladněno/po splatnosti banners, line table with a
  total row, buyer + billing cards. Edit affordances hidden once completed.
- `SaleEditor` — items first, then buyer, then payment, with a sticky summary
  rail. The stock picker is a `FormDrawer`; quantity inputs clamp at available
  stock; `Faktura` unfolds the billing block and prefills it from the selected
  klient's fakturační adresa.
- `CompleteSaleDialog` — the before/after stock table, confirm disabled when any
  line is short.

Ports must be **precise copies of the prototype screens** (`app/CLAUDE.md`),
which is why the prototype was built first and is the reference for spacing,
wording and chips.

**Data layer.** `useSales` in `src/hooks/`, keys from `qk.sales` added to
`src/api/queryKeys.ts`. Completion, paid-marking and delete invalidate
`qk.sales.all`, the sale's `detail(id)` **and `qk.inventory.all`** — the
cross-resource invalidation is the easiest thing to forget here and the reason
Sklad would show stale quantities after a sale.

**Labels.** `L.saleState` (`Rozpracovaný`/`Dokončený`), `L.salePayment`
(`Hotově`/`Faktura`) in `src/lib/labels.ts` — never render the raw enum. Money
goes through `useCurrency().formatMoney`, never a local formatter. New copy is
Czech; code and comments English.

## Testing

Backend, `{Method}_{StateUnderTest}_{ExpectedBehavior}` against the mocked
`DbContext`:

- `HandleAsync_CompletesSale_DecrementsInventoryQuantities` — the load-bearing one.
- `HandleAsync_QuantityExceedsStock_Returns409` and `_DoesNotTouchInventory`
  (two assertions, because a partially-applied decrement is the worst failure here).
- `HandleAsync_AlreadyCompleted_Returns409` for complete, update and delete.
- `HandleAsync_LinePriceMissing_Returns409`.
- `HandleAsync_InventoryRowReachesZero_KeepsRow`.
- `HandleAsync_CompletedSale_SnapshotsSurviveProductDeletion`.
- Validator tests for each error code in the table above.

Note `aletrack-endpoint-test-harness-traps`: `Factory.Create` ignores DI, so
adding a constructor parameter breaks every test in the class, and `AsQueryable()`
breaks `ToListAsync` under the Moq.EntityFrameworkCore mock.

Frontend, per `app/CLAUDE.md`: `vi.mock` the hook with loading/error/no-data
variants; test the quantity clamp and the completed-sale read-only state, which
are what the component actually decides.

## Known gaps

**No storno.** A completed sale cannot be reversed, so a mistake is corrected by
adjusting Sklad by hand — exactly the untracked movement this module exists to
eliminate. This is the first follow-up, and it needs its own decision about
whether a storno is a new record or a state on the original.

**No stock-movement ledger.** Three writers now mutate
`inventory_items.quantity` — naskladnění, dokládka, and this — and none of them
records *why*. Sklad shows a number with no history behind it. Introducing a
ledger means retrofitting the two existing writers, which is its own work item.

**No optimistic concurrency on the decrement.** See above; acceptable at one
counter, wrong the moment a second till exists.

**No invoice document and no number series.** The display number is a derived
`#A1B2C3` surrogate like every other module's. If Prodeje ever issues its own
invoices, it needs a real sequential series, which is a legal-ish requirement,
not a formatting choice.

**Reporty does not know about sales.** Counter revenue is absent from every
report until the analytics endpoints are extended — and per
`aletrack-reports-endpoints-unprotected`, that module's protection story is its
own open question.
