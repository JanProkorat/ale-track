using AleTrack.Common.Models;
using AleTrack.Features.Suppliers.Commands.Create;

namespace AleTrack.Features.Suppliers.Commands.Update;

/// <summary>
/// Data used to update a supplier's identity, addresses and contacts. Opening hours and
/// goods have their own endpoints.
/// </summary>
public sealed record UpdateSupplierDto
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
    /// Address of the branch actually visited.
    /// </summary>
    /// <remarks>
    /// Null clears it, meaning "the branch is the registered seat". Unlike
    /// <c>UpdateClientEndpoint</c>, which only assigns a non-null contact address and so
    /// cannot ever unset one, this genuinely round-trips the form's checkbox.
    /// </remarks>
    public AddressDto? ContactAddress { get; set; }

    /// <summary>
    /// The supplier's full contact list — replaces what is stored.
    /// </summary>
    public List<SupplierContactUpsertDto> Contacts { get; set; } = [];
}
