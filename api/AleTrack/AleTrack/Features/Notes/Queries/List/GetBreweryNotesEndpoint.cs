using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Queries.List;

/// <summary>
/// Request model for retrieving a brewery's notes.
/// </summary>
public record GetBreweryNotesRequest
{
    /// <summary>
    /// ID of the brewery.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle requests for retrieving a brewery's notes.
/// </summary>
public sealed class GetBreweryNotesEndpoint(AleTrackDbContext dbContext) : Endpoint<GetBreweryNotesRequest, List<NoteDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("breweries/{id:guid}/notes");
        Description(b => b
            .RequirePermission(ModuleType.Breweries, PermissionLevel.View)
            .WithName(nameof(GetBreweryNotesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets brewery notes list";
            s.Responses[StatusCodes.Status200OK] = "List of notes for a brewery";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetBreweryNotesRequest req, CancellationToken ct)
    {
        var notes = await dbContext.BreweryNotes
            .Where(n => n.Brewery.PublicId == req.Id)
            .OrderBy(n => n.DateCreated)
            .Select(n => new NoteDto
            {
                Id = n.PublicId,
                Text = n.Text
            })
            .ToListAsync(ct);

        await Send.OkAsync(notes, cancellation: ct);
    }
}
