using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Commands.Create.Brewery;

/// <summary>
/// Request to create a new brewery note
/// </summary>
public record CreateBreweryNoteRequest
{
    /// <summary>
    /// ID of the brewery to create a note for
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateNoteDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to create a new brewery note
/// </summary>
public sealed class CreateBreweryNoteEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateBreweryNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("breweries/{id}/notes");
        Description(b => b
            .RequirePermission(ModuleType.Breweries, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(CreateBreweryNoteEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates a brewery note";
                s.Responses[StatusCodes.Status201Created] = "Note created";
                s.Responses[StatusCodes.Status404NotFound] = "Brewery not found";
            }
        );
    }

    public override async Task HandleAsync(CreateBreweryNoteRequest req, CancellationToken ct)
    {
        var brewery = await dbContext.Breweries
            .Include(b => b.Notes)
            .FirstOrDefaultAsync(b => b.PublicId == req.Id, ct);

        if (brewery is null)
            ThrowHelper.PublicEntityNotFound(nameof(AleTrack.Entities.Brewery), req.Id);

        var note = new BreweryNote
        {
            Brewery = brewery!,
            Text = req.Data.Text,
            DateCreated = DateTime.UtcNow,
        };

        brewery!.Notes.Add(note);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(note.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}
