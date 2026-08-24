using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Commands.Update;

/// <summary>
/// Request to update <see cref="Client"/>
/// </summary>
public sealed record UpdateClientRequest
{
    /// <summary>
    /// Public ID of the client
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateClientDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to handle the update operation for a <see cref="Client"/> entity.
/// </summary>
public sealed class UpdateClientEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateClientRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .WithName(nameof(UpdateClientEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates client";
                s.Responses[StatusCodes.Status204NoContent] = "Client Updated";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientRequest req, CancellationToken ct)
    {
        var client = await dbContext.Clients
            .Include(c => c.Contacts)
            .FirstOrDefaultAsync(c => c.PublicId == req.Id, ct);
        if (client == null)
            ThrowHelper.PublicEntityNotFound(nameof(Client), req.Id);

        // Mirrors InvoicingClientResolver's rule 5 (a payer must have an official address) on
        // the other side: a client cannot clear the address it is being invoiced against while
        // it still invoices for other clients — that would leave the arrangement invalid without
        // ever going through the resolver.
        if (req.Data.OfficialAddress is null
            && await dbContext.Clients.AnyAsync(c => c.InvoicingClientId == client!.Id, ct))
            ThrowHelper.BadRequest(
                $"Client {req.Id} invoices for other clients and cannot have its official address cleared.");

        client!.Name = req.Data.Name;
        client.BusinessName = req.Data.BusinessName;
        client.Region = req.Data.Region;
        // Assigned unconditionally: both addresses are now optional, so an absent one in the
        // request means "clear it", not "leave it".
        client.OfficialAddress = req.Data.OfficialAddress?.ToDbEntity();
        client.ContactAddress = req.Data.ContactAddress?.ToDbEntity();
        client.InvoicingClientId = await InvoicingClientResolver.ResolveAsync(
            dbContext, req.Id, req.Data.InvoicingClientId, ct);

        client.Contacts = req.Data.Contacts
            .Select(c => new ClientContact
            {
                Description = c.Description,
                Type = c.Type,
                Value = c.Value
            })
            .ToList();
        
        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}