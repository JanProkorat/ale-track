using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Suppliers.Commands.Goods;

/// <summary>
/// Request to remove goods from a <see cref="Supplier"/>'s price list
/// </summary>
public sealed record DeleteSupplierGoodRequest
{
    /// <summary>
    /// Public ID of the goods
    /// </summary>
    public Guid GoodId { get; set; }
}

/// <summary>
/// Endpoint removing one item from a supplier's price list.
/// </summary>
/// <remarks>
/// A hard delete, unlike the supplier itself: a price-list row is a current statement of what
/// something costs, not a record anything points back to. Its prices go with it through the
/// cascade.
/// </remarks>
public sealed class DeleteSupplierGoodEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteSupplierGoodRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("suppliers/goods/{goodId}");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteSupplierGoodEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Removes goods from a supplier price list";
                s.Responses[StatusCodes.Status204NoContent] = "Goods deleted";
                s.SetNotFoundResponse("SupplierGood");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteSupplierGoodRequest req, CancellationToken ct)
    {
        var good = await dbContext.SupplierGoods.FirstOrDefaultAsync(g => g.PublicId == req.GoodId, ct);

        if (good == null)
            ThrowHelper.PublicEntityNotFound(nameof(SupplierGood), req.GoodId);

        dbContext.SupplierGoods.Remove(good!);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
