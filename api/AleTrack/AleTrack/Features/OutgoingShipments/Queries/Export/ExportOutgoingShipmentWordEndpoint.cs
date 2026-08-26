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
/// Endpoint returning an outgoing shipment as a .docx document — an overview of the run, then one
/// page per client listing what that client ordered.
/// </summary>
/// <remarks>
/// The same content as <see cref="ExportOutgoingShipmentExcelEndpoint"/>, for the times the run is
/// printed and handed over rather than worked on in a spreadsheet. Both read the same
/// <see cref="ShipmentExportQuery"/>, carry the rows the request names, and stamp them the same way,
/// so the two files can never disagree about what was sent.
/// </remarks>
/// <param name="dbContext"></param>
/// <param name="companyOptions"></param>
/// <param name="driverScope"></param>
/// <param name="timeProvider"></param>
[BinaryResponse(ExportOutgoingShipmentWordEndpoint.DocumentContentType)]
public sealed class ExportOutgoingShipmentWordEndpoint(
    AleTrackDbContext dbContext,
    IOptions<CompanyOptions> companyOptions,
    IDriverScope driverScope,
    TimeProvider timeProvider)
    : Endpoint<ExportOutgoingShipmentRequest>
{
    /// <summary>
    /// MIME type of an Office Open XML document.
    /// </summary>
    internal const string DocumentContentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    /// <inheritdoc />
    public override void Configure()
    {
        Post("outgoing-shipments/{Id:guid}/export/word");
        Description(b => b
            .RequirePermission(ModuleType.Shipments, PermissionLevel.View)
            .RequireCapability(Capability.Invoicing)
            // Registers the status code and its media type; the binary schema itself is applied by
            // BinaryResponseProcessor off this endpoint's [BinaryResponse] marker, because no
            // Produces overload yields one.
            .Produces(StatusCodes.Status200OK, contentType: DocumentContentType)
            .Produces<FailureResponse>(StatusCodes.Status400BadRequest)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(ExportOutgoingShipmentWordEndpoint)));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Exports an outgoing shipment to a .docx document";
                s.Responses[StatusCodes.Status200OK] = "Document generated";
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
        var bytes = ShipmentExportDocumentBuilder.Build(selection.Model);

        await ShipmentExportSelector.StampAsync(dbContext, selection, timeProvider, ct);

        await Send.BytesAsync(
            bytes,
            ShipmentExportFileName.For(selection.Model, "docx", selection.Scope),
            DocumentContentType,
            cancellation: ct);
    }
}
