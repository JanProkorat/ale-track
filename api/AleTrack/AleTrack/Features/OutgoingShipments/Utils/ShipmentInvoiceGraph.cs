using AleTrack.Common.Enums;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// Loading and lookup helpers shared by every invoicing endpoint.
/// </summary>
/// <remarks>
/// All four invoicing endpoints need the same graph loaded — reconciliation walks orders,
/// extra items and existing invoices in one pass — so the include chain lives here rather
/// than being repeated (and drifting) four times.
/// </remarks>
public static class ShipmentInvoiceGraph
{
    /// <summary>
    /// Loads a shipment with everything reconciliation and invoice mapping need, tracked.
    /// </summary>
    public static Task<OutgoingShipment?> LoadAsync(AleTrackDbContext dbContext, Guid shipmentId, CancellationToken ct) =>
        dbContext.OutgoingShipments
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.Client)
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(s => s.ClientExtraItems).ThenInclude(e => e.InventoryItem).ThenInclude(i => i.Product)
            .Include(s => s.ClientExtraItems).ThenInclude(e => e.Client)
            .Include(s => s.CustomExtraItems).ThenInclude(e => e.Client)
            .Include(s => s.Invoices).ThenInclude(i => i.Lines)
            .Include(s => s.Invoices).ThenInclude(i => i.Client)
            .FirstOrDefaultAsync(s => s.PublicId == shipmentId, ct);

    /// <summary>
    /// Order items of the shipment's order stops, keyed by internal ID.
    /// </summary>
    public static Dictionary<long, OrderItem> OrderItemsById(OutgoingShipment shipment) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .ToDictionary(i => i.Id);

    /// <summary>
    /// Route position of each client on the shipment, so the UI can order its client bands.
    /// </summary>
    public static Dictionary<long, int> StopOrderByClientId(OutgoingShipment shipment) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .GroupBy(s => s.ClientOrder!.ClientId)
            .ToDictionary(g => g.Key, g => g.Min(s => s.Order));

    /// <summary>
    /// The client who ordered a given order item.
    /// </summary>
    public static Order? OrderOf(OutgoingShipment shipment, long orderItemId) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .Select(s => s.ClientOrder!)
            .FirstOrDefault(o => o.OrderItems.Any(i => i.Id == orderItemId));

    /// <summary>
    /// Internal ID of the shipment item a request refers to by public ID, or null when the
    /// shipment does not carry it.
    /// </summary>
    public static long? ResolveSourceItemId(OutgoingShipment shipment, InvoiceLineSourceKind kind, Guid publicId) => kind switch
    {
        InvoiceLineSourceKind.OrderItem => shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .FirstOrDefault(i => i.PublicId == publicId)?.Id,
        InvoiceLineSourceKind.ClientExtraItem => shipment.ClientExtraItems
            .FirstOrDefault(e => e.PublicId == publicId)?.Id,
        InvoiceLineSourceKind.CustomExtraItem => shipment.CustomExtraItems
            .FirstOrDefault(e => e.PublicId == publicId)?.Id,
        _ => null
    };

    /// <summary>
    /// Identity of the item a line bills for, for matching lines to a requested source.
    /// </summary>
    public static long SourceItemIdOf(OutgoingShipmentInvoiceLine line) => line.SourceKind switch
    {
        InvoiceLineSourceKind.OrderItem => line.OrderItemId ?? 0,
        InvoiceLineSourceKind.ClientExtraItem => line.ClientExtraItemId ?? 0,
        InvoiceLineSourceKind.CustomExtraItem => line.CustomExtraItemId ?? 0,
        _ => 0
    };

    /// <summary>
    /// Sets the source foreign key matching <paramref name="kind"/> on a new line.
    /// </summary>
    public static void AssignSource(OutgoingShipmentInvoiceLine line, InvoiceLineSourceKind kind, long itemId)
    {
        line.SourceKind = kind;
        switch (kind)
        {
            case InvoiceLineSourceKind.OrderItem:
                line.OrderItemId = itemId;
                break;
            case InvoiceLineSourceKind.ClientExtraItem:
                line.ClientExtraItemId = itemId;
                break;
            case InvoiceLineSourceKind.CustomExtraItem:
                line.CustomExtraItemId = itemId;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown invoice line source kind.");
        }
    }

    /// <summary>
    /// Clients that may hold an invoice on this shipment: those with a stop on the route, plus
    /// any that already hold one (a client can keep a cross-billed invoice after their own
    /// order leaves the shipment).
    /// </summary>
    public static HashSet<long> EligibleClientIds(OutgoingShipment shipment)
    {
        var ids = shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .Select(s => s.ClientOrder!.ClientId)
            .ToHashSet();

        foreach (var clientId in shipment.ClientExtraItems.Where(e => e.ClientId is not null).Select(e => e.ClientId!.Value))
            ids.Add(clientId);

        foreach (var clientId in shipment.CustomExtraItems.Where(e => e.ClientId is not null).Select(e => e.ClientId!.Value))
            ids.Add(clientId);

        foreach (var invoice in shipment.Invoices)
            ids.Add(invoice.ClientId);

        return ids;
    }

    /// <summary>
    /// Whether the split may still be edited. Mirrors the nakládka rule.
    /// </summary>
    public static bool IsEditable(OutgoingShipment shipment) =>
        shipment.State is not (OutgoingShipmentState.Delivered or OutgoingShipmentState.Cancelled);
}
