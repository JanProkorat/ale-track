using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;

namespace AleTrack.Features.Products.Queries.TypeList;

/// <summary>
/// Endpoint responsible for fetching the list of product types.
/// </summary>
/// <remarks>
/// This endpoint retrieves all product types defined in the <see cref="ProductType"/> enum.
/// It ensures that only users with the appropriate role are authorized to access the endpoint.
/// </remarks>
public sealed class GetProductTypeListEndpoint : EndpointWithoutRequest<ProductType[]>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("products/types");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetProductTypeListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets product types list";
            s.Responses[StatusCodes.Status200OK] = "List of product types";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var productTypes = Enum.GetValues<ProductType>();
        
        await SendAsync(productTypes, cancellation: ct);
    }
}