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
    /// Loads a shipment with everything reconciliation and invoice mapping need, tracked, plus
    /// the pieces excluded from invoicing. Null when the shipment does not exist.
    /// </summary>
    public static Task<ShipmentInvoiceSplit?> LoadAsync(AleTrackDbContext dbContext, Guid shipmentId, CancellationToken ct) =>
        LoadCoreAsync(dbContext, shipmentId, tracked: true, ct);

    /// <summary>
    /// The same graph, untracked — for a reader that reconciles only to see the current split and
    /// must never persist it.
    /// </summary>
    /// <remarks>
    /// Reconciliation materialises invoices and lines into the loaded graph, so a tracked load
    /// leaves a <c>SaveChanges</c> anywhere later in the request writing a split its caller never
    /// meant to write. The export reads this way; the four invoicing endpoints, which do mean to
    /// persist, keep <see cref="LoadAsync"/>.
    ///
    /// Identity resolution stays on: without it the include chain hands back several instances of
    /// the same order item, and reconciliation matches lines to items by reference-free key but
    /// walks the collections it is given.
    /// </remarks>
    public static Task<ShipmentInvoiceSplit?> LoadReadOnlyAsync(AleTrackDbContext dbContext, Guid shipmentId, CancellationToken ct) =>
        LoadCoreAsync(dbContext, shipmentId, tracked: false, ct);

    private static async Task<ShipmentInvoiceSplit?> LoadCoreAsync(
        AleTrackDbContext dbContext,
        Guid shipmentId,
        bool tracked,
        CancellationToken ct)
    {
        IQueryable<OutgoingShipment> shipments = dbContext.OutgoingShipments
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.Client)
                .ThenInclude(c => c.InvoicingClient)
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.OrderItems).ThenInclude(i => i.Product)
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.OrderItems).ThenInclude(i => i.InventoryItem)
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.CustomExtraItems)
            .Include(s => s.Stops).ThenInclude(st => st.ClientOrder!).ThenInclude(o => o.SupplierGoodItems)
                .ThenInclude(i => i.SupplierGood).ThenInclude(g => g.Prices)
            .Include(s => s.Invoices).ThenInclude(i => i.Lines)
            .Include(s => s.Invoices).ThenInclude(i => i.Client)
            .Include(s => s.Invoices).ThenInclude(i => i.BillingRecipients).ThenInclude(r => r.Client)
            .Include(s => s.InvoiceConfirmations).ThenInclude(c => c.Client);

        if (!tracked)
            shipments = shipments.AsNoTrackingWithIdentityResolution();

        var shipment = await shipments.FirstOrDefaultAsync(s => s.PublicId == shipmentId, ct);

        if (shipment is null)
            return null;

        // Loaded by their own query rather than through a navigation — see
        // OutgoingShipmentInvoiceLineConfiguration for why there is none.
        IQueryable<OutgoingShipmentInvoiceLine> privateLines = dbContext.OutgoingShipmentInvoiceLines
            .Where(l => l.OutgoingShipmentId == shipment.Id && l.IsPrivate);

        if (!tracked)
            privateLines = privateLines.AsNoTracking();

        return new ShipmentInvoiceSplit { Shipment = shipment, PrivateLines = await privateLines.ToListAsync(ct) };
    }

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
    /// <summary>Order-owned custom extras reachable from this shipment, with their order.</summary>
    public static IEnumerable<(OrderCustomExtraItem Extra, Order Order)> CustomExtrasOf(OutgoingShipment shipment) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.CustomExtraItems.Select(e => (e, s.ClientOrder!)));

    /// <summary>Order-owned supplier-good lines reachable from this shipment, with their order.</summary>
    public static IEnumerable<(OrderSupplierGoodItem Item, Order Order)> SupplierGoodsOf(OutgoingShipment shipment) =>
        shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.SupplierGoodItems.Select(i => (i, s.ClientOrder!)));

    public static long? ResolveSourceItemId(OutgoingShipment shipment, InvoiceLineSourceKind kind, Guid publicId) => kind switch
    {
        InvoiceLineSourceKind.OrderItem => shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .SelectMany(s => s.ClientOrder!.OrderItems)
            .FirstOrDefault(i => i.PublicId == publicId)?.Id,
        InvoiceLineSourceKind.CustomExtraItem => CustomExtrasOf(shipment)
            .Select(x => x.Extra).FirstOrDefault(e => e.PublicId == publicId)?.Id,
        InvoiceLineSourceKind.SupplierGoodItem => SupplierGoodsOf(shipment)
            .Select(x => x.Item).FirstOrDefault(i => i.PublicId == publicId)?.Id,
        _ => null
    };

    /// <summary>
    /// Identity of the item a line bills for, for matching lines to a requested source.
    /// </summary>
    public static long SourceItemIdOf(OutgoingShipmentInvoiceLine line) => line.SourceKind switch
    {
        InvoiceLineSourceKind.OrderItem => line.OrderItemId ?? 0,
        InvoiceLineSourceKind.CustomExtraItem => line.CustomExtraItemId ?? 0,
        InvoiceLineSourceKind.SupplierGoodItem => line.SupplierGoodItemId ?? 0,
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
            case InvoiceLineSourceKind.CustomExtraItem:
                line.CustomExtraItemId = itemId;
                break;
            case InvoiceLineSourceKind.SupplierGoodItem:
                line.SupplierGoodItemId = itemId;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown invoice line source kind.");
        }
    }

    /// <summary>
    /// Clients that may hold an invoice on this shipment: those with a stop on the route, their
    /// payers, plus any that already hold one (a client can keep a cross-billed invoice after
    /// their own order leaves the shipment).
    /// </summary>
    public static HashSet<long> EligibleClientIds(OutgoingShipment shipment)
    {
        var orders = shipment.Stops
            .Where(s => s.ClientOrder is not null)
            .Select(s => s.ClientOrder!)
            .ToList();

        var ids = orders.Select(o => o.ClientId).ToHashSet();

        // A payer holds the invoices for its sub-clients' goods without necessarily having a
        // stop or an order of its own, so it must be a legal move target too.
        foreach (var payerId in orders.Select(o => o.Client?.InvoicingClientId).OfType<long>())
            ids.Add(payerId);

        // Extras need no pass of their own: each hangs off a stop's order, whose client
        // is already in the set above.

        foreach (var invoice in shipment.Invoices)
            ids.Add(invoice.ClientId);

        return ids;
    }

    /// <summary>
    /// Clients that have a row on the Fakturace table: those holding an invoice on the run, plus
    /// those holding pieces kept off every invoice.
    /// </summary>
    /// <remarks>
    /// Narrower than <see cref="EligibleClientIds"/> on purpose. A sub-client whose every piece is
    /// billed to its payer holds no invoice and no private pieces, so it has no row — its goods
    /// appear inside the payer's, which is why confirming a payer confirms the whole group.
    /// </remarks>
    public static HashSet<long> RowClientIds(ShipmentInvoiceSplit split)
    {
        var ids = split.Shipment.Invoices.Select(i => i.ClientId).ToHashSet();

        foreach (var line in split.PrivateLines)
        {
            var clientId = OrderingClientIdOf(split.Shipment, line);
            if (clientId is not null)
                ids.Add(clientId.Value);
        }

        return ids;
    }

    /// <summary>
    /// Internal ID of the client who ordered a line's pieces, or null when its source item is no
    /// longer on the run.
    /// </summary>
    public static long? OrderingClientIdOf(OutgoingShipment shipment, OutgoingShipmentInvoiceLine line) =>
        line.SourceKind switch
        {
            InvoiceLineSourceKind.OrderItem => OrderOf(shipment, line.OrderItemId ?? 0)?.ClientId,
            InvoiceLineSourceKind.CustomExtraItem => CustomExtrasOf(shipment)
                .FirstOrDefault(x => x.Extra.Id == line.CustomExtraItemId).Order?.ClientId,
            InvoiceLineSourceKind.SupplierGoodItem => SupplierGoodsOf(shipment)
                .FirstOrDefault(x => x.Item.Id == line.SupplierGoodItemId).Order?.ClientId,
            _ => null
        };

    /// <summary>
    /// The number the next confirmed row on this run takes: one past the highest already handed
    /// out, so an un-marked row's kept number is never reissued.
    /// </summary>
    public static int NextConfirmationNumber(OutgoingShipment shipment) =>
        shipment.InvoiceConfirmations.Count == 0
            ? 1
            : shipment.InvoiceConfirmations.Max(c => c.Number) + 1;

    /// <summary>
    /// Whether the split may still be edited. Mirrors the nakládka rule.
    /// </summary>
    public static bool IsEditable(OutgoingShipment shipment) =>
        shipment.State is not (OutgoingShipmentState.Delivered or OutgoingShipmentState.Cancelled);
}
