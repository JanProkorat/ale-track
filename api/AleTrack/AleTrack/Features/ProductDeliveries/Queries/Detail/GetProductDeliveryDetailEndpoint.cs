using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Queries.Detail;

/// <summary>
/// Represents a request to retrieve the details of a product delivery.
/// </summary>
public sealed record GetProductDeliveryDetailRequest
{
    /// <summary>
    /// ID of related delivery
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint for retrieving detailed information about a specific product delivery.
/// </summary>
internal sealed class GetProductDeliveryDetailEndpoint(AleTrackDbContext dbContext) : Endpoint<GetProductDeliveryDetailRequest, ProductDeliveryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("products/deliveries/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Deliveries, PermissionLevel.View)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetProductDeliveryDetailEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets product delivery detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of a product delivery";
            s.SetNotFoundResponse("Delivery");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetProductDeliveryDetailRequest req, CancellationToken ct)
    {
        var delivery = await dbContext.ProductDeliveries
            .Where(d => d.PublicId == req.Id)
            .Select(d => new ProductDeliveryDto
            {
                Id = d.PublicId,
                DeliveryDate = d.Date,
                State = d.State,
                Note = d.Note,
                Vehicle = d.Vehicle != null ? new VehicleInfoDto(d.Vehicle.PublicId, d.Vehicle.Name) : null,
                Drivers = d.Drivers
                    .Select(dr => new DriverInfoDto(dr.PublicId, dr.FirstName, dr.LastName))
                    .ToList(),
                Stops = d.Stops
                    .OrderBy(s => s.Order)
                    .Select(s => new ProductDeliveryStopDto
                    {
                        Id = s.PublicId,
                        Order = s.Order,
                        Kind = s.Kind,
                        Note = s.Note,
                        Brewery = s.Brewery != null ? new BreweryInfoDto(s.Brewery.PublicId, s.Brewery.Name) : null,
                        // Both coordinates hang off the same predicate, so they always come from
                        // one address: the branch actually visited when it has been geocoded, the
                        // registered seat otherwise. Testing longitude separately would let a
                        // half-geocoded branch contribute one coordinate and the seat the other,
                        // putting the pin in a field somewhere between them.
                        Supplier = s.Supplier != null
                            ? new SupplierInfoDto(
                                s.Supplier.PublicId,
                                s.Supplier.Name,
                                s.Supplier.ContactAddress != null && s.Supplier.ContactAddress.Latitude != null
                                    ? s.Supplier.ContactAddress.Latitude
                                    : s.Supplier.OfficialAddress.Latitude,
                                s.Supplier.ContactAddress != null && s.Supplier.ContactAddress.Latitude != null
                                    ? s.Supplier.ContactAddress.Longitude
                                    : s.Supplier.OfficialAddress.Longitude)
                            : null,
                        Label = s.Label,
                        Latitude = s.Latitude,
                        Longitude = s.Longitude,
                        // Product order per ProductOrdering; goods by name then charge kind, as the
                        // ceník lists them. The two never interleave — a stop's lines are all
                        // products or all goods — so one chain covering both costs nothing. Every
                        // product term is guarded rather than null-forgiven: this same expression
                        // runs against LINQ-to-objects under the mocked DbContext in tests, where
                        // a null navigation throws instead of comparing as SQL NULL.
                        Products = s.Items
                            .OrderBy(i => i.Product != null
                                       && (i.Product.Type == ProductType.Lemonade
                                        || i.Product.Type == ProductType.Merchandise
                                        || i.Product.Type == ProductType.Other) ? 1 : 0)
                            .ThenBy(i => i.Product == null || i.Product.PlatoDegree == null)
                            .ThenBy(i => i.Product == null ? (float?)null : i.Product.PlatoDegree)
                            .ThenBy(i => i.Product == null ? (double?)null : i.Product.PackageSize)
                            .ThenBy(i => i.Product != null ? i.Product.Name : i.SupplierGood!.Name)
                            .ThenBy(i => i.ChargeKind)
                            .Select(i => new ProductDeliveryItemDto
                            {
                                ProductId = i.Product != null ? i.Product.PublicId : (Guid?)null,
                                SupplierGoodId = i.SupplierGood != null ? i.SupplierGood.PublicId : (Guid?)null,
                                ChargeKind = i.ChargeKind,
                                Name = i.Product != null ? i.Product.Name : i.SupplierGood!.Name,
                                Size = i.SupplierGood != null ? i.SupplierGood.Size : null,
                                Quantity = i.Quantity,
                                Note = i.Note
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);
        
        if (delivery is null)
            ThrowHelper.PublicEntityNotFound(nameof(ProductDelivery), req.Id);

        await Send.OkAsync(delivery!, cancellation: ct);
    }
}