using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Suppliers.Queries.Detail;

/// <summary>
/// Request to get detail of the supplier
/// </summary>
public sealed record GetSupplierDetailRequest
{
    /// <summary>
    /// ID of the supplier
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle requests for retrieving supplier details based on a unique identifier.
/// </summary>
public sealed class GetSupplierDetailEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetSupplierDetailRequest, SupplierDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("suppliers/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.View)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(GetSupplierDetailEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets supplier detail";
            s.Responses[StatusCodes.Status200OK] = "Detail of supplier";
            s.SetNotFoundResponse("Supplier");
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetSupplierDetailRequest req, CancellationToken ct)
    {
        var supplier = await dbContext.Suppliers
            .Where(s => s.PublicId == req.Id)
            .AsNoTracking()
            .Select(s => new SupplierDto
            {
                Id = s.PublicId,
                Name = s.Name,
                BusinessName = s.BusinessName,
                Note = s.Note,
                OfficialAddress = s.OfficialAddress.ToDto(),
                ContactAddress = s.ContactAddress != null
                    ? s.ContactAddress.ToDto()
                    : null,
                Contacts = s.Contacts
                    .Select(c => new SupplierContactDto
                    {
                        Type = c.Type,
                        Description = c.Description,
                        Value = c.Value
                    })
                    .ToList(),
                OpeningHours = s.OpeningHours
                    .OrderBy(h => h.DayOfWeek)
                    .ThenBy(h => h.From)
                    .Select(h => new SupplierOpeningHoursDto
                    {
                        DayOfWeek = h.DayOfWeek,
                        From = h.From,
                        To = h.To
                    })
                    .ToList(),
                // Ordered here rather than in the client so every consumer of the detail —
                // the ceník table, a future purchase screen — reads the same sequence.
                Goods = s.Goods
                    .OrderBy(g => g.Name)
                    .ThenBy(g => g.Size)
                    .Select(g => new SupplierGoodDto
                    {
                        Id = g.PublicId,
                        Name = g.Name,
                        Size = g.Size,
                        Description = g.Description,
                        PickupSource = g.PickupSource,
                        Prices = g.Prices
                            .OrderBy(p => p.Kind)
                            .Select(p => new SupplierGoodPriceDto
                            {
                                Kind = p.Kind,
                                PriceWithVat = p.PriceWithVat,
                                PriceWithoutVat = p.PriceWithoutVat,
                                Note = p.Note
                            })
                            .ToList()
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (supplier == null)
            ThrowHelper.PublicEntityNotFound(nameof(Supplier), req.Id);

        await Send.OkAsync(supplier!, ct);
    }
}
