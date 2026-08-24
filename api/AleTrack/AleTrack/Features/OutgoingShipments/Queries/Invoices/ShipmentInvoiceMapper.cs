using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;

namespace AleTrack.Features.OutgoingShipments.Queries.Invoices;

/// <summary>
/// Projects a reconciled shipment's invoices into their DTO form.
/// </summary>
/// <remarks>
/// Each line resolves its source item out of the loaded graph to pick up the product details,
/// the price, and — the part that matters — the client who <em>ordered</em> the pieces. The UI
/// derives "cross-billed" by comparing that against the invoice's own client, so this must be
/// filled for every line.
/// </remarks>
public static class ShipmentInvoiceMapper
{
    /// <summary>
    /// Maps the shipment's invoices and a reconciliation result into the response DTO.
    /// </summary>
    public static ShipmentInvoicesDto ToDto(ShipmentInvoiceSplit split, ReconcileResult reconcileResult)
    {
        var shipment = split.Shipment;
        var stopOrders = ShipmentInvoiceGraph.StopOrderByClientId(shipment);

        var invoices = shipment.Invoices
            .Select(invoice => new ShipmentInvoiceDto
            {
                Id = invoice.PublicId,
                ClientId = invoice.Client?.PublicId ?? Guid.Empty,
                ClientName = invoice.Client?.Name ?? string.Empty,
                ClientBusinessName = invoice.Client?.BusinessName,
                ClientOfficialAddress = invoice.Client?.OfficialAddress?.ToDto(),
                Sequence = invoice.Sequence,
                StopOrder = stopOrders.TryGetValue(invoice.ClientId, out var order) ? order : null,
                Lines = OrderForDisplay(invoice.Lines.Select(line => ToLine(shipment, line))),
                BillingRecipients = invoice.BillingRecipients
                    .Select(r => new ShipmentInvoiceBillingRecipientDto
                    {
                        ClientId = r.Client?.PublicId ?? Guid.Empty,
                        ClientName = r.Client?.Name ?? string.Empty,
                        // The row's own copy, not the client's current address — that is the whole
                        // point of storing it.
                        Address = r.Address.ToDto()
                    })
                    .OrderBy(r => r.ClientName, StringComparer.CurrentCulture)
                    .ToList()
            })
            .OrderBy(i => i.StopOrder ?? int.MaxValue)
            .ThenBy(i => i.Sequence)
            .ToList();

        return new ShipmentInvoicesDto
        {
            Invoices = invoices,
            // Flat, not grouped: the client who ordered the pieces is on every line already, and
            // the UI needs them under that client's band rather than under an invoice.
            PrivateLines = OrderForDisplay(split.PrivateLines.Select(line => ToLine(shipment, line))),
            Confirmations = shipment.InvoiceConfirmations
                .Select(c => new ShipmentInvoiceConfirmationDto
                {
                    ClientId = c.Client?.PublicId ?? Guid.Empty,
                    Number = c.Number,
                    IsReady = c.IsReady,
                    LastExportedAt = c.LastExportedAt
                })
                .OrderBy(c => c.Number)
                .ToList(),
            IsEditable = ShipmentInvoiceGraph.IsEditable(shipment),
            Adjustments = reconcileResult.Adjustments
                .Select(a => new InvoiceAdjustmentDto
                {
                    Kind = a.Kind,
                    SourceKind = a.SourceKind,
                    ItemName = a.ItemName,
                    Quantity = a.Quantity
                })
                .ToList()
        };
    }

    /// <summary>
    /// A mapped line together with the product facts it is ordered by. The degree and
    /// the type are not on the DTO — the invoice UI has no use for them — so they ride
    /// alongside just long enough to sort.
    /// </summary>
    private sealed record SortedLine(ShipmentInvoiceLineDto Dto, ProductType Type, float? PlatoDegree, double? PackageSize);

    /// <summary>
    /// Puts the lines of one invoice in display order, dropping the ones whose source item is
    /// gone: kegs first, then the app-wide product order (see <see cref="ProductOrdering"/>)
    /// for everything else.
    /// </summary>
    /// <remarks>
    /// Kegs lead here and nowhere else. An invoice is read against the pallet the way the office
    /// checks it — the sudy carry most of the value and get reconciled first — while the nakládka
    /// keeps its own order, in which the kegs go into the van last.
    /// </remarks>
    private static List<ShipmentInvoiceLineDto> OrderForDisplay(IEnumerable<SortedLine?> lines) =>
        lines
            .Where(line => line is not null)
            .Select(line => line!)
            .Order(Comparer<SortedLine>.Create((a, b) =>
            {
                var byKeg = KegRank(a.Dto.Kind).CompareTo(KegRank(b.Dto.Kind));
                if (byKeg != 0) return byKeg;

                return ProductOrdering.Compare(
                    (a.Type, a.PlatoDegree, a.PackageSize, a.Dto.Name),
                    (b.Type, b.PlatoDegree, b.PackageSize, b.Dto.Name));
            }))
            .Select(line => line.Dto)
            .ToList();

