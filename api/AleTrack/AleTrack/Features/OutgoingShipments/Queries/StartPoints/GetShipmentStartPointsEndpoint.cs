using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
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
        // Cross-cutting reference data, not shipment content: the company entry is
        // also the incoming-delivery screens' address source, so gating this on
        // Shipments/View would 403 a deliveries-only user and silently draw their
        // delivery route from the wrong origin. Same treatment as exchange rates
        // and the other master-data lookups.
        Description(b => b
            .RequireAuthenticated()
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
        // Projected as entities (no method calls, so this stays EF-translatable) —
        // the fan-out into one-or-two entries per brewery happens afterwards, in memory.
        var breweries = await dbContext.Breweries
            .AsNoTracking()
            .OrderBy(b => b.DisplayOrder)
            .ThenBy(b => b.Name)
            .ToListAsync(ct);

        List<ShipmentStartPointDto> startPoints =
        [
            new()
            {
                Kind = ShipmentStartPointKind.Company,
                BreweryId = null,
                AddressKind = null,
                Name = company.Name,
                Address = company.FormatAddress(),
                Latitude = company.Latitude,
                Longitude = company.Longitude
            },
            .. breweries.SelectMany(BuildBreweryStartPoints)
        ];

        await Send.OkAsync(startPoints, ct);
    }

    /// <summary>
    /// A brewery is not always loaded at its official address — it contributes one
    /// start point per address it actually has set: always the official one, plus the
    /// contact address when one is on file. Coordinates are passed through as-is,
    /// including when they are unset — an ungeocoded address is still a valid, pickable
    /// start point.
    /// </summary>
    private static IEnumerable<ShipmentStartPointDto> BuildBreweryStartPoints(Brewery brewery)
    {
        yield return new ShipmentStartPointDto
        {
            Kind = ShipmentStartPointKind.Brewery,
            BreweryId = brewery.PublicId,
            AddressKind = DeliveryAddressKind.Official,
            Name = brewery.Name,
            Address = FormatAddress(brewery.OfficialAddress),
            Latitude = brewery.OfficialAddress.Latitude,
            Longitude = brewery.OfficialAddress.Longitude
        };

        if (brewery.ContactAddress is not null)
        {
            yield return new ShipmentStartPointDto
            {
                Kind = ShipmentStartPointKind.Brewery,
                BreweryId = brewery.PublicId,
                AddressKind = DeliveryAddressKind.Contact,
                Name = brewery.Name,
                Address = FormatAddress(brewery.ContactAddress),
                Latitude = brewery.ContactAddress.Latitude,
                Longitude = brewery.ContactAddress.Longitude
            };
        }
    }

    private static string FormatAddress(Address address)
        => $"{address.StreetName} {address.StreetNumber}, {address.Zip} {address.City}";
}
