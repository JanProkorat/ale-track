using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Commands.Delete;

/// <summary>
/// Request to revert a client to the ceník price for one product.
/// </summary>
public sealed record DeleteClientProductPriceRequest
{
    /// <summary>Public ID of the client</summary>
    public Guid ClientId { get; set; }

    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }
}

/// <summary>
/// Endpoint removing a client's own price for one product.
/// </summary>
/// <remarks>
/// A hard delete, unlike most of this codebase's entities: <see cref="ClientProductPrice"/> is
/// deliberately not softly deletable, because the row carries no information once the client is
/// back on the ceník price, and it cannot rewrite history — every invoice line froze its own
/// charged price at billing time.
///
/// Same compound (client, product) route as <c>SaveClientProductPriceEndpoint</c>, for the same
/// deviation from how <c>ClientDeliveryPlaces</c> keys its writes off the row's own <c>PublicId</c>.
/// Unlike the upsert, the row already exists by the time a delete runs, so this endpoint could have
/// addressed it by <c>PublicId</c> instead — it uses the pair for symmetry with the endpoint it
/// undoes, not because addressing by row id was unavailable here.
/// </remarks>
internal sealed class DeleteClientProductPriceEndpoint(AleTrackDbContext dbContext)
    : Endpoint<DeleteClientProductPriceRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("clients/{clientId:guid}/product-prices/{productId:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .WithName(nameof(DeleteClientProductPriceEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Reverts a client to the ceník price for one product";
            s.Responses[StatusCodes.Status204NoContent] = "Price removed";
            s.Responses[StatusCodes.Status404NotFound] = "Price not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteClientProductPriceRequest req, CancellationToken ct)
    {
        var price = await dbContext.ClientProductPrices
            .FirstOrDefaultAsync(p => p.Client.PublicId == req.ClientId
                                   && p.Product.PublicId == req.ProductId, ct);

        if (price is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(ClientProductPrice), req.ProductId);
        }

        dbContext.ClientProductPrices.Remove(price!);
        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