    /// <summary>
    /// Kegs sort ahead of every other kind. A line with no kind at all — a custom extra — ranks
    /// with the non-kegs rather than being pulled to the front by a missing value.
    /// </summary>
    private static int KegRank(ProductKind? kind) => kind == ProductKind.Keg ? 0 : 1;

    /// <summary>
    /// Maps one line, or null when its source item cannot be found in the graph — which should
    /// not happen after reconciliation, so the line is skipped rather than shown half-filled.
    /// </summary>
    private static SortedLine? ToLine(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line) =>
        line.SourceKind switch
        {
            InvoiceLineSourceKind.OrderItem => FromOrderItem(shipment, line),
            InvoiceLineSourceKind.CustomExtraItem => FromCustomExtra(shipment, line),
            InvoiceLineSourceKind.SupplierGoodItem => FromSupplierGood(shipment, line),
            _ => null
        };

    private static SortedLine? FromOrderItem(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line)
    {
        var order = ShipmentInvoiceGraph.OrderOf(shipment, line.OrderItemId ?? 0);
        var item = order?.OrderItems.FirstOrDefault(i => i.Id == line.OrderItemId);
        if (order is null || item is null)
            return null;

        var dto = new ShipmentInvoiceLineDto
        {
            Id = line.PublicId,
            SourceKind = line.SourceKind,
            SourceItemId = item.PublicId,
            // Provenance link the UI navigates by, not a displayed fact.
            ProductId = item.Product?.PublicId,
            // Displayed facts come from the line's own snapshot: repricing or renaming a product
            // must not restate an invoice that was already issued.
            Name = line.ProductName,
            Kind = line.Kind,
            PackageSize = line.PackageSize,
            PriceWithVat = line.UnitPriceWithVat,
            Quantity = line.Quantity,
            OrderingClientId = order.Client?.PublicId ?? Guid.Empty,
            OrderingClientName = order.Client?.Name ?? string.Empty,
            // Sourcing does not change what is billed, but the split is worth surfacing:
            // true when any of this item's pieces came out of our own stock.
            IsFromStock = item.QuantityFromInventory > 0
        };

        // Type and the degree are sort keys only, never rendered on an invoice line, so they stay
        // live — ordering is presentation, like the brewery colour in the volume reports. The
        // package size comes off the line so the value sorted on is the value shown.
        return new SortedLine(
            dto,
            item.Product?.Type ?? ProductType.Other,
            item.Product?.PlatoDegree,
            line.PackageSize);
    }


    /// <summary>
    /// A supplier good: billed to whoever ordered it, and — like a custom extra — carrying no
    /// product, no kind and no price of its own.
    /// </summary>
    private static SortedLine? FromSupplierGood(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line)
    {
        var match = ShipmentInvoiceGraph.SupplierGoodsOf(shipment)
            .FirstOrDefault(x => x.Item.Id == line.SupplierGoodItemId);
        if (match.Item is null)
            return null;

        var (item, owningOrder) = match;

        var dto = new ShipmentInvoiceLineDto
        {
            Id = line.PublicId,
            SourceKind = line.SourceKind,
            SourceItemId = item.PublicId,
            // No product: a supplier good is a price-list entry, not a brewery product, so there
            // is nothing for the UI to navigate to. Its name is what groups the row instead.
            ProductId = null,
            Name = line.ProductName,
            Kind = null,
            PackageSize = null,
            // The price frozen onto the line, as for an order item — not the good's current one.
            PriceWithVat = line.UnitPriceWithVat,
            Quantity = line.Quantity,
            OrderingClientId = owningOrder.Client?.PublicId ?? Guid.Empty,
            OrderingClientName = owningOrder.Client?.Name ?? string.Empty,
            // Pieces taken off our own shelf rather than collected at the supplier — the same
            // distinction `IsFromStock` draws for an order item sourced from inventory.
            IsFromStock = item.QuantityFromGarage > 0
        };

        return new SortedLine(dto, ProductType.Other, null, null);
    }

    private static SortedLine? FromCustomExtra(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line)
    {
        var match = ShipmentInvoiceGraph.CustomExtrasOf(shipment)
            .FirstOrDefault(x => x.Extra.Id == line.CustomExtraItemId);
        if (match.Extra is null)
            return null;

        var (extra, owningOrder) = match;

        // A custom extra has no product at all, so it ranks with the non-beers and
        // lands after them — it is not a beer of unknown degree.
        var dto = new ShipmentInvoiceLineDto
        {
            Id = line.PublicId,
            SourceKind = line.SourceKind,
            SourceItemId = extra.PublicId,
            ProductId = null,
            // The description travels on the line now, like every other displayed fact.
            Name = line.ProductName,
            Kind = null,
            PackageSize = null,
            PriceWithVat = null,
            Quantity = line.Quantity,
            OrderingClientId = owningOrder.Client?.PublicId ?? Guid.Empty,
            OrderingClientName = owningOrder.Client?.Name ?? string.Empty,
            IsFromStock = false
        };

        return new SortedLine(dto, ProductType.Other, null, null);
    }
}
