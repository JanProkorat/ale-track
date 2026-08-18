using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.Suppliers.Commands.Update;

/// <summary>
/// Request to update <see cref="Supplier"/>
/// </summary>
public sealed record UpdateSupplierRequest
{
    /// <summary>
    /// Public ID of the supplier
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public UpdateSupplierDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to handle the update operation for a <see cref="Supplier"/> entity.
/// </summary>
public sealed class UpdateSupplierEndpoint(AleTrackDbContext dbContext) : Endpoint<UpdateSupplierRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("suppliers/{id}");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status204NoContent)
            .Produces<FailureResponse>(StatusCodes.Status404NotFound)
            .WithName(nameof(UpdateSupplierEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Updates supplier";
                s.Responses[StatusCodes.Status204NoContent] = "Supplier updated";
                s.SetNotFoundResponse("Supplier");
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateSupplierRequest req, CancellationToken ct)
    {
        var supplier = await dbContext.Suppliers
            .Include(s => s.Contacts)
            .FirstOrDefaultAsync(s => s.PublicId == req.Id, ct);

        if (supplier == null)
            ThrowHelper.PublicEntityNotFound(nameof(Supplier), req.Id);

        supplier!.Name = req.Data.Name;
        supplier.BusinessName = req.Data.BusinessName;
        supplier.Note = req.Data.Note;
        supplier.OfficialAddress = req.Data.OfficialAddress.ToDbEntity();
        // Assigned unconditionally, so unticking "provozovna je na jiné adrese" actually
        // clears the stored address instead of silently keeping the old one.
        supplier.ContactAddress = req.Data.ContactAddress?.ToDbEntity();

        supplier.Contacts = req.Data.Contacts
            .Select(c => new SupplierContact
            {
                Type = c.Type,
                Description = c.Description,
                Value = c.Value
            })
            .ToList();

        await dbContext.SaveChangesAsync(ct);
        await Send.NoContentAsync(ct);
    }
}
