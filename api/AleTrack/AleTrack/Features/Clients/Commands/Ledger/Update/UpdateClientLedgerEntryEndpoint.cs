using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Clients.Utils;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Commands.Ledger.Update;

/// <summary>
/// Patchable fields of a recorded deviation.
/// </summary>
/// <remarks>
/// What the entry is <em>about</em> — its target and its line — is not patchable: correcting that
/// is a different event, so the row is deleted and a new one recorded. Only the numbers, the money
/// and the words about it can be fixed here.
/// </remarks>
public sealed record UpdateClientLedgerEntryDto
{
    /// <summary>What the plan said.</summary>
    public int? PlannedQuantity { get; set; }

    /// <summary>What actually changed hands.</summary>
    public int? ActualQuantity { get; set; }

    /// <summary>Money owed, signed: positive means the client owes us.</summary>
    public decimal? Amount { get; set; }

    /// <summary>Name of the line, for the rows that have no row to point at.</summary>
    public string? LineName { get; set; }

    /// <summary>Why it happened.</summary>
    public string? Note { get; set; }
}

/// <summary>
/// Request to correct one recorded deviation.
/// </summary>
public sealed record UpdateClientLedgerEntryRequest
{
    /// <summary>Public ID of the entry.</summary>
    public Guid Id { get; set; }

    /// <summary>Body of the request.</summary>
    [FromBody]
    public UpdateClientLedgerEntryDto Data { get; set; } = null!;
}

/// <summary>
/// Corrects one recorded deviation.
/// </summary>
public sealed class UpdateClientLedgerEntryEndpoint(AleTrackDbContext dbContext)
    : Endpoint<UpdateClientLedgerEntryRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/ledger-entries/{Id:guid}");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateClientLedgerEntryEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Corrects a recorded deviation";
            s.Responses[StatusCodes.Status204NoContent] = "Entry updated";
            s.Responses[StatusCodes.Status404NotFound] = "Entry not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateClientLedgerEntryRequest req, CancellationToken ct)
    {
        var entry = await dbContext.ClientLedgerEntries.FirstOrDefaultAsync(e => e.PublicId == req.Id, ct);
        if (entry is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientLedgerEntry), req.Id);

        entry!.PlannedQuantity = req.Data.PlannedQuantity;
        entry.ActualQuantity = req.Data.ActualQuantity;
        entry.Amount = req.Data.Amount;
        entry.LineName = req.Data.LineName;
        entry.Note = req.Data.Note;

        // Recomputed, never posted: whether pieces are owed follows from the target and the
        // direction, and letting a caller assert it would let the two disagree.
        entry.RequiresFollowUp = ClientLedgerWriter.RequiresFollowUp(
            entry.Target, entry.PlannedQuantity, entry.ActualQuantity);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
