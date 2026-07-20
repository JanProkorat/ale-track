using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Commands.Delete.Brewery;

/// <summary>
/// Request to delete a brewery note
/// </summary>
public record DeleteBreweryNoteRequest
{
    /// <summary>
    /// ID of the note to delete
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to delete a brewery note
/// </summary>
public sealed class DeleteBreweryNoteEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteBreweryNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("breweries/notes/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Breweries, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status202Accepted)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteBreweryNoteEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes a brewery note";
                s.Responses[StatusCodes.Status202Accepted] = "Note deleted";
                s.Responses[StatusCodes.Status404NotFound] = "Note not found";
            }
        );
    }

    public override async Task HandleAsync(DeleteBreweryNoteRequest req, CancellationToken ct)
    {
        var existingNote = await dbContext.BreweryNotes.FirstOrDefaultAsync(n => n.PublicId == req.Id, ct);

        if (existingNote is null)
            ThrowHelper.PublicEntityNotFound(nameof(BreweryNote), req.Id);

        dbContext.BreweryNotes.Remove(existingNote!);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(null, statusCode: StatusCodes.Status202Accepted, cancellation: ct);
    }
}
