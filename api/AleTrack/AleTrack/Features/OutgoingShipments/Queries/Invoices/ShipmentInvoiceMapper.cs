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
                Sequence = invoice.Sequence,
                StopOrder = stopOrders.TryGetValue(invoice.ClientId, out var order) ? order : null,
                Lines = OrderForDisplay(invoice.Lines.Select(line => ToLine(shipment, line)))
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
    /// Puts the lines of one invoice in the app-wide product order (see
    /// <see cref="ProductOrdering"/>), dropping the ones whose source item is gone.
    /// </summary>
    private static List<ShipmentInvoiceLineDto> OrderForDisplay(IEnumerable<SortedLine?> lines) =>
        lines
            .Where(line => line is not null)
            .Select(line => line!)
            .Order(Comparer<SortedLine>.Create((a, b) => ProductOrdering.Compare(
                (a.Type, a.PlatoDegree, a.PackageSize, a.Dto.Name),
                (b.Type, b.PlatoDegree, b.PackageSize, b.Dto.Name))))
            .Select(line => line.Dto)
            .ToList();

    /// <summary>
    /// Maps one line, or null when its source item cannot be found in the graph — which should
    /// not happen after reconciliation, so the line is skipped rather than shown half-filled.
    /// </summary>
    private static SortedLine? ToLine(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line) =>
        line.SourceKind switch
        {
            InvoiceLineSourceKind.OrderItem => FromOrderItem(shipment, line),
            InvoiceLineSourceKind.CustomExtraItem => FromCustomExtra(shipment, line),
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
            ProductId = item.Product?.PublicId,
            Name = item.Product?.Name ?? string.Empty,
            Kind = item.Product?.Kind,
            PackageSize = item.Product?.PackageSize,
            PriceWithVat = item.Product?.PriceWithVat,
            Quantity = line.Quantity,
            OrderingClientId = order.Client?.PublicId ?? Guid.Empty,
            OrderingClientName = order.Client?.Name ?? string.Empty,
            // Sourcing does not change what is billed, but the split is worth surfacing:
            // true when any of this item's pieces came out of our own stock.
            IsFromStock = item.QuantityFromInventory > 0
        };

        return new SortedLine(
            dto,
            item.Product?.Type ?? ProductType.Other,
            item.Product?.PlatoDegree,
            item.Product?.PackageSize);
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
            Name = extra.Description,
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
