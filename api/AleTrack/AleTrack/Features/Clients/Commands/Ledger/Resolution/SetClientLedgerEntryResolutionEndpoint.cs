using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Commands.Ledger.Resolution;

/// <summary>
/// The one transition: settled, or open again.
/// </summary>
public sealed record SetClientLedgerEntryResolutionDto
{
    /// <summary>True to settle the entry, false to reopen it.</summary>
    public bool Resolved { get; set; }

    /// <summary>How it was settled.</summary>
    public string? Note { get; set; }
}

/// <summary>
/// Request to settle or reopen one recorded deviation.
/// </summary>
public sealed record SetClientLedgerEntryResolutionRequest
{
    /// <summary>Public ID of the entry.</summary>
    public Guid Id { get; set; }

    /// <summary>Body of the request.</summary>
    [FromBody]
    public SetClientLedgerEntryResolutionDto Data { get; set; } = null!;
}

/// <summary>
/// Settles a recorded deviation, or reopens one settled by mistake.
/// </summary>
/// <remarks>
/// Its own endpoint for the reason <c>SetShipmentStateEndpoint</c> spells out in its own remarks:
/// this is one transition, not a re-post of the whole object. It reopens as well as settles,
/// because settling is a judgement and judgements are mistakeable.
/// </remarks>
public sealed class SetClientLedgerEntryResolutionEndpoint(AleTrackDbContext dbContext, IAppContext appContext)
    : Endpoint<SetClientLedgerEntryResolutionRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("clients/ledger-entries/{Id:guid}/resolution");
        Description(b => b
            .RequirePermission(ModuleType.Clients, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(SetClientLedgerEntryResolutionEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
        {
            s.Summary = "Settles or reopens a recorded deviation";
            s.Responses[StatusCodes.Status204NoContent] = "Resolution set";
            s.Responses[StatusCodes.Status404NotFound] = "Entry not found";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SetClientLedgerEntryResolutionRequest req, CancellationToken ct)
    {
        var entry = await dbContext.ClientLedgerEntries.FirstOrDefaultAsync(e => e.PublicId == req.Id, ct);
        if (entry is null)
            ThrowHelper.PublicEntityNotFound(nameof(ClientLedgerEntry), req.Id);

        if (req.Data.Resolved)
        {
            entry!.ResolvedAt = DateTime.UtcNow;
            entry.ResolvedByUserId = await ResolveCurrentUserIdAsync(ct);
            entry.ResolutionNote = req.Data.Note;
        }
        else
        {
            entry!.ResolvedAt = null;
            entry.ResolvedByUserId = null;
            entry.ResolutionNote = req.Data.Note;

            // The link to the settling order goes too. Reopening says that order did not settle
            // this after all; leaving the link would show the entry as carried by an order that
            // is already delivered, so it would offer no manual close and never close itself.
            entry.ResolvedByOrderId = null;
        }

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }

    private async Task<long?> ResolveCurrentUserIdAsync(CancellationToken ct)
    {
        if (appContext.UserId is null)
            return null;

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.PublicId == appContext.UserId, ct);

        return user?.Id;
    }
}
