using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Utils;
using AleTrack.Features.Products.Import;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.Breweries.Commands.PreviewPriceList;

/// <summary>
/// Request to see what a price list would do to a brewery's products.
/// </summary>
public sealed record PreviewPriceListRequest
{
    /// <summary>
    /// Public ID of the brewery.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The price list, in the catalogue's CSV shape.
    /// </summary>
    public IFormFile File { get; set; } = null!;

    /// <summary>
    /// Date the list takes effect. Not read from the file: an uploaded list states it in a comment
    /// at best, and the user is the one who knows which date they are importing under.
    /// </summary>
    public DateOnly EffectiveFrom { get; set; }
}

/// <summary>
/// Endpoint reporting the diff between an uploaded price list and a brewery's stored products.
/// </summary>
/// <remarks>
/// Writes nothing. The response carries a <c>sourceHash</c> that the apply call must send back, so
/// the file that gets applied is provably the file that was reviewed.
/// </remarks>
/// <param name="dbContext"></param>
public sealed class PreviewPriceListEndpoint(AleTrackDbContext dbContext)
    : Endpoint<PreviewPriceListRequest, PriceListPreviewDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("breweries/{Id:guid}/price-list/preview");
        AllowFileUploads();
        Description(b => b
            .RequirePermission(ModuleType.Breweries, PermissionLevel.Edit)
            .Produces<PriceListPreviewDto>(StatusCodes.Status200OK)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(PreviewPriceListEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Previews what applying a price list would change";
                s.Responses[StatusCodes.Status200OK] = "Diff between the list and the catalogue";
                s.Responses[StatusCodes.Status400BadRequest] = "Price list could not be read";
                s.Responses[StatusCodes.Status404NotFound] = "Brewery not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PreviewPriceListRequest req, CancellationToken ct)
    {
        var brewery = await PriceListImportGraph.LoadBreweryAsync(dbContext, req.Id, ct);
        if (brewery is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Brewery), req.Id);
            return;
        }

        var upload = await PriceListUpload.ReadAsync(req.File, ct);
        var existing = await PriceListImportGraph.LoadProductStatesAsync(dbContext, brewery, ct);
        var entries = PriceListDiff.Compute(upload.Catalog.Rows, existing);

        await Send.OkAsync(ToDto(upload, brewery, req.EffectiveFrom, entries), ct);
    }

    private static PriceListPreviewDto ToDto(
        PriceListUpload upload, Brewery brewery, DateOnly effectiveFrom,
        List<PriceListDiffEntry> entries) => new()
    {
        SourceHash = upload.SourceHash,
        EffectiveFrom = effectiveFrom,
        SourceName = upload.Catalog.Source,
        BreweryName = brewery.Name,
        Summary = new PriceListPreviewSummaryDto(
            Count(entries, PriceListChangeKind.Added),
            Count(entries, PriceListChangeKind.Repriced),
            Count(entries, PriceListChangeKind.Changed),
            Count(entries, PriceListChangeKind.Unchanged),
            Count(entries, PriceListChangeKind.ToRemove),
            Count(entries, PriceListChangeKind.Blocked)),
        Items = [.. entries.Select(ToItem)]
    };

    private static int Count(List<PriceListDiffEntry> entries, PriceListChangeKind kind) =>
        entries.Count(e => e.Kind == kind);

    private static PriceListPreviewItemDto ToItem(PriceListDiffEntry entry) => new()
    {
        Kind = entry.Kind,
        Name = entry.Name,
        ProductId = entry.Existing?.PublicId,
        // Packaging comes from the list when the product is on it, and from the catalogue when the
        // entry exists only because the list dropped it.
        Container = entry.Row?.Container ?? entry.Existing!.Container,
        SaleUnit = entry.Row?.SaleUnit ?? entry.Existing!.SaleUnit,
        VolumeLiters = entry.Row?.VolumeLiters ?? entry.Existing?.VolumeLiters,
        UnitsPerPackage = entry.Row?.UnitsPerPackage ?? entry.Existing!.UnitsPerPackage,
        PriceWithVat = entry.Row?.PackPriceWithVat ?? entry.Existing?.PriceWithVat,
        Derived = entry.Row?.Derived ?? PriceDerivation.None,
        Changes = [.. entry.Changes]
    };
}
