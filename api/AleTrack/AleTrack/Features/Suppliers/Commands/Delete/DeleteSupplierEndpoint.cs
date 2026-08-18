using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Suppliers.Commands.Delete;

/// <summary>
/// Request to delete <see cref="Supplier"/>
/// </summary>
public sealed record DeleteSupplierRequest
{
    /// <summary>
    /// Public ID of the supplier
    /// </summary>
    public Guid Id { get; set; }
}

/// <summary>
/// Endpoint to handle the deletion of a <see cref="Supplier"/>.
/// </summary>
/// <remarks>
/// A soft delete — <c>SaveChanges</c> turns the Remove into a flag update because
/// <see cref="Supplier"/> is <c>ISoftlyDeletable</c>. The query filters on the supplier and
/// on each of its children then take the whole record out of every read at once.
/// </remarks>
public sealed class DeleteSupplierEndpoint(AleTrackDbContext dbContext) : Endpoint<DeleteSupplierRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("suppliers/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(DeleteSupplierEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Deletes supplier";
                s.Responses[StatusCodes.Status204NoContent] = "Supplier deleted";
                s.SetNotFoundResponse("Supplier");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteSupplierRequest req, CancellationToken ct)
    {
        var supplier = await dbContext.Suppliers.FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);
        if (supplier == null)
            ThrowHelper.PublicEntityNotFound(nameof(Supplier), req.Id);

        dbContext.Suppliers.Remove(supplier!);

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
