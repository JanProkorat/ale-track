using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Common.Options;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AleTrack.Features.OutgoingShipments.Queries.Detail;

/// <summary>
/// Request to get details of an outgoing shipment
/// </summary>
public sealed record GetOutgoingShipmentDetailRequest
{
    /// <summary>
    /// ID of the outgoing shipment to retrieve details for
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint responsible for retrieving details of an outgoing shipment.
/// </summary>
/// <param name="dbContext"></param>
/// <param name="companyOptions"></param>
/// <param name="driverScope"></param>
public sealed class GetOutgoingShipmentDetailEndpoint(
    AleTrackDbContext dbContext,
    IOptions<CompanyOptions> companyOptions,
    IDriverScope driverScope)
    : Endpoint<GetOutgoingShipmentDetailRequest, OutgoingShipmentDetailDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .Produces<OutgoingShipmentDetailDto>()
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetOutgoingShipmentDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Retrieves details of an existing outgoing shipment";
                s.Responses[StatusCodes.Status200OK] = "Outgoing shipment details retrieved";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetOutgoingShipmentDetailRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var company = companyOptions.Value;
        var companyAddress = company.FormatAddress();

        var outgoingShipment = await dbContext.OutgoingShipments
            .Where(os => os.PublicId == req.Id)
            .Select(os => new OutgoingShipmentDetailDto
            {
                Name = os.Name,
                Id = os.PublicId,
                State = os.State,
                DeliveryDate = os.DeliveryDate,
                VehicleId = os.Vehicle != null ? os.Vehicle.PublicId : null,
                StartPointKind = os.StartPointKind,
                StartBreweryId = os.StartBrewery != null ? os.StartBrewery.PublicId : null,
                StartBreweryAddressKind = os.StartBreweryAddressKind,
                StartPointName = os.StartBrewery != null ? os.StartBrewery.Name : company.Name,
                // Resolves from whichever address the shipment actually chose — a brewery is
                // not always loaded at its official address. Property access and a ternary
                // only, no method calls, so this stays translatable.
                StartPointAddress = os.StartBrewery != null
                    ? (os.StartBreweryAddressKind == DeliveryAddressKind.Contact && os.StartBrewery.ContactAddress != null
                        ? os.StartBrewery.ContactAddress.StreetName + " " + os.StartBrewery.ContactAddress.StreetNumber
                            + ", " + os.StartBrewery.ContactAddress.Zip + " " + os.StartBrewery.ContactAddress.City
                        : os.StartBrewery.OfficialAddress.StreetName + " " + os.StartBrewery.OfficialAddress.StreetNumber
                            + ", " + os.StartBrewery.OfficialAddress.Zip + " " + os.StartBrewery.OfficialAddress.City)
                    : companyAddress,
                StartPointLatitude = os.StartBrewery != null
                    ? (os.StartBreweryAddressKind == DeliveryAddressKind.Contact && os.StartBrewery.ContactAddress != null
                        ? os.StartBrewery.ContactAddress.Latitude
                        : os.StartBrewery.OfficialAddress.Latitude)
                    : company.Latitude,
                StartPointLongitude = os.StartBrewery != null
                    ? (os.StartBreweryAddressKind == DeliveryAddressKind.Contact && os.StartBrewery.ContactAddress != null
                        ? os.StartBrewery.ContactAddress.Longitude
                        : os.StartBrewery.OfficialAddress.Longitude)
                    : company.Longitude,
                DriverIds = os.Drivers
                    .Select(d => d.Driver.PublicId)
                    .ToList(),
                Vehicle = os.Vehicle != null
                    ? new ShipmentVehicleDto
                    {
                        Id = os.Vehicle.PublicId,
                        Name = os.Vehicle.Name,
                        MaxWeight = os.Vehicle.MaxWeight
                    }
                    : null,
                // Ordered by last name then first name, matching ShipmentExportQuery's own
                // driver ordering, so the same run reads the same driver order everywhere.
                Drivers = os.Drivers
                    .OrderBy(d => d.Driver.LastName)
                    .ThenBy(d => d.Driver.FirstName)
                    .Select(d => new ShipmentDriverDto
                    {
                        Id = d.Driver.PublicId,
                        FirstName = d.Driver.FirstName,
                        LastName = d.Driver.LastName,
                        PhoneNumber = d.Driver.PhoneNumber,
                        Color = d.Driver.Color
                    })
                    .ToList(),
                Stops = os.Stops
                    .Select(s => new OutgoingShipmentStopDto
                    {
                        Id = s.PublicId,
                        Kind = s.Kind,
                        Order = s.Order,
                        ClientId = s.ClientOrder != null ? s.ClientOrder.Client.PublicId : null,
                        ClientName = s.ClientOrder != null ? s.ClientOrder.Client.Name : null,
                        OfficialAddress = s.ClientOrder != null && s.ClientOrder.Client.OfficialAddress != null
                            ? s.ClientOrder.Client.OfficialAddress.ToDto()
                            : null,
                        ContactAddress = s.ClientOrder != null && s.ClientOrder.Client.ContactAddress != null
                            ? s.ClientOrder.Client.ContactAddress.ToDto()
                            : null,
                        OrderId = s.ClientOrder != null ? s.ClientOrder.PublicId : null,
                        SelectedAddressKind = s.SelectedAddressKind,
                        // No !IsDeleted condition — a removed place must still
                        // render on the shipments that already used it.
                        DeliveryPlace = s.ClientDeliveryPlace != null
                            ? new ClientDeliveryPlaceDto
                            {
                                Id = s.ClientDeliveryPlace.PublicId,
                                Name = s.ClientDeliveryPlace.Name,
                                Note = s.ClientDeliveryPlace.Note,
                                Address = s.ClientDeliveryPlace.Address.ToDto()
                            }
                            : null,
                        IsAddressOverridden = s.IsAddressOverridden,
                        AddressChangedAt = s.AddressChangedAt,
                        OrderDeliveryAddress = s.ClientOrder != null
                            ? new OrderDeliveryAddressDto
                            {
                                Kind = s.ClientOrder.DeliveryAddressKind,
                                PlaceId = s.ClientOrder.ClientDeliveryPlace != null ? s.ClientOrder.ClientDeliveryPlace.PublicId : null,
                                PlaceName = s.ClientOrder.ClientDeliveryPlace != null ? s.ClientOrder.ClientDeliveryPlace.Name : null,
                                PlaceNote = s.ClientOrder.ClientDeliveryPlace != null ? s.ClientOrder.ClientDeliveryPlace.Note : null,
                                Address =
                                    s.ClientOrder.DeliveryAddressKind == DeliveryAddressKind.DeliveryPlace && s.ClientOrder.ClientDeliveryPlace != null
                                        ? s.ClientOrder.ClientDeliveryPlace.Address.ToDto()
                                        : s.ClientOrder.DeliveryAddressKind == DeliveryAddressKind.Contact && s.ClientOrder.Client.ContactAddress != null
                                            ? s.ClientOrder.Client.ContactAddress.ToDto()
                                            : s.ClientOrder.Client.OfficialAddress != null
                                                ? s.ClientOrder.Client.OfficialAddress.ToDto()
                                                : s.ClientOrder.Client.ContactAddress != null
                                                    ? s.ClientOrder.Client.ContactAddress.ToDto()
                                                    : null
                            }
                            : null,
                        Label = s.Label,
                        Note = s.Note,
                        Latitude = s.Latitude,
                        Longitude = s.Longitude,
                        SupplierId = s.Supplier != null ? s.Supplier.PublicId : null,
                        SupplierAddress = s.Supplier != null ? s.Supplier.OfficialAddress.ToDto() : null,
                        // Product order per ProductOrdering.
                        Products = s.ClientOrder != null
                            ? s.ClientOrder.OrderItems
                                .OrderBy(oi => oi.Product.Brewery.DisplayOrder)
                                .ThenBy(oi => oi.Product.Type == ProductType.Lemonade
                                           || oi.Product.Type == ProductType.Merchandise
                                           || oi.Product.Type == ProductType.Other ? 1 : 0)
                                .ThenBy(oi => oi.Product.PlatoDegree == null)
                                .ThenBy(oi => oi.Product.PlatoDegree)
                                .ThenBy(oi => oi.Product.PackageSize)
                                .ThenBy(oi => oi.Product.Name)
                                .Select(oi => new OutgoingShipmentOrderItemDto
                                {
                                    Id = oi.Product.PublicId,
                                    Name = oi.Product.Name,
                                    Quantity = oi.Quantity,
                                    Kind = oi.Product.Kind,
                                    PackageSize = oi.Product.PackageSize,
                                    PlatoDegree = oi.Product.PlatoDegree,
                                    Type = oi.Product.Type,
                                    Weight = oi.Product.Weight,
                                    BreweryId = oi.Product.Brewery.PublicId,
                                    BreweryName = oi.Product.Brewery.Name,
                                    BreweryDisplayOrder = oi.Product.Brewery.DisplayOrder,
                                    OrderItemId = oi.PublicId,
                                    Note = oi.Note,
                                    QuantityFromInventory = oi.QuantityFromInventory,
                                    InventoryItemId = oi.InventoryItem != null ? oi.InventoryItem.PublicId : null,
                                    InventoryItemName = oi.InventoryItem != null
                                        ? (oi.InventoryItem.Name ?? (oi.InventoryItem.Product != null ? oi.InventoryItem.Product.Name : null))
                                        : null,
                                    InventoryItemAvailable = oi.InventoryItem != null ? oi.InventoryItem.Quantity : null
                                })
                                .ToList()
                            : new List<OutgoingShipmentOrderItemDto>(),
                        Returns = s.ClientOrder != null
                            ? s.ClientOrder.Returns
                                .Select(r => new OrderReturnDto
                                {
                                    Id = r.PublicId,
                                    Name = r.Name,
                                    Quantity = r.Quantity,
                                    Note = r.Note
                                })
                                .ToList()
                            : new List<OrderReturnDto>(),
                        CustomExtraItems = s.ClientOrder != null
                            ? s.ClientOrder.CustomExtraItems
                                .Select(e => new OrderCustomExtraItemDto
                                {
                                    Id = e.PublicId,
                                    Description = e.Description,
                                    Quantity = e.Quantity,
                                    Note = e.Note,
                                    IsLoadingConfirmed = e.IsShipmentLoadingConfirmed
                                })
                                .ToList()
                            : new List<OrderCustomExtraItemDto>(),
                        // Oldest first, matching the order detail's own ordering
                        // so a note reads the same on both screens.
                        Notes = s.ClientOrder != null
                            ? s.ClientOrder.Notes
                                .OrderBy(n => n.DateCreated)
                                .Select(n => new OrderNoteDto
                                {
                                    Id = n.PublicId,
                                    Text = n.Text,
                                    DateCreated = n.DateCreated
                                })
                                .ToList()
                            : new List<OrderNoteDto>()
                    })
                    .ToList(),
                RouteViaPoints = os.RouteViaPoints
                    .OrderBy(v => v.Order)
                    .Select(v => new RoutePointDto { Latitude = v.Latitude, Longitude = v.Longitude })
                    .ToList(),
                // Product order per ProductOrdering.
                StockPurchases = os.StockPurchases
                    .OrderBy(ei => ei.Product.Type == ProductType.Lemonade
                                || ei.Product.Type == ProductType.Merchandise
                                || ei.Product.Type == ProductType.Other ? 1 : 0)
                    .ThenBy(ei => ei.Product.PlatoDegree == null)
                    .ThenBy(ei => ei.Product.PlatoDegree)
                    .ThenBy(ei => ei.Product.PackageSize)
                    .ThenBy(ei => ei.Product.Name)
                    .Select(ei => new OutgoingShipmentStockPurchaseItemDto
                    {
                        Id = ei.PublicId,
                        Quantity = ei.Quantity,
                        Kind = ei.Product.Kind,
                        PackageSize = ei.Product.PackageSize,
                        PlatoDegree = ei.Product.PlatoDegree,
                        Type = ei.Product.Type,
                        BreweryId = ei.Product.Brewery.PublicId,
                        BreweryName = ei.Product.Brewery.Name,
                        BreweryDisplayOrder = ei.Product.Brewery.DisplayOrder,
                        IsShipmentLoadingConfirmed = ei.IsShipmentLoadingConfirmed,
                        ProductId = ei.Product.PublicId,
                        Name = ei.Product.Name
                    })
                    .ToList(),
                // Flattened across the stops: the card is one picking list for the whole run.
                // Sorted so the rows group by where they are collected and then by supplier —
                // the order they will actually be gathered in.
                //
                // Client and order come from the stop being walked, not from the line's own
                // Order back-reference: the stop already has them, and reading them off the
                // child would make this depend on a navigation nothing else here needs.
                SupplierGoods = os.Stops
                    .Where(s => s.ClientOrder != null)
                    .SelectMany(s => s.ClientOrder!.SupplierGoodItems
                        .Select(i => new OutgoingShipmentSupplierGoodDto
                        {
                            Id = i.PublicId,
                            SupplierGoodId = i.SupplierGood.PublicId,
                            Name = i.SupplierGood.Name,
                            Size = i.SupplierGood.Size,
                            Quantity = i.Quantity,
                            PickupSource = i.SupplierGood.PickupSource,
                            QuantityFromGarage = i.QuantityFromGarage,
                            GarageAvailable = i.SupplierGood.InventoryItem != null
                                ? i.SupplierGood.InventoryItem.Quantity
                                : null,
                            SupplierId = i.SupplierGood.Supplier.PublicId,
                            SupplierName = i.SupplierGood.Supplier.Name,
                            SupplierAddress = i.SupplierGood.Supplier.OfficialAddress.ToDto(),
                            ClientId = s.ClientOrder!.Client.PublicId,
                            ClientName = s.ClientOrder!.Client.Name,
                            OrderId = s.ClientOrder!.PublicId,
                            Note = i.Note
                        }))
                    .OrderBy(g => g.PickupSource)
                    .ThenBy(g => g.SupplierName)
                    .ThenBy(g => g.Name)
                    .ToList(),
                PurchaseInvoices = os.PurchaseInvoices
                    .OrderBy(pi => pi.Sequence)
                    .Select(pi => new OutgoingShipmentPurchaseInvoiceDto
                    {
                        Id = pi.PublicId,
                        Sequence = pi.Sequence,
                        Lines = pi.Lines
                            .Select(l => new OutgoingShipmentPurchaseInvoiceLineDto
                            {
                                ProductId = l.Product.PublicId,
                                Quantity = l.Quantity
                            })
                            .ToList()
                    })
                    .ToList(),
                LoadingStates = os.LoadingStates
                    .Select(ls => new OutgoingShipmentLoadingStateDto
                    {
                        ProductId = ls.Product.PublicId,
                        Sequence = ls.Sequence,
                        State = ls.State
                    })
                    .ToList(),
                PreparationSteps = os.PreparationSteps
                    .OrderBy(ps => ps.Order)
                    .Select(ps => new OutgoingShipmentPreparationStepDto
                    {
                        Id = ps.PublicId,
                        Order = ps.Order,
                        Label = ps.Label,
                        IsDone = ps.IsDone
                    })
                    .ToList(),
            })
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (outgoingShipment is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        ClampPurchaseInvoiceLines(outgoingShipment!);

        await Send.OkAsync(outgoingShipment, cancellation: ct);
    }

