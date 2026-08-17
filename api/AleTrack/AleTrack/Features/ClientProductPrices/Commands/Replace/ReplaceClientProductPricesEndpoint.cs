using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Commands.Replace;

/// <summary>
/// One entry of a whole-list client price write.
/// </summary>
public sealed record ClientProductPriceEntryDto
{
    /// <summary>Public ID of the product</summary>
    public Guid ProductId { get; set; }

    /// <summary>The price this client pays, with VAT</summary>
    public decimal PriceWithVat { get; set; }
}

/// <summary>
/// Request replacing a client's entire price list.
/// </summary>
public sealed record ReplaceClientProductPricesRequest
{
    /// <summary>Public ID of the client</summary>
    public Guid ClientId { get; set; }

    /// <summary>The complete desired list of prices</summary>
    [FromBody]
    public List<ClientProductPriceEntryDto> Data { get; set; } = [];
}

/// <summary>
/// Endpoint replacing a client's whole price list in one call.
/// </summary>
/// <remarks>
/// Replace, not merge: entries in the body are upserted and any price the body omits is
/// deleted. That is what backs the bulk editor's rule that an empty input means the
/// client pays the ceník, and it keeps one screenful of edits as one call rather than a
/// few hundred requests that can half-fail and leave the client's list in a state nobody
/// chose.
///
/// Known, accepted race, inherited from <c>SaveClientProductPriceEndpoint</c>: the upsert
/// half of this endpoint is check-then-act — it loads <c>existing</c> rows, then adds new
/// ones for whatever the loop did not find. Two concurrent whole-list writes for the same
/// client racing on the same new product can both observe no existing row and both attempt
/// to insert; the loser's <c>SaveChangesAsync</c> surfaces the table's unique index on
/// (client_id, product_id) as an unhandled 500 rather than an idempotent 204. This is
/// accepted, not fixed, for the same reason as its sibling: the unique index is the
/// backstop, so data integrity is never at risk, and no transaction or retry wraps it.
/// </remarks>
internal sealed class ReplaceClientProductPricesEndpoint(
    AleTrackDbContext dbContext,
    TimeProvider timeProvider) : Endpoint<ReplaceClientProductPricesRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/{clientId:guid}/product-prices");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .WithName(nameof(ReplaceClientProductPricesEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status204NoContent));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Replaces a client's whole price list";
            s.Responses[StatusCodes.Status204NoContent] = "Price list saved";
            s.Responses[StatusCodes.Status404NotFound] = "Client or one of the products not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ReplaceClientProductPricesRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicId == req.ClientId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.ClientId);
        }

        var requestedProductIds = req.Data.Select(e => e.ProductId).Distinct().ToList();

        var productIdByPublicId = await dbContext.Products
            .AsNoTracking()
            .Where(p => requestedProductIds.Contains(p.PublicId) && !p.IsDeleted)
            .Select(p => new { p.Id, p.PublicId })
            .ToDictionaryAsync(p => p.PublicId, p => p.Id, ct);

        var missingProductIds = requestedProductIds.Where(id => !productIdByPublicId.ContainsKey(id)).ToList();
        if (missingProductIds.Count > 0)
        {
            ThrowHelper.PublicEntitiesNotFound(nameof(Product), missingProductIds);
        }

        var existingPrices = await dbContext.ClientProductPrices
            .Where(p => p.ClientId == client!.Id)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
        var desiredPriceByProductId = req.Data
            .ToDictionary(e => productIdByPublicId[e.ProductId], e => e.PriceWithVat);

        foreach (var existingPrice in existingPrices)
        {
            if (desiredPriceByProductId.TryGetValue(existingPrice.ProductId, out var desiredPrice))
            {
                // Only restamp rows whose number actually moved: SetOn answers "when was
                // this price decided", and a no-op save must not rewrite that answer.
                if (existingPrice.PriceWithVat != desiredPrice)
                {
                    existingPrice.PriceWithVat = desiredPrice;
                    existingPrice.SetOn = today;
                }

                desiredPriceByProductId.Remove(existingPrice.ProductId);
            }
            else
            {
                dbContext.ClientProductPrices.Remove(existingPrice);
            }
        }

        foreach (var (productId, priceWithVat) in desiredPriceByProductId)
        {
            dbContext.ClientProductPrices.Add(new ClientProductPrice
            {
                PublicId = Guid.NewGuid(),
                ClientId = client!.Id,
                ProductId = productId,
                PriceWithVat = priceWithVat,
                SetOn = today
            });
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
