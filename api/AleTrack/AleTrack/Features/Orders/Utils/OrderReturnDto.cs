namespace AleTrack.Features.Orders.Utils;

/// <summary>
/// A returnable item the client hands back against an order (empty kegs,
/// bottles…). Used for both read and write — <see cref="Id"/> is set on read and
/// on updates of an existing item, and null for newly-added ones.
/// </summary>
public sealed record OrderReturnDto
{
    /// <summary>Public ID of the return item (null when newly added).</summary>
    public Guid? Id { get; set; }

    /// <summary>Name of the returned item.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Amount returned.</summary>
    public int Quantity { get; set; }

    /// <summary>Optional free-form note about the returned item.</summary>
    public string? Note { get; set; }
}
