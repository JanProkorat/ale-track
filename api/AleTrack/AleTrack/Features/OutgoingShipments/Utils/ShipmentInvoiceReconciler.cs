using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.OutgoingShipments.Utils;

/// <summary>
/// What reconciliation had to change about an item that was <em>already</em> split across invoices.
/// </summary>
public enum InvoiceAdjustmentKind
{
    /// <summary>Pieces appeared and were added to the ordering client's first invoice.</summary>
    QuantityAdded = 0,

    /// <summary>Pieces disappeared and were trimmed off the split.</summary>
    QuantityRemoved = 1,

    /// <summary>The source item left the shipment; its invoice lines were dropped.</summary>
    SourceRemoved = 2
}

/// <summary>
/// One change reconciliation made to an existing split, for reporting back to the user.
/// </summary>
public sealed record InvoiceAdjustment
{
    /// <summary>What kind of change this was.</summary>
    public InvoiceAdjustmentKind Kind { get; init; }

    /// <summary>Which kind of shipment item it concerned.</summary>
    public InvoiceLineSourceKind SourceKind { get; init; }

    /// <summary>
    /// Display name of the affected item, when the graph had enough loaded to resolve it.
    /// </summary>
    public string? ItemName { get; init; }

    /// <summary>Number of pieces added, removed, or dropped.</summary>
    public int Quantity { get; init; }
}

/// <summary>
/// Outcome of a reconciliation pass.
/// </summary>
public sealed record ReconcileResult
{
    /// <summary>
    /// Changes made to already-split items. Empty when the pass only materialised a default
    /// split — that is not a change the user needs to be told about.
    /// </summary>
    public IReadOnlyList<InvoiceAdjustment> Adjustments { get; init; } = [];

    /// <summary>Invoices detached from the shipment; the caller deletes them.</summary>
    public IReadOnlyList<OutgoingShipmentInvoice> RemovedInvoices { get; init; } = [];

    /// <summary>Lines detached from their invoice; the caller deletes them.</summary>
    public IReadOnlyList<OutgoingShipmentInvoiceLine> RemovedLines { get; init; } = [];
}

/// <summary>
/// Keeps a shipment's invoice split consistent with what the shipment actually carries.
/// </summary>
/// <remarks>
/// This is the only place that changes the split implicitly, so it is also the only place
/// where drift bugs can live. Deliberately free of <c>DbContext</c>: it mutates a loaded
/// entity graph and reports what the caller must delete, which keeps it unit-testable
/// without a database.
///
/// Sources must be persisted — lines are matched to source items by foreign key, so an
/// item with <c>Id == 0</c> cannot be told apart from any other unsaved item.
/// </remarks>
public static class ShipmentInvoiceReconciler
{
    /// <summary>
    /// A billable item of the shipment, flattened to what reconciliation needs.
    /// </summary>
    private sealed record BillableSource
    {
        public required InvoiceLineSourceKind Kind { get; init; }
        public required long ItemId { get; init; }
        public required long OrderingClientId { get; init; }
        public required int Quantity { get; init; }
        public string? Name { get; init; }

        /// <summary>
        /// The ordering client entity, when the graph had it loaded. Carried so a freshly created
        /// invoice gets its navigation filled — the response is mapped from the same in-memory
        /// graph, and a null navigation would surface as a blank client name.
        /// </summary>
        public Client? OrderingClient { get; init; }

        public (InvoiceLineSourceKind, long) Key => (Kind, ItemId);
    }

