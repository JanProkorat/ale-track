using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Queries.List;

/// <summary>
/// Request model for retrieving a filtered list of notes.
/// </summary>
public record GetClientNotesRequest
{
    /// <summary>
    /// ID of the client.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle requests for retrieving a filtered list of notes.
/// </summary>
public sealed class GetClientNotesEndpoint(AleTrackDbContext dbContext) : Endpoint<GetClientNotesRequest, List<NoteDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("clients/{id:guid}/notes");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .WithName(nameof(GetClientNotesEndpoint)));
        
        DontCatchExceptions();
        
        Summary(s =>
        {
            s.Summary = "Gets client notes list";
            s.Responses[StatusCodes.Status200OK] = "List of notes for a client";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetClientNotesRequest req, CancellationToken ct)
    {
        var notes = await dbContext.ClientNotes
            .Where(n => n.Client.PublicId == req.Id)
            .OrderBy(n => n.DateCreated)
            .Select(n => new NoteDto
            {
                Id = n.PublicId,
                Text = n.Text
            })
            .ToListAsync(ct);
        
        await Send.ResponseAsync(notes, cancellation: ct);
    }
}