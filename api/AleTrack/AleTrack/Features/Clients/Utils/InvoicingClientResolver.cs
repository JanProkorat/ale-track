using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Clients.Utils;

/// <summary>
/// Resolves the client a saved client's invoices go to, applying the rules the schema cannot
/// express. Shared by the create and update endpoints so they cannot drift.
/// </summary>
/// <remarks>
/// The relation is deliberately one hop deep in both directions: a payer may not have a payer,
/// and a client that is already a payer may not be given one. That keeps "who pays" answerable
/// without walking a chain, which is what the reconciler relies on.
/// </remarks>
public static class InvoicingClientResolver
{
    /// <param name="clientPublicId">
    /// The client being saved, or null on create — there is nothing to point at itself yet.
    /// </param>
    public static async Task<long?> ResolveAsync(
        AleTrackDbContext dbContext,
        Guid? clientPublicId,
        Guid? invoicingClientPublicId,
        CancellationToken ct)
    {
        if (invoicingClientPublicId is null)
            return null;

        if (clientPublicId is not null && clientPublicId == invoicingClientPublicId)
            ThrowHelper.BadRequest("A client cannot be its own invoicing client.");

        var payer = await dbContext.Clients
            .Where(c => c.PublicId == invoicingClientPublicId.Value)
            .Select(c => new { c.Id, c.InvoicingClientId, HasOfficialAddress = c.OfficialAddress != null })
            .FirstOrDefaultAsync(ct);

        if (payer is null)
            ThrowHelper.PublicEntitiesNotFound(nameof(Client), [invoicingClientPublicId.Value]);

        if (payer!.InvoicingClientId is not null)
            ThrowHelper.BadRequest(
                $"Client {invoicingClientPublicId} is invoiced through another client and cannot be an invoicing client itself.");

        if (!payer.HasOfficialAddress)
            ThrowHelper.BadRequest(
                $"Client {invoicingClientPublicId} has no official address and cannot be invoiced to.");

        if (clientPublicId is not null)
        {
            // Compare internal ids rather than following the InvoicingClient navigation: the
            // mocked DbSet used in tests only has InvoicingClientId wired, not the object
            // reference, so a navigation-based predicate silently matches nothing.
            var clientId = await dbContext.Clients
                .Where(c => c.PublicId == clientPublicId.Value)
                .Select(c => (long?)c.Id)
                .FirstOrDefaultAsync(ct);

            if (clientId is not null
                && await dbContext.Clients.AnyAsync(c => c.InvoicingClientId == clientId, ct))
                ThrowHelper.BadRequest(
                    $"Client {clientPublicId} already invoices for other clients and cannot be invoiced through one.");
        }

        return payer.Id;
    }
}