    /// <summary>
    /// Brings a shipment's invoices in line with its items.
    /// </summary>
    /// <remarks>
    /// Guarantees on return:
    /// <list type="number">
    /// <item>every client with billable items has at least one invoice,</item>
    /// <item>every line points at an item the shipment still carries,</item>
    /// <item>for every billable item, the quantities of its invoice lines <em>and</em> its
    /// private lines sum to the item's quantity.</item>
    /// </list>
    /// </remarks>
    /// <param name="split">
    /// Shipment with stops (incl. orders and their items), extra items and invoices (incl.
    /// lines) loaded, together with its private lines.
    /// </param>
    public static ReconcileResult Reconcile(ShipmentInvoiceSplit split)
    {
        ArgumentNullException.ThrowIfNull(split);

        var shipment = split.Shipment;
        var privateLines = split.PrivateLines;

        var adjustments = new List<InvoiceAdjustment>();
        var removedInvoices = new List<OutgoingShipmentInvoice>();
        var removedLines = new List<OutgoingShipmentInvoiceLine>();

        var sources = CollectSources(shipment);
        var sourceKeys = sources.Select(s => s.Key).ToHashSet();
        var billableClientIds = sources.Select(s => s.OrderingClientId).Distinct().ToList();

        // 1. Every client receiving something gets an invoice to receive it on.
        foreach (var group in sources.GroupBy(s => s.OrderingClientId))
        {
            if (shipment.Invoices.All(i => i.ClientId != group.Key))
                shipment.Invoices.Add(BuildInvoice(shipment, group.Key,
                    group.Select(s => s.OrderingClient).FirstOrDefault(c => c is not null), sequence: 1));
        }

        // 2. Lines whose source item is no longer on the shipment — private ones included: the
        //    pieces are gone, so there is nothing left to keep off an invoice.
        foreach (var invoice in shipment.Invoices.ToList())
        {
            foreach (var line in invoice.Lines.ToList())
            {
                if (sourceKeys.Contains(KeyOf(line)))
                    continue;

                adjustments.Add(SourceRemoved(line));
                invoice.Lines.Remove(line);
                removedLines.Add(line);
            }
        }

        foreach (var line in privateLines.ToList())
        {
            if (sourceKeys.Contains(KeyOf(line)))
                continue;

            adjustments.Add(SourceRemoved(line));
            privateLines.Remove(line);
            removedLines.Add(line);
        }

        // 3. Invoices with no reason left to exist. An invoice of a client who no longer
        //    orders anything is kept while it still holds cross-billed lines — that is a
        //    deliberate decision by the user, not leftover state.
        foreach (var invoice in shipment.Invoices.ToList())
        {
            if (billableClientIds.Contains(invoice.ClientId) || invoice.Lines.Count > 0)
                continue;

            shipment.Invoices.Remove(invoice);
            removedInvoices.Add(invoice);
        }

        // 4. Cover every source item exactly once, counting private pieces as covered — they are
        //    accounted for, just not billed.
        foreach (var source in sources)
        {
            var placements = shipment.Invoices
                .SelectMany(i => i.Lines.Select(l => (Invoice: (OutgoingShipmentInvoice?)i, Line: l)))
                .Concat(privateLines.Select(l => (Invoice: (OutgoingShipmentInvoice?)null, Line: l)))
                .Where(x => KeyOf(x.Line) == source.Key)
                .ToList();

            var assigned = placements.Sum(x => x.Line.Quantity);
            var diff = source.Quantity - assigned;

            switch (diff)
            {
                case > 0:
                {
                    // assigned == 0 means this item had no split yet, so this is the default
                    // split being materialised — not drift, and not worth reporting.
                    if (assigned > 0)
                        adjustments.Add(Adjustment(InvoiceAdjustmentKind.QuantityAdded, source, diff));

                    // Surplus is always billed. Pieces become private only when the user says so.
                    var home = HomeInvoiceFor(shipment, source);
                    var existing = home.Lines.FirstOrDefault(l => KeyOf(l) == source.Key);
                    if (existing is not null)
                        existing.Quantity += diff;
                    else
                        home.Lines.Add(BuildLine(shipment, source, diff));
                    break;
                }
                case < 0:
                {
                    var over = -diff;
                    adjustments.Add(Adjustment(InvoiceAdjustmentKind.QuantityRemoved, source, over));

                    // Private pieces go first, then other clients' invoices, then the ordering
                    // client's extra invoices, and their first invoice last. Taking from the owner
                    // first would make the product vanish from the invoice of whoever ordered it
                    // and survive only on someone else's — worse than losing the exception. Losing
                    // the private mark is the mildest failure of the three: it is visible on the
                    // invoice and reported in the banner, whereas silently un-billing pieces would
                    // cost money nobody notices.
                    var order = placements
                        .OrderBy(x => TrimRank(x.Invoice, source))
                        .ThenByDescending(x => x.Invoice?.Sequence ?? 0);

                    foreach (var placement in order)
                    {
                        if (over == 0)
                            break;

                        var take = Math.Min(over, placement.Line.Quantity);
                        placement.Line.Quantity -= take;
                        over -= take;
                    }

                    break;
                }
            }
        }

        // 5. Lines trimmed to nothing.
        foreach (var invoice in shipment.Invoices)
        {
            foreach (var line in invoice.Lines.Where(l => l.Quantity <= 0).ToList())
            {
                invoice.Lines.Remove(line);
                removedLines.Add(line);
            }
        }

        foreach (var line in privateLines.Where(l => l.Quantity <= 0).ToList())
        {
            privateLines.Remove(line);
            removedLines.Add(line);
        }

        return new ReconcileResult
        {
            Adjustments = adjustments,
            RemovedInvoices = removedInvoices,
            RemovedLines = removedLines
        };
    }

    /// <summary>
    /// Flattens everything the shipment bills for: order items of its order stops, plus the
    /// client and custom extra items that have a client recorded.
    /// </summary>
    /// <remarks>
    /// Inventory extra items are absent by design — they return to our own stock.
    /// Extra items without a <c>ClientId</c> are skipped rather than guessed at; they predate
    /// invoicing and there is nobody to bill them to.
    /// </remarks>
    private static List<BillableSource> CollectSources(OutgoingShipment shipment)
    {
        var sources = new List<BillableSource>();

        foreach (var stop in shipment.Stops.Where(s => s.ClientOrder is not null).OrderBy(s => s.Order))
        {
            foreach (var item in stop.ClientOrder!.OrderItems)
            {
                sources.Add(new BillableSource
                {
                    Kind = InvoiceLineSourceKind.OrderItem,
                    ItemId = RequirePersisted(item.Id, nameof(OrderItem)),
                    OrderingClientId = stop.ClientOrder.ClientId,
                    OrderingClient = stop.ClientOrder.Client,
                    Quantity = item.Quantity,
                    Name = item.Product?.Name
                });
            }
        }

        // Inventory sourcing is not a billable source: those pieces are already covered
        // by the order item they fulfil, so billing them again would double-charge.
        foreach (var (item, order) in ShipmentInvoiceGraph.CustomExtrasOf(shipment))
        {
            sources.Add(new BillableSource
            {
                Kind = InvoiceLineSourceKind.CustomExtraItem,
                ItemId = RequirePersisted(item.Id, nameof(OrderCustomExtraItem)),
                OrderingClientId = order.ClientId,
                OrderingClient = order.Client,
                Quantity = item.Quantity,
                Name = item.Description
            });
        }

        return sources;
    }

