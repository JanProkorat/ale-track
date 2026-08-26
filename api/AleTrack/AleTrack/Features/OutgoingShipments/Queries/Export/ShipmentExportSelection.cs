using AleTrack.Common.Enums;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// What one export was asked to carry: the model to write, and the rows to stamp once it is written.
/// </summary>
internal sealed record ShipmentExportSelection
{
    public required ShipmentExportModel Model { get; init; }

    /// <summary>
    /// How much of the run the file carries — already applied to <see cref="Model"/>, and kept
    /// because the download name says which of the three files this is.
    /// </summary>
    public required ShipmentExportScope Scope { get; init; }

    /// <summary>
    /// The confirmations the file covers, tracked, so stamping them needs no second read.
    /// </summary>
    public required List<OutgoingShipmentInvoiceConfirmation> Rows { get; init; }
}

/// <summary>
/// Resolves an export request into the rows it may carry, and stamps them afterwards.
/// </summary>
/// <remarks>
/// Shared by the two export endpoints, which differ only in the writer they hand the model to — the
/// guards and the stamp must not drift between them.
///
/// Stamping is deliberately a separate call: an endpoint builds its bytes first and stamps only once
/// that succeeded, so a run whose file failed to generate never reads as exported.
/// </remarks>
internal static class ShipmentExportSelector
{
    /// <summary>
    /// Loads the model for the chosen rows. Throws 404 for an unknown shipment, and 400 when nothing
    /// was chosen or a chosen client has no confirmed row on the run.
    /// </summary>
    internal static async Task<ShipmentExportSelection> LoadAsync(
        AleTrackDbContext dbContext,
        ExportOutgoingShipmentRequest req,
        CompanyOptions company,
        CancellationToken ct)
    {
        var clientIds = req.Data.ClientIds;

        if (clientIds.Count == 0)
        {
            ThrowHelper.BadRequest("An export has to name at least one confirmed row to carry.");
            return null!;
        }

        // Tracked, unlike the read behind the model: these are the rows the stamp is written to.
        var shipment = await dbContext.OutgoingShipments
            .Include(s => s.InvoiceConfirmations).ThenInclude(c => c.Client)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (shipment is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return null!;
        }

        var rows = shipment.InvoiceConfirmations
            .Where(c => c.IsReady && clientIds.Contains(c.Client?.PublicId ?? Guid.Empty))
            .ToList();

        // Every named client must resolve. Dropping one silently would hand back a file missing a
        // section the caller asked for, which is the one failure the office cannot see in it.
        if (rows.Count != clientIds.Count)
        {
            ThrowHelper.BadRequest(
                "Every client named in an export has to have a confirmed row on the shipment.");
            return null!;
        }

        var model = await ShipmentExportQuery.LoadAsync(dbContext, req.Id, company, clientIds, ct);
        if (model is null)
        {
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);
            return null!;
        }

        // The query loads the plan and its deviations either way; the scope decides which of the two
        // the writer is shown. Applied here rather than in each endpoint, for the same reason the
        // guards are: the .xlsx and the .docx must not disagree about what a scope means.
        return new ShipmentExportSelection
        {
            Model = ShipmentExportScopeFilter.Apply(model, req.Data.Scope),
            Scope = req.Data.Scope,
            Rows = rows
        };
    }

    /// <summary>
    /// Records that these rows went out now, and saves.
    /// </summary>
    internal static Task StampAsync(
        AleTrackDbContext dbContext,
        ShipmentExportSelection selection,
        TimeProvider timeProvider,
        CancellationToken ct)
    {
        var now = timeProvider.GetUtcNow().UtcDateTime;

        foreach (var row in selection.Rows)
            row.LastExportedAt = now;

        return dbContext.SaveChangesAsync(ct);
    }
}
