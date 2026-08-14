# Garážový prodej — the "Čeká na platbu" state

**Date:** 2026-08-14
**Status:** Design approved, implementing
**Branch:** `feature/garage-sales`
**Extends:** `2026-08-13-garage-sales-design.md`

## Problem

A sale paid by invoice is not finished when the goods leave the counter — the money has not
arrived. The original lifecycle (`Draft → Completed`) has no room for that gap, so an invoiced sale
was marked `Completed` immediately and its unpaid-ness lived in a separate `Billing.IsPaid` flag.

That flag is a second source of truth for a question the lifecycle should answer, and it is why a
sale can read "Dokončený" while nobody has been paid.

## Decisions

| Question | Decision |
|---|---|
| New state | `AwaitingPayment`, appended to `SaleState` (`Draft=0, Completed=1, AwaitingPayment=2`) |
| When stock moves | On `Dokončit prodej`, for both payment methods — the goods physically leave then |
| Cash sales | Unchanged: `Draft → Completed` |
| Invoice sales | `Draft → AwaitingPayment → Completed` |
| `Billing.IsPaid` | **Dropped.** Unpaid ⇔ `State == AwaitingPayment` |
| `Billing.PaidDate` | Kept — when the invoice was settled is still worth recording |
| `SetSalePaidEndpoint` | Replaced by `ConfirmSalePaymentEndpoint`, not kept alongside |
| Due date | Required whenever payment is Invoice, on every save |
| Overdue | Row tint + existing pill in the list; passive, no notification |

### Rejected alternatives

**Keeping `IsPaid` alongside the state.** Cheaper to write and impossible to keep honest: two
fields answering "is it paid" will disagree the first time a code path updates one and not the
other. The state machine is the natural home for a lifecycle fact.

**Deducting stock only at payment confirmation.** Inventory would then count goods that have
physically left the building, and a second sale could be written against kegs already carried out.

**Reserving stock at finish, deducting at payment.** Honest on both counts, but it needs a
reservation concept `inventory_items` does not have — a new column and a rule at every point stock
is read. Not worth it for a shop where the goods leave immediately.

## Data model

`SaleState` gains `AwaitingPayment = 2`. Appended, not inserted: the enum is persisted as `int`
(this repo has no `HaveConversion<string>()`), so reordering would rewrite the meaning of existing
rows.

`SaleBillingDetails` loses `IsPaid`. `PaidDate` stays.

**Migration `AddAwaitingPaymentState`** — order matters:

1. Move the rows that would otherwise become silently "paid":
   `UPDATE sales SET state = 2 WHERE state = 1 AND payment = 1 AND billing_is_paid = false;`
2. Then drop `billing_is_paid`.

Doing it the other way round loses the information the move depends on.

## Endpoints

`CompleteSaleEndpoint` keeps every guard — draft-only, all lines priced, all lines in stock — and
only changes which state it lands in: `Invoice → AwaitingPayment`, `Cash → Completed`. Stock is
deducted either way.

`ConfirmSalePaymentEndpoint` — `POST sales/{id}/confirm-payment`, `Sales: Edit`,
`EndpointWithoutRequest` (a route-only request DTO makes FastEndpoints demand a body and answer 415
on POST — see `AcknowledgeAddressChangesEndpoint`). Requires `AwaitingPayment`, else 409
`Sales.NotAwaitingPayment`. Stamps `PaidDate` from the injected `TimeProvider` and moves to
`Completed`. Touches no stock.

`UpdateSaleEndpoint` and `DeleteSaleEndpoint` keep refusing anything that is not a draft, so an
`AwaitingPayment` sale is as frozen as a completed one.

### Validation

`DueDate` joins `Billing.Name` as required when `Payment == Invoice`, in both the create and update
validators. The frontend currently only enforces the name at completion, which means a draft
invoice without a name already 400s today; both sides align on "required whenever Faktura is
selected".

## Frontend

`SALE_STATUS` gains a third pill: `Draft` amber, `AwaitingPayment` info, `Completed` ok. `L.saleState`
gains "Čeká na platbu".

`salesModel.isUnpaid` becomes `state === 'AwaitingPayment'` — no longer a three-part conjunction —
and `overdueDays` follows it unchanged. The list's `Nezaplacené` filter and `Nezaplaceno` stat
re-point at the same predicate, so they keep working by construction.

An overdue row gets a red-tinted background in the list, alongside the `po splatnosti N dní` pill it
already shows, so it reads while scanning rather than only on close inspection.

The detail shows **Platba dorazila** on an `AwaitingPayment` sale, replacing "Označit jako
zaplaceno". The stock-shortfall check stays draft-only: an awaiting-payment sale already moved its
stock.

## Testing

Backend: completing an invoice sale lands in `AwaitingPayment` and still deducts stock; completing a
cash sale still lands in `Completed`; confirming payment moves to `Completed`, stamps `PaidDate` and
leaves inventory alone; confirming a sale that is not awaiting payment 409s; update and delete refuse
an `AwaitingPayment` sale; the due-date validator rejects an invoice sale without one.

Frontend: the three pills; `isUnpaid` and the filter keyed off the new state; the overdue tint; the
detail offering payment confirmation only in `AwaitingPayment`; the editor requiring a due date.

## Known gaps

**No partial payments.** An invoice is unpaid or settled; there is no "half paid" state, and adding
one later means a payments table rather than another enum member.

**Nothing chases the debt.** The overdue highlight is passive — no email, no reminder, no daily job.

**`PaidDate` is not editable.** It is stamped when the button is pressed, so a payment recorded late
carries the date it was entered rather than the date it arrived.
