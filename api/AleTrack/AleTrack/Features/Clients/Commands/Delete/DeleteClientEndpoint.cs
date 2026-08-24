using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Commands.Delete;

/// <summary>
/// Request to delete <see cref="Client"/>
/// </summary>
public sealed record DeleteClientRequest
{
    /// <summary>
    /// Public ID of the client
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle the deletion of a <see cref="Client"/>.
/// </summary>
public sealed class DeleteClientEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteClientRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("clients/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status202Accepted)
            .WithName(nameof(DeleteClientEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes client";
                s.Responses[StatusCodes.Status204NoContent] = "Client deleted";
            }
        );
    }
    
    /// <inheritdoc />
    public override async Task HandleAsync(DeleteClientRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients.FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        if (client == null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        // Restrict on the FK is the backstop; this is the message. Soft delete would otherwise
        // leave sub-clients pointing at a row nobody can see.
        if (await dbContext.Clients.AnyAsync(c => c.InvoicingClientId == client!.Id, ct))
            ThrowHelper.BadRequest(
                $"Client {req.Id} invoices for other clients. Unlink them before deleting it.");

        dbContext.Clients.Remove(client!);
        
        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}