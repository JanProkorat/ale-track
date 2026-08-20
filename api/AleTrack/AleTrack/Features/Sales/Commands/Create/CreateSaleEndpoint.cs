using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Sales.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Commands.Create;

/// <summary>
/// Request model for recording a new garage sale.
/// </summary>
public sealed record CreateSaleRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateSaleDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint recording a new garage sale.
/// </summary>
/// <remarks>
/// The sale is always created as a draft: nothing is deducted from inventory until the complete
/// command runs, so a mis-keyed sale can be fixed rather than corrected.
/// </remarks>
internal sealed class CreateSaleEndpoint(AleTrackDbContext dbContext, IAppContext appContext)
    : Endpoint<CreateSaleRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("sales");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateSaleEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Records a new garage sale as a draft";
            s.Responses[StatusCodes.Status201Created] = "Sale created";
            s.Responses[StatusCodes.Status404NotFound] = "Client or inventory item not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateSaleRequest req, CancellationToken ct)
    {
        var sale = new Sale
        {
            SaleDate = req.Data.SaleDate,
            State = SaleState.Draft,
            BuyerKind = req.Data.BuyerKind,
            ClientId = await ResolveClientIdAsync(req.Data.ClientId, ct),
            BuyerName = req.Data.BuyerKind == SaleBuyerKind.Walkin ? req.Data.BuyerName : null,
            Payment = req.Data.Payment,
            Billing = SaleBillingWriter.From(req.Data.Payment, req.Data.Billing),
            Note = req.Data.Note,
            SoldByUserId = await ResolveCurrentUserIdAsync(ct),
            Items = await SaleLineWriter.BuildLinesAsync(dbContext, req.Data.Items, ct)
        };

        dbContext.Sales.Add(sale);
        await dbContext.SaveChangesAsync(ct);

        // 201, not Send.OkAsync's 200: Configure declares Produces<string>(Status201Created), and the
        // generated TS client parses the body only on the status it was told to expect. A 200 falls
        // through its branches to `null`, so the caller loses the new id and navigates to /sales/null.
        await Send.ResponseAsync(sale.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }

    private async Task<long?> ResolveClientIdAsync(Guid? clientPublicId, CancellationToken ct)
    {
        if (clientPublicId is null)
        {
            return null;
        }

        var client = await dbContext.Clients
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.PublicId == clientPublicId && !c.IsDeleted, ct);

        if (client is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Client), clientPublicId.Value);
        }

        return client!.Id;
    }

    /// <summary>
    /// Resolves the acting user's surrogate key. Null rather than an error when the claim cannot be
    /// resolved — who rang a sale up is accountability metadata, not a precondition for recording it.
    /// </summary>
    private async Task<long?> ResolveCurrentUserIdAsync(CancellationToken ct)
    {
        if (appContext.UserId is null)
        {
            return null;
        }

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PublicId == appContext.UserId, ct);

        return user?.Id;
    }
}
