using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Options;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.OutgoingShipments.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.Extensions.Options;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Endpoint returning an outgoing shipment as an .xlsx workbook — an overview of the run, then one
/// sheet per client listing what that client ordered.
/// </summary>
/// <remarks>
/// Gated on View rather than Edit: the office needs the file for runs it may no longer change. It
/// does write, though — the rows it carries are stamped as exported, which is a fact about the file
/// rather than about who asked for it, so it is recorded whoever exports. The invoice split it reads
/// is still reconciled without being saved (see <see cref="ShipmentExportQuery"/>).
///
/// Carries no prices. What it does carry is chosen: the request names the confirmed rows to include,
/// so a run confirmed over a morning can send only what has not gone out yet.
///
/// The .docx sibling is <see cref="ExportOutgoingShipmentWordEndpoint"/>; both read the same
/// <see cref="ShipmentExportQuery"/> and differ only in the writer they hand the model to.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="companyOptions"></param>
/// <param name="driverScope"></param>
/// <param name="timeProvider"></param>
[BinaryResponse(ExportOutgoingShipmentExcelEndpoint.WorkbookContentType)]
public sealed class ExportOutgoingShipmentExcelEndpoint(
    AleTrackDbContext dbContext,
    IOptions<CompanyOptions> companyOptions,
    IDriverScope driverScope,
    TimeProvider timeProvider)
    : Endpoint<ExportOutgoingShipmentRequest>
{
    /// <summary>
    /// MIME type of an Office Open XML workbook.
    /// </summary>
    internal const string WorkbookContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/export/excel");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .RequireCapability(Capability.Invoicing)
            // Registers the status code and its media type; the binary schema itself is applied by
            // BinaryResponseProcessor off this endpoint's [BinaryResponse] marker, because no
            // Produces overload yields one.
            .Produces(StatusCodes.Status200OK, contentType: WorkbookContentType)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(ExportOutgoingShipmentExcelEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Exports an outgoing shipment to an .xlsx workbook";
                s.Responses[StatusCodes.Status200OK] = "Workbook generated";
                s.Responses[StatusCodes.Status400BadRequest] =
                    "Nothing was chosen, or a chosen client has no confirmed row on the shipment";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ExportOutgoingShipmentRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var selection = await ShipmentExportSelector.LoadAsync(dbContext, req, companyOptions.Value, ct);

        // Built before the stamp, so a file that failed to generate leaves no row reading as sent.
        var bytes = ShipmentExportWorkbookBuilder.Build(selection.Model);

        await ShipmentExportSelector.StampAsync(dbContext, selection, timeProvider, ct);

        await Send.BytesAsync(
            bytes,
            ShipmentExportFileName.For(selection.Model, "xlsx", selection.Scope),
            WorkbookContentType,
            cancellation: ct);
    }
}
