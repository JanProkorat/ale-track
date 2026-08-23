using AleTrack.Common.Utils;
using FastEndpoints;
using FluentValidation;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Which of a run's confirmed rows an export should carry.
/// </summary>
public sealed record ExportOutgoingShipmentDto
{
    /// <summary>
    /// Public IDs of the clients whose rows go into the file. The office chooses them in the export
    /// drawer; every one of them has to be a confirmed row on the run.
    /// </summary>
    public List<Guid> ClientIds { get; set; } = [];
}

/// <summary>
/// Request to export an outgoing shipment. Shared by the spreadsheet and document endpoints, which
/// differ only in what they write.
/// </summary>
public sealed record ExportOutgoingShipmentRequest
{
    /// <summary>
    /// Public ID of the outgoing shipment to export.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The rows to carry.
    /// </summary>
    [FromBody]
    public ExportOutgoingShipmentDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for <see cref="ExportOutgoingShipmentRequest"/>.
/// </summary>
public sealed class ExportOutgoingShipmentValidator : Validator<ExportOutgoingShipmentRequest>
{
    public ExportOutgoingShipmentValidator()
    {
        RuleFor(r => r.Id).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);
        RuleFor(r => r.Data).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new ExportOutgoingShipmentDtoValidator());
    }
}

/// <summary>
/// Validator for <see cref="ExportOutgoingShipmentDto"/>.
/// </summary>
public sealed class ExportOutgoingShipmentDtoValidator : AbstractValidator<ExportOutgoingShipmentDto>
{
    public ExportOutgoingShipmentDtoValidator()
    {
        RuleForEach(dto => dto.ClientIds).NotEmpty().WithErrorCode(ErrorCodes.ValidationNotEmptyError);

        RuleFor(dto => dto.ClientIds)
            .Must(ids => ids.Distinct().Count() == ids.Count)
            .WithErrorCode(ErrorCodes.ValidationError)
            .WithMessage("A client can be named only once.");
    }
}
