using AleTrack.Common.Enums;
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
    public static ShipmentInvoicesDto ToDto(OutgoingShipment shipment, ReconcileResult reconcileResult)
    {
        var stopOrders = ShipmentInvoiceGraph.StopOrderByClientId(shipment);

        var invoices = shipment.Invoices
            .Select(invoice => new ShipmentInvoiceDto
            {
                Id = invoice.PublicId,
                ClientId = invoice.Client?.PublicId ?? Guid.Empty,
                ClientName = invoice.Client?.Name ?? string.Empty,
                Sequence = invoice.Sequence,
                StopOrder = stopOrders.TryGetValue(invoice.ClientId, out var order) ? order : null,
                Lines = invoice.Lines
                    .Select(line => ToLineDto(shipment, line))
                    .Where(line => line is not null)
                    .Select(line => line!)
                    .OrderBy(line => line.Name)
                    .ToList()
            })
            .OrderBy(i => i.StopOrder ?? int.MaxValue)
            .ThenBy(i => i.Sequence)
            .ToList();

        return new ShipmentInvoicesDto
        {
            Invoices = invoices,
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
    /// Maps one line, or null when its source item cannot be found in the graph — which should
    /// not happen after reconciliation, so the line is skipped rather than shown half-filled.
    /// </summary>
    private static ShipmentInvoiceLineDto? ToLineDto(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line) =>
        line.SourceKind switch
        {
            InvoiceLineSourceKind.OrderItem => FromOrderItem(shipment, line),
            InvoiceLineSourceKind.ClientExtraItem => FromClientExtra(shipment, line),
            InvoiceLineSourceKind.CustomExtraItem => FromCustomExtra(shipment, line),
            _ => null
        };

    private static ShipmentInvoiceLineDto? FromOrderItem(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line)
    {
        var order = ShipmentInvoiceGraph.OrderOf(shipment, line.OrderItemId ?? 0);
        var item = order?.OrderItems.FirstOrDefault(i => i.Id == line.OrderItemId);
        if (order is null || item is null)
            return null;

        return new ShipmentInvoiceLineDto
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
            IsFromStock = false
        };
    }

    private static ShipmentInvoiceLineDto? FromClientExtra(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line)
    {
        var extra = shipment.ClientExtraItems.FirstOrDefault(e => e.Id == line.ClientExtraItemId);
        if (extra is null)
            return null;

        var product = extra.InventoryItem?.Product;
        return new ShipmentInvoiceLineDto
        {
            Id = line.PublicId,
            SourceKind = line.SourceKind,
            SourceItemId = extra.PublicId,
            ProductId = product?.PublicId,
            Name = extra.InventoryItem?.Name ?? product?.Name ?? string.Empty,
            Kind = product?.Kind,
            PackageSize = product?.PackageSize,
            PriceWithVat = product?.PriceWithVat,
            Quantity = line.Quantity,
            OrderingClientId = extra.Client?.PublicId ?? Guid.Empty,
            OrderingClientName = extra.Client?.Name ?? string.Empty,
            // A client extra is taken from the inventory, which is exactly what "dokládka" means.
            IsFromStock = true
        };
    }

    private static ShipmentInvoiceLineDto? FromCustomExtra(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line)
    {
        var extra = shipment.CustomExtraItems.FirstOrDefault(e => e.Id == line.CustomExtraItemId);
        if (extra is null)
            return null;

        return new ShipmentInvoiceLineDto
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
            OrderingClientId = extra.Client?.PublicId ?? Guid.Empty,
            OrderingClientName = extra.Client?.Name ?? string.Empty,
            IsFromStock = false
        };
    }
}
