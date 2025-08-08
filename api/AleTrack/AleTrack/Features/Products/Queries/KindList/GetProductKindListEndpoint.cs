using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using FastEndpoints;

namespace AleTrack.Features.Products.Queries.KindList;

internal sealed class GetProductKindListEndpoint : EndpointWithoutRequest<ProductKind[]>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("products/kinds");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetProductKindListEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets product kinds list";
            s.Responses[StatusCodes.Status200OK] = "List of product kinds";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var productKinds = Enum.GetValues<ProductKind>();
        
        await SendAsync(productKinds, cancellation: ct);
    }
}