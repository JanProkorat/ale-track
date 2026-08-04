using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AleTrack.Features.OutgoingShipments.Queries.StartPoints;

/// <summary>
/// Endpoint returning every place a run may start from: the company warehouse
/// first, then the breweries.
/// </summary>
/// <param name="dbContext"></param>
/// <param name="companyOptions"></param>
public sealed class GetShipmentStartPointsEndpoint(
    AleTrackDbContext dbContext,
    IOptions<CompanyOptions> companyOptions)
    : EndpointWithoutRequest<List<ShipmentStartPointDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("outgoing-shipments/start-points");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .Produces<List<ShipmentStartPointDto>>(StatusCodes.Status200OK)
            .WithName(nameof(GetShipmentStartPointsEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Retrieves the places an outgoing shipment may start from";
            s.Responses[StatusCodes.Status200OK] = "Start points retrieved";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var company = companyOptions.Value;

        // Ordered by the brewery's own display order — the same key the catalogue
        // and the loading list sort by, so the picker reads in a familiar order.
        var breweries = await dbContext.Breweries
            .AsNoTracking()
            .OrderBy(b => b.DisplayOrder)
            .ThenBy(b => b.Name)
            .Select(b => new ShipmentStartPointDto
            {
                Kind = ShipmentStartPointKind.Brewery,
                BreweryId = b.PublicId,
                Name = b.Name,
                Address = b.OfficialAddress.StreetName + " " + b.OfficialAddress.StreetNumber
                    + ", " + b.OfficialAddress.Zip + " " + b.OfficialAddress.City,
                Latitude = b.OfficialAddress.Latitude,
                Longitude = b.OfficialAddress.Longitude
            })
            .ToListAsync(ct);

        List<ShipmentStartPointDto> startPoints =
        [
            new()
            {
                Kind = ShipmentStartPointKind.Company,
                BreweryId = null,
                Name = company.Name,
                Address = company.FormatAddress(),
                Latitude = company.Latitude,
                Longitude = company.Longitude
            },
            .. breweries
        ];

        await Send.OkAsync(startPoints, ct);
    }
}
