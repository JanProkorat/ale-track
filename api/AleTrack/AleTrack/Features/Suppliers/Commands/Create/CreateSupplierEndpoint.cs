using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using FastEndpoints;

namespace AleTrack.Features.Suppliers.Commands.Create;

/// <summary>
/// Request to create new <see cref="Supplier"/>
/// </summary>
public sealed record CreateSupplierRequest
{
    /// <summary>
    /// Body of the request
    /// </summary>
    [FromBody]
    public CreateSupplierDto Data { get; set; } = null!;
}

/// <summary>
/// Endpoint to create a new <see cref="Supplier"/>.
/// </summary>
public sealed class CreateSupplierEndpoint(AleTrackDbContext dbContext) : Endpoint<CreateSupplierRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("suppliers");
        Description(b => b
            .RequirePermission(ModuleType.Suppliers, PermissionLevel.Edit)
            .Produces<string>(StatusCodes.Status201Created)
            .WithName(nameof(CreateSupplierEndpoint))
            .ClearDefaultProduces(StatusCodes.Status200OK));

        DontCatchExceptions();

        Summary(s =>
            {
                s.Summary = "Creates supplier";
                s.Responses[StatusCodes.Status201Created] = "Supplier created";
            }
        );
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateSupplierRequest req, CancellationToken ct)
    {
        var supplier = new Supplier
        {
            Name = req.Data.Name,
            BusinessName = req.Data.BusinessName,
            Note = req.Data.Note,
            OfficialAddress = req.Data.OfficialAddress.ToDbEntity(),
            ContactAddress = req.Data.ContactAddress?.ToDbEntity(),
            Contacts = req.Data.Contacts
                .Select(c => new SupplierContact
                {
                    Type = c.Type,
                    Description = c.Description,
                    Value = c.Value
                })
                .ToList()
        };

        dbContext.Suppliers.Add(supplier);
        await dbContext.SaveChangesAsync(ct);

        await Send.ResponseAsync(supplier.PublicId, statusCode: StatusCodes.Status201Created, cancellation: ct);
    }
}
