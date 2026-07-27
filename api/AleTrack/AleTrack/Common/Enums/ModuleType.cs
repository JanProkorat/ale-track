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
    Reports
}
