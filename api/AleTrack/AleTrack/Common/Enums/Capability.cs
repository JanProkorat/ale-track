namespace AleTrack.Common.Enums;

/// <summary>
/// A named slice of content or functionality that a <see cref="UserRoleType"/> either
/// allows or denies, cutting across the module × <see cref="PermissionLevel"/> matrix.
/// The matrix grants access to a module; a capability subtracts part of it.
/// <para>
/// Capabilities are derived from the caller's roles only — there is deliberately no
/// per-user override. See the design at
/// <c>docs/superpowers/specs/2026-08-10-role-based-content-visibility-design.md</c>.
/// </para>
/// </summary>
public enum Capability
{
    /// <summary>
    /// The Fakturace section of a shipment and the price data behind it.
    /// </summary>
    Invoicing,

    /// <summary>
    /// The aggregated loading-breakdown views (the Vše / F1 / F2 tabs). Quantity data
    /// a driver legitimately receives for the unload view, so this one has no
    /// server-side counterpart — it exists to keep the field screen uncluttered.
    /// </summary>
    LoadingBreakdown,

    /// <summary>
    /// Any monetary amount, anywhere in the application.
    /// </summary>
    Money
}
