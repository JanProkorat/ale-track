using AleTrack.Common.Enums;
using AleTrack.Common.Models;

namespace AleTrack.Features.Suppliers.Commands.Create;

/// <summary>
/// Data used to create a new supplier. Opening hours and goods are added afterwards through
/// their own endpoints — a new supplier is worth saving from a name and an address alone,
/// and forcing a whole schedule up front would turn one form into three.
/// </summary>
public sealed record CreateSupplierDto
{
    /// <summary>
    /// Name of the supplier
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Registered business name. Can be null.
    /// </summary>
    public string? BusinessName { get; set; }

    /// <summary>
    /// Operational note for whoever drives there. Can be null.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Registered seat of the supplier
    /// </summary>
    public AddressDto OfficialAddress { get; set; } = null!;

    /// <summary>
    /// Address of the branch actually visited. Null when it is the registered seat.
    /// </summary>
    public AddressDto? ContactAddress { get; set; }

    /// <summary>
    /// Contacts to create alongside the supplier
    /// </summary>
    public List<SupplierContactUpsertDto> Contacts { get; set; } = [];
}

/// <summary>
/// A contact as it arrives on a create or update. Shared by both commands: contacts are
/// replaced wholesale on update, so the two carry exactly the same fields.
/// </summary>
public sealed record SupplierContactUpsertDto
{
    /// <summary>
    /// Whether the value is an e-mail address or a phone number
    /// </summary>
    public ContactType Type { get; set; }

    /// <summary>
    /// What this contact is for, such as "Plnírna"
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// The phone number or e-mail address itself
    /// </summary>
    public string Value { get; set; } = null!;
}
