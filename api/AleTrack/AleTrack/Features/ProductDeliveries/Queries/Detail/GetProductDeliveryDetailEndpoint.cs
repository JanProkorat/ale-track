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
            .RequireRole(UserRoleType.User)
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
                    .Select(s => new ProductDeliveryStopDto
                    {
                        Id = s.PublicId,
                        Note = s.Note,
                        Brewery = new BreweryInfoDto(s.Brewery.PublicId, s.Brewery.Name),
                        Products = s.Items
                            .Select(i => new ProductDeliveryItemDto(i.Product.PublicId, i.Product.Name, i.Amount, i.Note))
                            .ToList()
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);
        
        if (delivery is null)
            ThrowHelper.PublicEntityNotFound(nameof(ProductDelivery), req.Id);

        await SendAsync(delivery!, cancellation: ct);
    }
}