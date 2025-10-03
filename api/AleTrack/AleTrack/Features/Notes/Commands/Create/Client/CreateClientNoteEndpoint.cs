using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Commands.Create.Client;

/// <summary>
/// Request to create a new client note
/// </summary>
public record CreateClientNoteRequest
{
    /// <summary>
    /// ID of the client to create a note for
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateNoteDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to create a new client note
/// </summary>
public sealed class CreateClientNoteEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateClientNoteRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("clients/{id}/notes");
        Description(b => b
            .RequireRole(UserRoleType.User)
            .Produces<string>(StatusCodes.Status201Created)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(CreateClientNoteEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates a client note";
                s.Responses[StatusCodes.Status201Created] = "Note created";
                s.Responses[StatusCodes.Status404NotFound] = "Client not found";
            }
        );
    }

    public override async Task HandleAsync(CreateClientNoteRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .Include(c => c.Notes)
            .FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        
        if (client is null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        var note = new ClientNote
        {
            Client = client!,
            Text = req.Data.Text,
            DateCreated = DateTime.UtcNow,
        };

        client!.Notes.Add(note);
        await dbContext.SaveChangesAsync(ct);
        
        await SendAsync(note.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}
