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
/// Read-only, and gated on View rather than Edit: exporting is reading, and the office needs the
/// file for runs it may no longer change.
///
/// Carries no prices, but every product row reports both what is delivered to the stop and what
/// lands on that client's invoices, so it does read the split behind the Fakturace section. It
/// reconciles that split without saving — see <see cref="ShipmentExportQuery"/>; a View-gated
/// download must not write one.
///
/// The .docx sibling is <see cref="ExportOutgoingShipmentWordEndpoint"/>; both read the same
/// <see cref="ShipmentExportQuery"/> and differ only in the writer they hand the model to.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="companyOptions"></param>
/// <param name="driverScope"></param>
[BinaryResponse(ExportOutgoingShipmentExcelEndpoint.WorkbookContentType)]
public sealed class ExportOutgoingShipmentExcelEndpoint(
    AleTrackDbContext dbContext,
    IOptions<CompanyOptions> companyOptions,
    IDriverScope driverScope)
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
        Get("outgoing-shipments/{Id:guid}/export/excel");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            // Registers the status code and its media type; the binary schema itself is applied by
            // BinaryResponseProcessor off this endpoint's [BinaryResponse] marker, because no
            // Produces overload yields one.
            .Produces(StatusCodes.Status200OK, contentType: WorkbookContentType)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(ExportOutgoingShipmentExcelEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Exports an outgoing shipment to an .xlsx workbook";
                s.Responses[StatusCodes.Status200OK] = "Workbook generated";
                s.Responses[StatusCodes.Status404NotFound] = "Outgoing shipment not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ExportOutgoingShipmentRequest req, CancellationToken ct)
    {
        await ShipmentDriverScopeGuard.EnsureAssignedAsync(driverScope, dbContext, req.Id, ct);

        var model = await ShipmentExportQuery.LoadAsync(dbContext, req.Id, companyOptions.Value, ct);
        if (model is null)
            ThrowHelper.PublicEntityNotFound(nameof(OutgoingShipment), req.Id);

        await Send.BytesAsync(
            ShipmentExportWorkbookBuilder.Build(model!),
            ShipmentExportFileName.For(model!, "xlsx"),
            WorkbookContentType,
            cancellation: ct);
    }
}
