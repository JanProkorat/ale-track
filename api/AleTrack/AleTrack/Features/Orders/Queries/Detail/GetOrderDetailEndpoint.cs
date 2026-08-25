using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Orders.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Orders.Queries.Detail;

/// <summary>
/// Request to get detail of <see cref="Order"/>
/// </summary>
public sealed record GetOrderDetailRequest
{
    /// <summary>
    /// ID of related <see cref="Order"/>
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Represents an endpoint for retrieving the details of an <see cref="Order"/>.
/// </summary>
public sealed class GetOrderDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetOrderDetailRequest, OrderDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("orders/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Orders, PermissionLevel.View)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetOrderDetailEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets order detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of an order";
            s.SetNotFoundResponse("Order");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetOrderDetailRequest req, CancellationToken ct)
    {
        // AsNoTracking is mandatory, not an optimization: DeliveryAddress
        // projects an owned Address via the untranslatable `ToDto()`, which EF
        // client-evaluates and therefore materializes. A tracking query cannot
        // track an owned entity whose owner is absent from the result — this
        // projection returns OrderDto, not Order — so it throws "owned entities
        // cannot be tracked without their owner". The mocked test suite runs
        // LINQ-to-Objects and has no tracking semantics, so it cannot catch a
        // regression here; every sibling endpoint projecting an address is
        // AsNoTracking for the same reason.
        var order = await dbContext.Orders
            .AsNoTracking()
            .Where(o => o.PublicId == req.Id)
            .Select(o => new OrderDto
            {
                Id = o.PublicId,
                RequiredDeliveryDate = o.RequiredDeliveryDate,
                ActualDeliveryDate = o.ActualDeliveryDate,
                State = o.State,
                CreatedDate = o.CreatedDate,
                Notes = o.Notes
                    .OrderBy(n => n.DateCreated)
                    .Select(n => new OrderNoteDto
                    {
                        Id = n.PublicId,
                        Text = n.Text,
                        DateCreated = n.DateCreated
                    })
                    .ToList(),
                Client = new ClientInfoDto
                {
                    Id = o.Client.PublicId,
                    Name = o.Client.Name
                },
                DeliveryAddress = new OrderDeliveryAddressDto
                {
                    Kind = o.DeliveryAddressKind,
                    PlaceId = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.PublicId : null,
                    PlaceName = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.Name : null,
                    PlaceNote = o.ClientDeliveryPlace != null ? o.ClientDeliveryPlace.Note : null,
                    Address =
                        o.DeliveryAddressKind == DeliveryAddressKind.DeliveryPlace && o.ClientDeliveryPlace != null
                            ? o.ClientDeliveryPlace.Address.ToDto()
                            : o.DeliveryAddressKind == DeliveryAddressKind.Contact && o.Client.ContactAddress != null
                                ? o.Client.ContactAddress.ToDto()
                                : o.Client.OfficialAddress != null
                                    ? o.Client.OfficialAddress.ToDto()
                                    : o.Client.ContactAddress != null
                                        ? o.Client.ContactAddress.ToDto()
                                        : null
                },
                // Product order per ProductOrdering; spelled out because EF cannot
                // translate a helper call inside a projection.
                OrderItems = o.OrderItems
                    .OrderBy(i => i.Product.Brewery.DisplayOrder)                    .ThenBy(i => i.Product.Type == ProductType.Lemonade
                         || i.Product.Type == ProductType.Merchandise
                         || i.Product.Type == ProductType.Other ? 1 : 0)
                    .ThenBy(i => i.Product.PlatoDegree == null)
                    .ThenBy(i => i.Product.PlatoDegree)
                    .ThenBy(i => i.Product.PackageSize)
                    .ThenBy(i => i.Product.Name)
                    .Select(i => new OrderItemDto
                    {
                        Id = i.PublicId,
                        OrderId = i.Order.PublicId,
                        Quantity = i.Quantity,
                        ProductId = i.Product.PublicId,
                        ProductName = i.Product.Name,
                        ReminderState = i.ReminderState,
                        Note = i.Note,
                        BreweryDisplayOrder = i.Product.Brewery.DisplayOrder,
                        DisplayOrder = i.Product.DisplayOrder
                    })
                    .ToList(),
                Returns = o.Returns
                    .Select(r => new OrderReturnDto
                    {
                        Id = r.PublicId,
                        Name = r.Name,
                        Quantity = r.Quantity,
                        Note = r.Note
                    })
                    .ToList(),
                CustomExtraItems = o.CustomExtraItems
                    .Select(e => new OrderCustomExtraItemDto
                    {
                        Id = e.PublicId,
                        Description = e.Description,
                        Quantity = e.Quantity,
                        Note = e.Note,
                        IsLoadingConfirmed = e.IsShipmentLoadingConfirmed
                    })
                    .ToList(),
                // Priced live off the good's own list: its Fill price when it has one, else the
                // first. No client-specific override and no snapshot — a supplier charges every
                // client the same, and these lines never reach the shipment content snapshot.
                SupplierGoodItems = o.SupplierGoodItems
                    .OrderBy(i => i.SupplierGood.Supplier.Name)
                    .ThenBy(i => i.SupplierGood.Name)
                    .Select(i => new OrderSupplierGoodItemDto
                    {
                        Id = i.PublicId,
                        SupplierGoodId = i.SupplierGood.PublicId,
                        Quantity = i.Quantity,
                        Note = i.Note,
                        GoodName = i.SupplierGood.Name,
                        GoodSize = i.SupplierGood.Size,
                        SupplierId = i.SupplierGood.Supplier.PublicId,
                        SupplierName = i.SupplierGood.Supplier.Name,
                        UnitPriceWithVat = i.SupplierGood.Prices
                            .OrderBy(p => p.Kind == SupplierChargeKind.Fill ? 0 : 1)
                            .Select(p => (decimal?)p.PriceWithVat)
                            .FirstOrDefault(),
                        ChargeKind = i.SupplierGood.Prices
                            .OrderBy(p => p.Kind == SupplierChargeKind.Fill ? 0 : 1)
                            .Select(p => (SupplierChargeKind?)p.Kind)
                            .FirstOrDefault()
                    })
                    .ToList(),
                // The Fakturace row covering this order, matched on the PAYING client — see the
                // note at the shipment detail's own copy of this, and InvoiceReadiness for why.
                // A cancelled run is excluded for the same reason the shipment below is: that
                // order is back to being unplanned, so it has no row to finish.
                IsInvoiceReady =
                    o.OutgoingShipmentStop != null
                    && o.OutgoingShipmentStop.OutgoingShipment.State != OutgoingShipmentState.Cancelled
                    && o.OutgoingShipmentStop.OutgoingShipment.InvoiceConfirmations.Any(c => c.IsReady
                        && c.ClientId == (o.Client.InvoicingClientId ?? o.ClientId)),
                // Shipments carry no global soft-delete filter, so a cancelled run
                // has to be excluded here — an order whose run was cancelled is
                // back to being unplanned and shows no shipment at all.
                OutgoingShipment =
                    o.OutgoingShipmentStop == null
                    || o.OutgoingShipmentStop.OutgoingShipment.State == OutgoingShipmentState.Cancelled
                        ? null
                        : new OrderOutgoingShipmentDto
                        {
                            Id = o.OutgoingShipmentStop.OutgoingShipment.PublicId,
                            Name = o.OutgoingShipmentStop.OutgoingShipment.Name,
                            State = o.OutgoingShipmentStop.OutgoingShipment.State,
                            DeliveryDate = o.OutgoingShipmentStop.OutgoingShipment.DeliveryDate,
                            StopOrder = o.OutgoingShipmentStop.Order,
                            StopCount = o.OutgoingShipmentStop.OutgoingShipment.Stops.Count,
                            VehicleName = o.OutgoingShipmentStop.OutgoingShipment.Vehicle != null
                                ? o.OutgoingShipmentStop.OutgoingShipment.Vehicle.Name
                                : null,
                            DriverNames = o.OutgoingShipmentStop.OutgoingShipment.Drivers
                                .Select(d => d.Driver.FirstName + " " + d.Driver.LastName)
                                .ToList()
                        }
            })
            .FirstOrDefaultAsync(ct);
        
        if (order is null)
            ThrowHelper.PublicEntityNotFound(nameof(AleTrack.Entities.Order), req.Id);

        await FillItemPricesAsync(order, ct);

        await Send.OkAsync(order, cancellation: ct);
    }

