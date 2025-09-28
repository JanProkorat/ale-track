using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Commands.Update.Client;

/// <summary>
/// Request to update a client note
/// </summary>
public record UpdateClientNoteRequest
{
    /// <summary>
    /// ID of the note to update
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody] 
    public UpdateNoteDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to update a client note
/// </summary>
public sealed class UpdateClientNoteEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateClientNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/notes/{Id:guid}");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateClientNoteEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates a client note";
                s.Responses[StatusCodes.Status204NoContent] = "Note updated";
                s.Responses[StatusCodes.Status404NotFound] = "Note not found";
            }
        );
    }

    public override async Task HandleAsync(UpdateClientNoteRequest req, CancellationToken ct)
    {
        var existingNote = await dbContext.ClientNotes.FirstOrDefaultAsync(n => n.PublicId == req.Id, ct);
        if (existingNote is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientNote), req.Id);

        existingNote!.Text = req.Data.Text;

        dbContext.ClientNotes.Update(existingNote);
        await dbContext.SaveChangesAsync(ct);

        await SendNoContentAsync(ct);
    }
}
