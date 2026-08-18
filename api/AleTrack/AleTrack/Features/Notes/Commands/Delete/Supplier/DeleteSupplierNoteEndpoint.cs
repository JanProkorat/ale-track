using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Commands.Delete.Supplier;

/// <summary>
/// Request to delete a supplier note
/// </summary>
public record DeleteSupplierNoteRequest
{
    /// <summary>
    /// ID of the note to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to delete a supplier note
/// </summary>
public sealed class DeleteSupplierNoteEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteSupplierNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("suppliers/notes/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteSupplierNoteEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes a supplier note";
                s.Responses[StatusCodes.Status202Accepted] = "Note deleted";
                s.Responses[StatusCodes.Status404NotFound] = "Note not found";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteSupplierNoteRequest req, CancellationToken ct)
    {
        var existingNote = await dbContext.SupplierNotes.FirstOrDefaultAsync(n => n.PublicId == req.Id, ct);

        if (existingNote is null)
            ThrowHelper.PublicEntityNotFound(nameof(SupplierNote), req.Id);

        dbContext.SupplierNotes.Remove(existingNote!);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted, cancellation: ct);
    }
}