    /// <summary>
    /// Fills each item's price: the frozen snapshot once <see cref="OutgoingShipmentStopItem"/>
    /// rows exist for it (a loaded run's invoice is the only truth at that point, so
    /// <see cref="OrderItemDto.ListPriceWithVat"/> is left null — the snapshot never recorded
    /// what the ceník said, and showing today's beside a frozen number would mislead), otherwise
    /// the client's live-resolved price.
    /// </summary>
    private async Task FillItemPricesAsync(OrderDto order, CancellationToken ct)
    {
        if (order.OrderItems.Count == 0)
        {
            return;
        }

        var itemPublicIds = order.OrderItems.Select(i => i.Id).ToList();

        // The projection above only carries the public ids the UI needs, so the internal
        // OrderItem id (the snapshot's provenance key) and the product's catalog price
        // (what Resolve needs) are loaded here in one query, keyed by the item's public id.
        var pricingByItemPublicId = await dbContext.OrderItems
            .AsNoTracking()
            .Where(i => itemPublicIds.Contains(i.PublicId))
            .Select(i => new
            {
                i.PublicId,
                i.Id,
                ProductId = i.Product.Id,
                ProductPriceWithVat = i.Product.PriceWithVat
            })
            .ToDictionaryAsync(i => i.PublicId, i => i, ct);

        var orderItemIds = pricingByItemPublicId.Values.Select(i => i.Id).ToList();

        // A cancelled run's snapshot must not outlive the cancellation: OutgoingShipment
        // carries no soft-delete filter, ResetOrderItemsForReuse never clears the rows on
        // Loaded -> Cancelled, and OrderMutability deliberately leaves Cancelled editable
        // again — the same exclusion the shipment-link projection above already applies.
        //
        // Grouped rather than a straight ToDictionaryAsync: Cancelled -> Created is an allowed
        // shipment transition, so one order can end up carried by two runs that are both
        // non-Cancelled and both loaded, leaving two live snapshot rows for the same order item.
        // A duplicate key would otherwise throw here and 500 the order detail page. These rows
        // are only ever freshly inserted (never updated) at the moment a run transitions into
        // Loaded, so the highest internal Id is the most recently loaded run's price — the best
        // available proxy for "the run whose snapshot the caller actually wants to see."
        var frozenPriceByOrderItemId = (await dbContext.OutgoingShipmentStopItems
                .AsNoTracking()
                .Where(i => i.OrderItemId != null
                         && orderItemIds.Contains(i.OrderItemId.Value)
                         && i.Stop.OutgoingShipment.State != OutgoingShipmentState.Cancelled)
                .Select(i => new { OrderItemId = i.OrderItemId!.Value, i.Id, i.UnitPriceWithVat })
                .ToListAsync(ct))
            .GroupBy(i => i.OrderItemId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(i => i.Id).First().UnitPriceWithVat);

        var priceList = await ClientPriceResolver.LoadByPublicIdAsync(dbContext, order.Client.Id, ct);

        // Unreachable today — this query and the main projection read the same OrderItem
        // set moments apart in the same request — but if a concurrent delete ever did make
        // an item disappear here, a displayed 0 would be a worse failure than falling back
        // to the product's own current catalog price. Queried lazily, by product PublicId
        // (already on every OrderItemDto), only if a miss actually occurs.
        Dictionary<Guid, Product>? fallbackProductsByPublicId = null;

        foreach (var item in order.OrderItems)
        {
            if (!pricingByItemPublicId.TryGetValue(item.Id, out var pricing))
            {
                fallbackProductsByPublicId ??= await LoadFallbackProductsAsync(order, ct);

                if (fallbackProductsByPublicId.TryGetValue(item.ProductId, out var fallbackProduct))
                {
                    var fallbackResolved = priceList.Resolve(fallbackProduct);
                    item.UnitPriceWithVat = fallbackResolved.PriceWithVat;
                    item.ListPriceWithVat = fallbackResolved.ListPriceWithVat;
                }

                continue;
            }

            if (frozenPriceByOrderItemId.TryGetValue(pricing.Id, out var frozenPrice))
            {
                item.UnitPriceWithVat = frozenPrice;
                continue;
            }

            var resolved = priceList.Resolve(new Product
            {
                Id = pricing.ProductId,
                PriceWithVat = pricing.ProductPriceWithVat
            });

            item.UnitPriceWithVat = resolved.PriceWithVat;
            item.ListPriceWithVat = resolved.ListPriceWithVat;
        }
    }

    /// <summary>
    /// Loads the current catalog price for every product on <paramref name="order"/>'s items,
    /// keyed by the product's public id — the fallback path <see cref="FillItemPricesAsync"/>
    /// takes when an item has gone missing from its own re-query by the time it runs.
    /// </summary>
    private async Task<Dictionary<Guid, Product>> LoadFallbackProductsAsync(OrderDto order, CancellationToken ct)
    {
        var productPublicIds = order.OrderItems.Select(i => i.ProductId).ToList();

        return await dbContext.Products
            .AsNoTracking()
            .Where(p => productPublicIds.Contains(p.PublicId))
            .Select(p => new { p.PublicId, p.Id, p.PriceWithVat })
            .ToDictionaryAsync(p => p.PublicId, p => new Product { Id = p.Id, PriceWithVat = p.PriceWithVat }, ct);
    }
}