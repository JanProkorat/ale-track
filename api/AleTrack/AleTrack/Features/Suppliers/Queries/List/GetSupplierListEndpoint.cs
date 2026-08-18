using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Suppliers.Queries.List;

/// <summary>
/// Endpoint responsible for handling requests to retrieve a filtered list of suppliers.
/// </summary>
public sealed class GetSupplierListEndpoint(AleTrackDbContext dbContext)
    : Endpoint<FilterableRequest, List<SupplierListItemDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("suppliers");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.View)
            .WithName(nameof(GetSupplierListEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets filtered supplier list";
            s.Responses[StatusCodes.Status200OK] = "List of suppliers";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FilterableRequest req, CancellationToken ct)
    {
        var data = await dbContext.Suppliers
            .AsNoTracking()
            .Select(s => new SupplierListItemDto
            {
                Id = s.PublicId,
                Name = s.Name,
                BusinessName = s.BusinessName,
                OfficialAddress = s.OfficialAddress.ToDto(),
                Contacts = s.Contacts
                    .Select(c => new SupplierContactDto
                    {
                        Type = c.Type,
                        Description = c.Description,
                        Value = c.Value
                    })
                    .ToList(),
                GoodsCount = s.Goods.Count,
                OpeningHours = s.OpeningHours
                    .OrderBy(h => h.DayOfWeek)
                    .ThenBy(h => h.From)
                    .Select(h => new SupplierOpeningHoursDto
                    {
                        DayOfWeek = h.DayOfWeek,
                        From = h.From,
                        To = h.To
                    })
                    .ToList()
            })
            .ApplyFilterAndSort(req.Parameters)
            .ToListAsync(ct);

        await Send.OkAsync(data, cancellation: ct);
    }
}
