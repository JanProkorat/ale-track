using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Commands.Create.Supplier;

/// <summary>
/// Request to create a new supplier note
/// </summary>
public record CreateSupplierNoteRequest
{
    /// <summary>
    /// ID of the supplier to create a note for
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateNoteDto Data { get; set; } = null!;
}

/// <summary>
/// Validator for the <see cref="CreateSupplierNoteRequest"/> class.
/// </summary>
public sealed class CreateSupplierNoteValidator : Validator<CreateSupplierNoteRequest>
{
    public CreateSupplierNoteValidator()
    {
        RuleFor(r => r.Id).NotNull().WithErrorCode(ErrorCodes.ValidationNotNullError);
        RuleFor(r => r.Data).SetValidator(new CreateNoteDtoValidator());
    }
}

/// <summary>
/// Endpoint to create a new supplier note
/// </summary>
public sealed class CreateSupplierNoteEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateSupplierNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("suppliers/{id}/notes");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(CreateSupplierNoteEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates a supplier note";
                s.Responses[StatusCodes.Status201Created] = "Note created";
                s.Responses[StatusCodes.Status404NotFound] = "Supplier not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateSupplierNoteRequest req, CancellationToken ct)
    {
        var supplier = await dbContext.Suppliers
            .Include(s => s.Notes)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (supplier is null)
            ThrowHelper.PublicEntityNotFound(nameof(Entities.Supplier), req.Id);

        var note = new SupplierNote
        {
            Supplier = supplier!,
            Text = req.Data.Text,
            DateCreated = DateTime.UtcNow,
        };

        supplier!.Notes.Add(note);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(note.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}
