using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Sales.Queries.Detail;

/// <summary>
/// Request model for retrieving one garage sale.
/// </summary>
public sealed record GetSaleDetailRequest
{
    /// <summary>
    /// Public ID of the sale.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint retrieving the detail of one garage sale.
/// </summary>
internal sealed class GetSaleDetailEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetSaleDetailRequest, SaleDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("sales/{id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Sales, PermissionLevel.View)
            .WithName(nameof(GetSaleDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets garage sale detail";
            s.Responses[StatusCodes.Status200OK] = "Garage sale detail";
            s.Responses[StatusCodes.Status404NotFound] = "Sale not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetSaleDetailRequest req, CancellationToken ct)
    {
        var sale = await dbContext.Sales
            .AsNoTracking()
            .Where(s => s.PublicId == req.Id)
            .Select(s => new SaleDto
            {
                Id = s.PublicId,
                SaleDate = s.SaleDate,
                State = s.State,
                BuyerKind = s.BuyerKind,
                BuyerName = s.BuyerName,
                ClientId = s.Client != null ? s.Client.PublicId : null,
                ClientName = s.Client != null ? s.Client.Name : null,
                Payment = s.Payment,
                Note = s.Note,
                CompletedAt = s.CompletedAt,
                SoldByUserName = s.SoldByUser != null
                    ? s.SoldByUser.FirstName + " " + s.SoldByUser.LastName
                    : null,
                Billing = s.Billing == null
                    ? null
                    : new SaleBillingDetailDto
                    {
                        Name = s.Billing.Name,
                        CompanyId = s.Billing.CompanyId,
                        VatId = s.Billing.VatId,
                        StreetName = s.Billing.StreetName,
                        StreetNumber = s.Billing.StreetNumber,
                        City = s.Billing.City,
                        Zip = s.Billing.Zip,
                        DueDate = s.Billing.DueDate,
                        PaidDate = s.Billing.PaidDate
                    },
                Items = s.Items
                    .OrderBy(i => i.Id)
                    .Select(i => new SaleItemDetailDto
                    {
                        Id = i.PublicId,
                        InventoryItemId = i.InventoryItem != null ? i.InventoryItem.PublicId : null,
                        Name = i.Name,
                        Kind = i.Kind,
                        PackageSize = i.PackageSize,
                        Quantity = i.Quantity,
                        UnitPriceWithVat = i.UnitPriceWithVat,
                        ListPriceWithVat = i.ListPriceWithVat,
                        Note = i.Note
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (sale is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Sale), req.Id);
        }

        await Send.OkAsync(sale!, cancellation: ct);
    }
}
