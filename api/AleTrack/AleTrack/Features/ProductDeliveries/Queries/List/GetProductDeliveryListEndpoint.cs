using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Queries.List;

/// <summary>
/// Endpoint for retrieving a filtered list of product deliveries.
/// </summary>
/// <remarks>
/// This endpoint allows users with the required role to retrieve a filtered and sorted
/// list of product delivery entries from the database. The filtering and sorting
/// capabilities are applied based on the query parameters provided in the request.
/// </remarks>
/// <example>
/// Route: GET product/deliveries
/// </example>
/// <param name="dbContext">The database context used to access product delivery information.</param>
/// <response code="200">Returns a list of product deliveries.</response>
public sealed class GetProductDeliveryListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<ProductDeliveryListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("product/deliveries");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetProductDeliveryListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered product deliveries list";
            s.Responses[StatusCodes.Status200OK] = "List of product deliveries";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.ProductDeliveries
            .Select(d => new ProductDeliveryListItemDto
            {
                Id = d.PublicId,
                DeliveryDate = d.Date,
                State = d.State,
                NumOfAssignedDrivers = d.Drivers.Count,
                Vehicle = d.Vehicle != null ? new ProductDeliveryListItemDto.VehicleInfoDto(d.Vehicle.PublicId, d.Vehicle.Name) : null,
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);
        
        await SendOkAsync(data, cancellation: ct);
    }
}