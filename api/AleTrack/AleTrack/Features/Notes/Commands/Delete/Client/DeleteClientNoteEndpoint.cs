using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Commands.Delete.Client;

/// <summary>
/// Request to delete a client note
/// </summary>
public record DeleteClientNoteRequest
{
    /// <summary>
    /// ID of the note to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to delete a client note
/// </summary>
public sealed class DeleteClientNoteEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteClientNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("clients/notes/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteClientNoteEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes a client note";
                s.Responses[StatusCodes.Status202Accepted] = "Note deleted";
                s.Responses[StatusCodes.Status404NotFound] = "Note not found";
            }
        );
    }

    public override async Task HandleAsync(DeleteClientNoteRequest req, CancellationToken ct)
    {
        var existingNote = await dbContext.ClientNotes.FirstOrDefaultAsync(n => n.PublicId == req.Id, ct);
        
        if (existingNote is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientNote), req.Id);

        dbContext.ClientNotes.Remove(existingNote!);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted, cancellation: ct);
    }
}
