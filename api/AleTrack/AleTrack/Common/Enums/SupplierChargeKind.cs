namespace AleTrack.Common.Enums;

/// <summary>
/// What a supplier's price row charges for. The same physical bottle is priced several
/// ways at once — gas refilled into it, the bottle bought outright, a returnable deposit
/// held against it, or monthly rent while the supplier keeps ownership — which is why a
/// good carries one price per kind rather than a single price.
/// </summary>
public enum SupplierChargeKind
{
    /// <summary>Plnění — refilling gas into a bottle we already hold.</summary>
    Fill,

    /// <summary>Nákup — buying the goods outright.</summary>
    Purchase,

    /// <summary>Záloha — a returnable deposit held against a bottle or crate.</summary>
    Deposit,

    /// <summary>Nájem — recurring rent for goods the supplier still owns.</summary>
    Rent,

    /// <summary>Ostatní — anything the four above do not describe.</summary>
    Other
}
