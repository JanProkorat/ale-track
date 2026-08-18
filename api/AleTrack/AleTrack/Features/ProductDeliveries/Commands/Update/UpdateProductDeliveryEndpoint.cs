using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.ProductDeliveries.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Commands.Update;

public sealed record UpdateProductDeliveryRequest
{
    /// <summary>
    /// ID of related delivery
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateProductDeliveryDto Data { get; set; } = null!;
}

public sealed class UpdateProductDeliveryEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateProductDeliveryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("products/deliveries/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Deliveries, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateProductDeliveryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates delivery of brewery products";
                s.Responses[StatusCodes.Status204NoContent] = "Delivery updated";
                s.SetNotFoundResponse("Delivery", "Vehicle");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateProductDeliveryRequest req, CancellationToken ct)
    {
        var delivery = await dbContext.ProductDeliveries
            .Where(d => d.PublicId == req.Id)
            .Include(d => d.Drivers)
            .Include(d => d.Vehicle)
            .Include(d => d.Stops)
                .ThenInclude(d => d.Items)
                    .ThenInclude(d => d.Product)
            .FirstOrDefaultAsync(ct);
        
        if (delivery is null)
            ThrowHelper.PublicEntityNotFound(nameof(ProductDelivery), req.Id);

        if (req.Data.State is not ProductDeliveryState.InPlanning && req.Data.State is not ProductDeliveryState.Cancelled && delivery.Stops.Count is 0)
            ProductDeliveryThrowHelper.NoItemsToDeliver(req.Data.State);

        // Read before the state is overwritten below: stock is booked in on the way into Finished,
        // not on being Finished. Nothing stops a finished dovoz from being updated — correcting its
        // note is legitimate — and the old rule stocked the whole delivery again every time that
        // happened, quietly doubling the warehouse.
        var wasFinished = delivery.State is ProductDeliveryState.Finished;

        delivery.Date = req.Data.DeliveryDate;
        delivery.State = req.Data.State;
        delivery.Note = req.Data.Note;
        
        if (delivery.Vehicle?.PublicId != req.Data.VehicleId)
            delivery.Vehicle = await GetVehicleAsync(req.Data.VehicleId, ct);
        
        delivery.Drivers.Clear();
        delivery.Drivers = await GetDriversAsync(req.Data.DriverIds, ct);

        var requestStopIds = req.Data.Stops
            .Select(s => s.PublicId)
            .ToList();

        // Remove stops that are not in the request
        delivery.Stops.RemoveAll(s => !requestStopIds.Contains(s.PublicId));

        var sources = req.Data.Stops.Select(ToSource).ToList();
        var catalog = await DeliverySourceCatalog.LoadAsync(dbContext, sources, ct);

        // Reconcile in request order — the list position is the stop's Order.
        for (var index = 0; index < req.Data.Stops.Count; index++)
        {
            var request = req.Data.Stops[index];
            if (request.PublicId is null)
            {
                delivery.Stops.Add(BuildStop(request, sources[index], index, catalog));
            }
            else
            {
                var existing = delivery.Stops.First(s => s.PublicId == request.PublicId);
                ApplyStop(existing, request, sources[index], index, catalog);
            }
        }

        // When the delivery is finished, fill inventory with what it brought back
        if (req.Data.State is ProductDeliveryState.Finished && !wasFinished)
            await CreateInventoryItemsAsync(delivery.Stops, ct);
        
        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Books everything the delivery brought back into stock — a brewery product's line against its
    /// product's row, a supplier good's line against its good's row.
    /// </summary>
    /// <remarks>
    /// A stock row counts a full thing, which is why the charge kind does not appear here: Plnění
    /// brings back a bottle that is full where it was empty and Nákup brings back one that is new,
    /// and both are the same row. Záloha and Nájem lines increment it as well, so a supplier stop's
    /// every line reaches stock — a deliberate choice rather than an oversight, though a deposit is
    /// a charge against a vessel rather than a vessel arriving.
    ///
    /// Rows created in this pass are looked up alongside the ones already stored, because two lines
    /// can legitimately land on one row: the same bottle refilled and bought is two delivery lines
    /// at two prices but one thing on the shelf. Consulting only the database would have created a
    /// second row for the second line, and the warehouse would show the good twice.
    /// </remarks>
    private async Task CreateInventoryItemsAsync(ICollection<DeliveryStop> deliveryStops, CancellationToken cancellationToken)
    {
        var allDeliveryItems = deliveryStops.SelectMany(s => s.Items).ToList();

        var deliveryProductIds = allDeliveryItems
            .Where(i => i.ProductId is not null || i.Product is not null)
            .Select(i => i.Product?.Id ?? i.ProductId!.Value)
            .Distinct()
            .ToList();

        var deliveryGoodIds = allDeliveryItems
            .Where(i => i.SupplierGoodId is not null || i.SupplierGood is not null)
            .Select(i => i.SupplierGood?.Id ?? i.SupplierGoodId!.Value)
            .Distinct()
            .ToList();

        var existingInventoryItems = await dbContext.InventoryItems
            .Where(i => (i.Product != null && deliveryProductIds.Contains(i.Product.Id))
                     || (i.SupplierGood != null && deliveryGoodIds.Contains(i.SupplierGood.Id)))
            .Include(inventoryItem => inventoryItem.Product)
            .Include(inventoryItem => inventoryItem.SupplierGood)
            .ToListAsync(cancellationToken);

        var stockedInThisPass = new List<InventoryItem>();

        foreach (var item in allDeliveryItems)
        {
            var existing = item.Product is not null
                ? Find(i => i.Product?.Id == item.Product.Id)
                : Find(i => i.SupplierGood?.Id == item.SupplierGood!.Id);

            if (existing is not null)
            {
                existing.Quantity += item.Quantity;
                existing.Note = item.Note;
                continue;
            }

            stockedInThisPass.Add(new InventoryItem
            {
                Quantity = item.Quantity,
                Note = item.Note,
                Product = item.Product,
                SupplierGood = item.SupplierGood
            });
        }

        if (stockedInThisPass.Count > 0)
            dbContext.InventoryItems.AddRange(stockedInThisPass);

        return;

        InventoryItem? Find(Func<InventoryItem, bool> predicate)
            => existingInventoryItems.FirstOrDefault(predicate) ?? stockedInThisPass.FirstOrDefault(predicate);
    }
    
    private static DeliveryStop BuildStop(UpdateProductDeliveryStopDto request, DeliveryStopSource source, int order, DeliverySourceCatalog catalog)
    {
        var stop = new DeliveryStop();
        ApplyStop(stop, request, source, order, catalog);
        return stop;
    }

    /// <remarks>
    /// Every kind clears what the other kinds own — a stop edited from a brewery to a supplier has
    /// to lose its brewery, not merely gain a supplier, or the check the validator makes on the way
    /// in would be undone by what the row still holds.
    /// </remarks>
    private static void ApplyStop(DeliveryStop stop, UpdateProductDeliveryStopDto request, DeliveryStopSource source, int order, DeliverySourceCatalog catalog)
    {
        stop.Order = order;
        stop.Kind = request.Kind;
        stop.Note = request.Note;

        if (request.Kind == DeliveryStopKind.Custom)
        {
            stop.Brewery = null;
            stop.BreweryId = null;
            stop.Supplier = null;
            stop.SupplierId = null;
            stop.Label = request.Label;
            stop.Latitude = request.Latitude;
            stop.Longitude = request.Longitude;
            stop.Items.Clear();
            stop.Items = [];
            return;
        }

        if (request.Kind == DeliveryStopKind.Supplier)
        {
            stop.Brewery = null;
            stop.BreweryId = null;
            stop.Supplier = catalog.Supplier(source.SupplierId!.Value);
        }
        else
        {
            stop.Supplier = null;
            stop.SupplierId = null;
            stop.Brewery = catalog.Brewery(source.BreweryId!.Value);
        }

        stop.Label = null;
        stop.Latitude = null;
        stop.Longitude = null;
        stop.Items.Clear();
        stop.Items = source.Lines.Select(l => catalog.BuildItem(source, l)).ToList();
    }

    private static DeliveryStopSource ToSource(UpdateProductDeliveryStopDto stop) => new(
        stop.Kind,
        stop.BreweryId,
        stop.SupplierId,
        stop.Products
            .Select(p => new DeliveryLineSource(p.ProductId, p.SupplierGoodId, p.ChargeKind, p.Quantity, p.Note))
            .ToList());

    private async Task<Vehicle?> GetVehicleAsync(Guid? vehicleId, CancellationToken cancellationToken)
    {
        if (vehicleId is null)
            return null;
        
        var vehicle = await dbContext.Vehicles.FirstOrDefaultAsync(v => v.PublicId == vehicleId, cancellationToken);
        if (vehicle is null)
            ThrowHelper.PublicEntityNotFound(nameof(Vehicle), vehicleId.Value);
        
        return vehicle;
    }

    private async Task<List<Driver>> GetDriversAsync(List<Guid> driverIds, CancellationToken cancellationToken)
    {
        if (driverIds.Count == 0)
            return [];
        
        var drivers = await dbContext.Drivers
            .Where(d => driverIds.Contains(d.PublicId))
            .ToListAsync(cancellationToken);

        if (drivers.Count == driverIds.Count)
            return drivers;
        
        var foundDriverIds = drivers.Select(d => d.PublicId).ToList();
        var nonExistingDriverIds = driverIds.Except(foundDriverIds).ToList();
        
        ThrowHelper.PublicEntitiesNotFound(nameof(Driver), nonExistingDriverIds);

        return drivers;
    }
}