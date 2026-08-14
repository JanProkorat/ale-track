namespace AleTrack.Common.Enums;

/// <summary>
/// Application modules that a user's access can be scoped to.
/// Used together with <see cref="PermissionLevel"/> for granular per-module rights.
/// </summary>
public enum ModuleType
{
    /// <summary>Objednávky.</summary>
    Orders,

    /// <summary>Vývozy (outgoing shipments).</summary>
    Shipments,

    /// <summary>Dovozy zboží (product deliveries).</summary>
    Deliveries,

    /// <summary>Sklad (inventory).</summary>
    Inventory,

    /// <summary>Pivovary (breweries + their ceník).</summary>
    Breweries,

    /// <summary>Klienti.</summary>
    Clients,

    /// <summary>Řidiči (drivers).</summary>
    Drivers,

    /// <summary>Vozy (vehicles).</summary>
    Vehicles,

    /// <summary>Uživatelé (user administration).</summary>
    Users,

    /// <summary>Reporty (read-only analytics).</summary>
    Reports,

    /// <summary>
    /// Garážový prodej (walk-in counter sales off the warehouse shelf).
    /// </summary>
    /// <remarks>
    /// Appended deliberately: these values are persisted in user_module_permissions, so
    /// reordering them would rewrite the meaning of every existing row.
    /// </remarks>
    Sales
}
