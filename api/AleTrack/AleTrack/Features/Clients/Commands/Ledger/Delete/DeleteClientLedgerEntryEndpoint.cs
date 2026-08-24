using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Commands.Ledger.Delete;

/// <summary>
/// Request to drop one recorded deviation.
/// </summary>
public sealed record DeleteClientLedgerEntryRequest
{
    /// <summary>Public ID of the entry.</summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Drops one recorded deviation — for an entry written by mistake.
/// </summary>
/// <remarks>
/// A hard delete, unlike most of this codebase. A deviation that never happened is not history
/// worth keeping, and a settled one is closed rather than deleted, so there is nothing a soft
/// delete would preserve.
/// </remarks>
public sealed class DeleteClientLedgerEntryEndpoint(AleTrackDbContext dbContext)
    : Endpoint<DeleteClientLedgerEntryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("clients/ledger-entries/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteClientLedgerEntryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Deletes a recorded deviation";
            s.Responses[StatusCodes.Status204NoContent] = "Entry deleted";
            s.Responses[StatusCodes.Status404NotFound] = "Entry not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteClientLedgerEntryRequest req, CancellationToken ct)
    {
        var entry = await dbContext.ClientLedgerEntries.FirstOrDefaultAsync(e => e.PublicId == req.Id, ct);
        if (entry is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientLedgerEntry), req.Id);

        dbContext.ClientLedgerEntries.Remove(entry!);
        await dbContext.SaveChangesAsync(ct);

        await Send.NoContentAsync(ct);
    }
}
