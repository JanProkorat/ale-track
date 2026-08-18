using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Suppliers.Commands.Goods;

/// <summary>
/// Request to update goods on a <see cref="Supplier"/>'s price list
/// </summary>
public sealed record UpdateSupplierGoodRequest
{
    /// <summary>
    /// Public ID of the goods
    /// </summary>
    public Guid GoodId { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SupplierGoodUpsertDto Data { get; set; } = null!;
}

/// <summary>
/// Validation rules for <see cref="UpdateSupplierGoodRequest"/>.
/// </summary>
public sealed class UpdateSupplierGoodValidator : Validator<UpdateSupplierGoodRequest>
{
    public UpdateSupplierGoodValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new SupplierGoodUpsertDtoValidator());
    }
}

/// <summary>
/// Endpoint updating one price-list item and replacing its prices.
/// </summary>
/// <remarks>
/// The goods' own public id addresses it, so the route needs no supplier segment — the same
/// shape the note endpoints use for deletes. Prices are replaced rather than merged: the
/// editor sends the rows it holds, and a kind removed there has to disappear here.
/// </remarks>
public sealed class UpdateSupplierGoodEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateSupplierGoodRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("suppliers/goods/{goodId}");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateSupplierGoodEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates goods on a supplier price list";
                s.Responses[StatusCodes.Status204NoContent] = "Goods updated";
                s.SetNotFoundResponse("SupplierGood");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateSupplierGoodRequest req, CancellationToken ct)
    {
        var good = await dbContext.SupplierGoods
            .Include(g => g.Prices)
            .FirstOrDefaultAsync(g => g.PublicId == req.GoodId, ct);

        if (good == null)
            ThrowHelper.PublicEntityNotFound(nameof(SupplierGood), req.GoodId);

        good!.Name = req.Data.Name;
        good.Size = req.Data.Size;
        good.Description = req.Data.Description;
        good.Prices = req.Data.Prices
            .Select(p => new SupplierGoodPrice
            {
                Kind = p.Kind,
                PriceWithVat = p.PriceWithVat,
                PriceWithoutVat = p.PriceWithoutVat,
                Note = p.Note
            })
            .ToList();

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