    /// <summary>
    /// Brings the purchase split we hand out inside the same invariant the write path enforces:
    /// no invoice may claim more of a product than the run buys of it.
    /// </summary>
    /// <remarks>
    /// Needed because the nakládka changes through endpoints that know nothing about this split —
    /// an order item's quantity, its sourcing, a stock purchase — so a stored line can fall out of
    /// range without any purchase-invoice endpoint being called. Clamping here rather than writing
    /// back keeps the GET side-effect free; the stored rows are corrected on the next write.
    ///
    /// Invoices are walked in sequence order, so when a total shrinks the later ones give up their
    /// claim first. The same rule as <see cref="Utils.PurchaseInvoiceSplit.Clamp"/>, over the
    /// projection instead of the entities.
    /// </remarks>
    private static void ClampPurchaseInvoiceLines(OutgoingShipmentDetailDto shipment)
    {
        if (shipment.PurchaseInvoices.Count == 0)
            return;

        var remaining = new Dictionary<Guid, int>();

        foreach (var product in shipment.Stops.SelectMany(s => s.Products))
        {
            var fromBrewery = product.Quantity - product.QuantityFromInventory;
            if (fromBrewery > 0)
                remaining[product.Id] = remaining.GetValueOrDefault(product.Id) + fromBrewery;
        }

        foreach (var purchase in shipment.StockPurchases)
            remaining[purchase.ProductId] = remaining.GetValueOrDefault(purchase.ProductId) + purchase.Quantity;

        foreach (var invoice in shipment.PurchaseInvoices.OrderBy(i => i.Sequence))
        {
            foreach (var line in invoice.Lines.ToList())
            {
                var left = remaining.GetValueOrDefault(line.ProductId);
                var allowed = Math.Min(line.Quantity, left);

                if (allowed <= 0)
                {
                    invoice.Lines.Remove(line);
                    continue;
                }

                line.Quantity = allowed;
                remaining[line.ProductId] = left - allowed;
            }
        }
    }
}