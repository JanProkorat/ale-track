using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Breweries.Utils;
using AleTrack.Features.Products.Import;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Breweries.Commands.ApplyPriceList;

/// <summary>
/// Request to apply a previewed price list to a brewery's products.
/// </summary>
public sealed record ApplyPriceListRequest
{
    /// <summary>
    /// Public ID of the brewery.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The same price list the preview was run against.
    /// </summary>
    public IFormFile File { get; set; } = null!;

    /// <summary>
    /// Date the list takes effect.
    /// </summary>
    public DateOnly EffectiveFrom { get; set; }

    /// <summary>
    /// The hash the preview handed out. The request is refused if the uploaded file no longer
    /// hashes to it, so a different file cannot be applied than the one that was reviewed.
    /// </summary>
    public string SourceHash { get; set; } = null!;
}

/// <summary>
/// Endpoint applying a price list to a brewery's products.
/// </summary>
/// <remarks>
/// Stateless: no server-side pending import exists between preview and apply. The file is uploaded
/// again, re-parsed and re-diffed here, and the caller's <c>sourceHash</c> is what ties this call to
/// what the user actually saw.
///
/// The whole import is one <c>SaveChangesAsync</c>, so it commits or rolls back as a unit without an
/// explicit transaction. Removals go through <c>Products.Remove</c>, which the DbContext turns into
/// a soft delete — a removal is recoverable, and order-item restrictions still hold.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="appContext"></param>
/// <param name="timeProvider"></param>
public sealed class ApplyPriceListEndpoint(
    AleTrackDbContext dbContext, IAppContext appContext, TimeProvider timeProvider)
    : Endpoint<ApplyPriceListRequest, PriceListApplyResultDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("breweries/{Id:guid}/price-list/apply");
        AllowFileUploads();
        Description(b => b
            .RequirePermission(ModuleType.Breweries, PermissionLevel.Edit)
            .Produces<PriceListApplyResultDto>(StatusCodes.Status200OK)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .Produces<FailureResponse>(StatusCodes.Status409Conflict)
            .WithName(nameof(ApplyPriceListEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Applies a previewed price list to a brewery's products";
                s.Responses[StatusCodes.Status200OK] = "Import applied";
                s.Responses[StatusCodes.Status400BadRequest] = "Price list could not be read";
                s.Responses[StatusCodes.Status404NotFound] = "Brewery not found";
                s.Responses[StatusCodes.Status409Conflict] = "Uploaded file is not the previewed one";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ApplyPriceListRequest req, CancellationToken ct)
    {
        var brewery = await PriceListImportGraph.LoadBreweryAsync(dbContext, req.Id, ct);
        if (brewery is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(Brewery), req.Id);
            return;
        }

        var upload = await PriceListUpload.ReadAsync(req.File, ct);
        if (!string.Equals(upload.SourceHash, req.SourceHash, StringComparison.OrdinalIgnoreCase))
        {
            ThrowHelper.PriceListSourceChanged(req.SourceHash, upload.SourceHash);
            return;
        }

        var existing = await PriceListImportGraph.LoadProductStatesAsync(dbContext, brewery, ct);
        var entries = PriceListDiff.Compute(upload.Catalog.Rows, existing);

        var outcome = PriceListApplier.Apply(
            brewery,
            entries,
            req.EffectiveFrom,
            timeProvider.GetUtcNow(),
            upload.SourceHash,
            upload.Catalog.Source,
            await ImportingUserIdAsync(ct));

        dbContext.Products.RemoveRange(outcome.Removed);
        dbContext.PriceListImports.Add(outcome.Import);

        await dbContext.SaveChangesAsync(ct);

        await Send.OkAsync(new PriceListApplyResultDto
        {
            ImportId = outcome.Import.PublicId,
            Added = outcome.Import.AddedCount,
            Updated = outcome.Import.UpdatedCount,
            Removed = outcome.Import.RemovedCount,
            Blocked = entries.Count(e => e.Kind == PriceListChangeKind.Blocked)
        }, ct);
    }

    /// <summary>
    /// Internal ID of the caller, when the token names a user this database knows. Provenance is
    /// worth recording without one, so an unresolved user leaves the column null rather than
    /// failing the import.
    /// </summary>
    private async Task<long?> ImportingUserIdAsync(CancellationToken ct)
    {
        if (appContext.UserId is not { } userId)
        {
            return null;
        }

        return await dbContext.Users
            .AsNoTracking()
            .Where(u => u.PublicId == userId)
            .Select(u => (long?)u.Id)
            .FirstOrDefaultAsync(ct);
    }
}
