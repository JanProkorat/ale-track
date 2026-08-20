using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Notes.Queries.List;

/// <summary>
/// Request model for retrieving a supplier's notes.
/// </summary>
public record GetSupplierNotesRequest
{
    /// <summary>
    /// ID of the supplier.
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle requests for retrieving a supplier's notes.
/// </summary>
public sealed class GetSupplierNotesEndpoint(AleTrackDbContext dbContext)
    : Endpoint<GetSupplierNotesRequest, List<NoteDto>>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("suppliers/{id:guid}/notes");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.View)
            .WithName(nameof(GetSupplierNotesEndpoint)));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Gets supplier notes list";
            s.Responses[StatusCodes.Status200OK] = "List of notes for a supplier";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetSupplierNotesRequest req, CancellationToken ct)
    {
        var notes = await dbContext.SupplierNotes
            .Where(n => n.Supplier.PublicId == req.Id)
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