    /// <summary>
    /// The invoice a client's pieces default onto — their lowest-sequence one.
    /// </summary>
    private static OutgoingShipmentInvoice HomeInvoiceFor(OutgoingShipment shipment, BillableSource source)
    {
        var home = shipment.Invoices
            .Where(i => i.ClientId == source.OrderingClientId)
            .OrderBy(i => i.Sequence)
            .FirstOrDefault();

        if (home is not null)
            return home;

        home = BuildInvoice(shipment, source.OrderingClientId, source.OrderingClient,
            sequence: NextSequenceFor(shipment, source.OrderingClientId));
        shipment.Invoices.Add(home);
        return home;
    }

    /// <summary>
    /// Next free sequence number for a client's invoices within the shipment.
    /// </summary>
    public static int NextSequenceFor(OutgoingShipment shipment, long clientId)
    {
        var used = shipment.Invoices.Where(i => i.ClientId == clientId).Select(i => i.Sequence).ToList();
        return used.Count == 0 ? 1 : used.Max() + 1;
    }

    private static OutgoingShipmentInvoice BuildInvoice(OutgoingShipment shipment, long clientId, Client? client, int sequence) =>
        new()
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipment = shipment,
            ClientId = clientId,
            Client = client!,
            Sequence = sequence
        };

    /// <summary>
    /// Where a placement sits in the trim order: private pieces first, then other clients'
    /// invoices, then the ordering client's own.
    /// </summary>
    private static int TrimRank(OutgoingShipmentInvoice? invoice, BillableSource source) =>
        invoice is null ? 0
        : invoice.ClientId != source.OrderingClientId ? 1
        : 2;

    private static InvoiceAdjustment SourceRemoved(OutgoingShipmentInvoiceLine line) =>
        new()
        {
            Kind = InvoiceAdjustmentKind.SourceRemoved,
            SourceKind = line.SourceKind,
            ItemName = NameOf(line),
            Quantity = line.Quantity
        };

    private static OutgoingShipmentInvoiceLine BuildLine(OutgoingShipment shipment, BillableSource source, int quantity)
    {
        var line = new OutgoingShipmentInvoiceLine
        {
            PublicId = Guid.NewGuid(),
            OutgoingShipmentId = shipment.Id,
            SourceKind = source.Kind,
            Quantity = quantity
        };

        switch (source.Kind)
        {
            case InvoiceLineSourceKind.OrderItem:
                line.OrderItemId = source.ItemId;
                break;
            case InvoiceLineSourceKind.CustomExtraItem:
                line.CustomExtraItemId = source.ItemId;
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(source), source.Kind, "Unknown invoice line source kind.");
        }

        return line;
    }

    /// <summary>
    /// Identity of the item a line bills for.
    /// </summary>
    private static (InvoiceLineSourceKind, long) KeyOf(OutgoingShipmentInvoiceLine line) =>
        (line.SourceKind, line.SourceKind switch
        {
            InvoiceLineSourceKind.OrderItem => line.OrderItemId ?? 0,
            InvoiceLineSourceKind.CustomExtraItem => line.CustomExtraItemId ?? 0,
            _ => 0
        });

    /// <summary>
    /// Best-effort display name for a line whose source has already left the shipment.
    /// </summary>
    private static string? NameOf(OutgoingShipmentInvoiceLine line) => line.SourceKind switch
    {
        InvoiceLineSourceKind.OrderItem => line.OrderItem?.Product?.Name,
        InvoiceLineSourceKind.CustomExtraItem => line.CustomExtraItem?.Description,
        _ => null
    };

    private static InvoiceAdjustment Adjustment(InvoiceAdjustmentKind kind, BillableSource source, int quantity) =>
        new()
        {
            Kind = kind,
            SourceKind = source.Kind,
            ItemName = source.Name,
            Quantity = quantity
        };

    /// <summary>
    /// Lines are matched to sources by foreign key, so an unsaved item cannot be told apart
    /// from any other unsaved item. Failing loudly beats silently merging two items' splits.
    /// </summary>
    private static long RequirePersisted(long id, string entityName) =>
        id == 0
            ? throw new InvalidOperationException(
                $"{entityName} must be persisted before its invoice split can be reconciled.")
            : id;
}
