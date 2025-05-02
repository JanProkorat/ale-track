using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistance;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Queries.ItemsList;

/// <summary>
/// Endpoint responsible for retrieving a filtered list of product delivery items.
/// </summary>
/// <remarks>
/// This endpoint handles GET requests to the specified route and returns a list of delivery items
/// based on the filtering and sorting parameters provided in the request. It leverages the
/// AleTrackDbContext for data access and applies filters using the specified parameters in the request.
/// </remarks>
/// <example>
/// This endpoint expects a request with query parameters for filtering and sorting, and it will return
/// a list of product delivery items with details such as product name, delivery ID, product ID, amount,
/// and additional notes.
/// </example>
public sealed class GetProductDeliveryItemsListEndpoint(AleTrackDbContext dbContext) : Endpoint<FilterableRequest, List<ProductDeliveryItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("product/deliveries/items");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetProductDeliveryItemsListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets filtered list of product delivery items";
            s.Responses[StatusCodes.Status200OK] = "List of product delivery items";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.DeliveryItems
            .Select(i => new ProductDeliveryItemDto
            {
                ProductName = i.Product.Name,
                ProductId = i.Product.PublicId,
                Amount = i.Amount,
                Note = i.Note,
                ProductDeliveryId = i.Delivery.PublicId
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await SendOkAsync(data, cancellation: ct);
    }
}