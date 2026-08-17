using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ClientProductPrices.Queries.List;

/// <summary>
/// Request for a client's own product prices.
/// </summary>
public sealed record GetClientProductPricesRequest
{
    /// <summary>
    /// Public ID of the client.
    /// </summary>
    public Guid ClientId { get; set; }
}

/// <summary>
/// Endpoint returning the prices a client pays instead of the ceník ones.
/// </summary>
internal sealed class GetClientProductPricesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetClientProductPricesRequest, List<ClientProductPriceDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients/{clientId:guid}/product-prices");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.View)
            .WithName(nameof(GetClientProductPricesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets a client's own product prices";
            s.Responses[StatusCodes.Status200OK] = "The client's price list";
            s.Responses[StatusCodes.Status404NotFound] = "Client not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientProductPricesRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicId == req.ClientId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.ClientId);
        }

        var prices = await dbContext.ClientProductPrices
            .AsNoTracking()
            .Where(p => p.ClientId == client!.Id && !p.Product.IsDeleted)
            .OrderBy(p => p.Product.Brewery.Name)
            .ThenBy(p => p.Product.Name)
            .Select(p => new ClientProductPriceDto
            {
                ProductId = p.Product.PublicId,
                ProductName = p.Product.Name,
                Kind = p.Product.Kind,
                PackageSize = p.Product.PackageSize,
                BreweryId = p.Product.Brewery.PublicId,
                BreweryName = p.Product.Brewery.Name,
                PriceWithVat = p.PriceWithVat,
                ListPriceWithVat = p.Product.PriceWithVat,
                SetOn = p.SetOn
            })
            .ToListAsync(ct);

        await Send.OkAsync(prices, cancellation: ct);
    }
}
