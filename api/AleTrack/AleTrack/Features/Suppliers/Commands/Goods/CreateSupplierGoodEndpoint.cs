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
/// Request to add goods to a <see cref="Supplier"/>'s price list
/// </summary>
public sealed record CreateSupplierGoodRequest
{
    /// <summary>
    /// Public ID of the supplier
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public SupplierGoodUpsertDto Data { get; set; } = null!;
}

/// <summary>
/// Validation rules for <see cref="CreateSupplierGoodRequest"/>.
/// </summary>
public sealed class CreateSupplierGoodValidator : Validator<CreateSupplierGoodRequest>
{
    public CreateSupplierGoodValidator()
    {
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new SupplierGoodUpsertDtoValidator());
    }
}

/// <summary>
/// Endpoint adding one item, with its prices, to a supplier's price list.
/// </summary>
public sealed class CreateSupplierGoodEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateSupplierGoodRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("suppliers/{id}/goods");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(CreateSupplierGoodEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Adds goods to a supplier price list";
                s.Responses[StatusCodes.Status201Created] = "Goods created";
                s.SetNotFoundResponse("Supplier");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateSupplierGoodRequest req, CancellationToken ct)
    {
        var supplier = await dbContext.Suppliers
            .Include(s => s.Goods)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (supplier == null)
            ThrowHelper.PublicEntityNotFound(nameof(Supplier), req.Id);

        var good = new SupplierGood
        {
            Name = req.Data.Name,
            Size = req.Data.Size,
            Description = req.Data.Description,
            PickupSource = req.Data.PickupSource,
            Prices = req.Data.Prices
                .Select(p => new SupplierGoodPrice
                {
                    Kind = p.Kind,
                    PriceWithVat = p.PriceWithVat,
                    PriceWithoutVat = p.PriceWithoutVat,
                    Note = p.Note
                })
                .ToList()
        };

        supplier!.Goods.Add(good);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(good.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}
