using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Suppliers.Commands.ReplaceOpeningHours;

/// <summary>
/// Request to replace a <see cref="Supplier"/>'s weekly opening hours
/// </summary>
public sealed record ReplaceSupplierOpeningHoursRequest
{
    /// <summary>
    /// Public ID of the supplier
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public ReplaceSupplierOpeningHoursDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint replacing the supplier's whole weekly schedule in one write.
/// </summary>
public sealed class ReplaceSupplierOpeningHoursEndpoint(AleTrackDbContext dbContext)
    : Endpoint<ReplaceSupplierOpeningHoursRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("suppliers/{id}/opening-hours");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(ReplaceSupplierOpeningHoursEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Replaces supplier opening hours";
                s.Responses[StatusCodes.Status204NoContent] = "Opening hours replaced";
                s.SetNotFoundResponse("Supplier");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ReplaceSupplierOpeningHoursRequest req, CancellationToken ct)
    {
        var supplier = await dbContext.Suppliers
            .Include(s => s.OpeningHours)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (supplier == null)
            ThrowHelper.PublicEntityNotFound(nameof(Supplier), req.Id);

        // Stored sorted so every read — and every test asserting on the collection — sees the
        // week in the order the grid renders it, without each consumer re-sorting.
        supplier!.OpeningHours = req.Data.OpeningHours
            .OrderBy(h => h.DayOfWeek)
            .ThenBy(h => h.From)
            .Select(h => new SupplierOpeningHours
            {
                DayOfWeek = h.DayOfWeek,
                From = h.From,
                To = h.To
            })
            .ToList();

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
