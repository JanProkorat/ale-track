using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;

namespace AleTrack.Features.ProductDeliveries.Queries.ProductDeliveryStateList;

/// <summary>
/// Endpoint to retrieve a list of available product delivery states.
/// </summary>
public sealed class GetProductDeliveryStateListEndpoint : EndpointWithoutRequest<ProductDeliveryState[]>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("product/deliveries/states");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetProductDeliveryStateListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets list of product delivery states";
            s.Responses[StatusCodes.Status200OK] = "List of product delivery states";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var data = Enum.GetValues<ProductDeliveryState>();
        
        await SendAsync(data, cancellation: ct);
    }
}