namespace AleTrack.Common.Enums;

/// <summary>
/// Defines the roles within the system.
/// </summary>
public enum UserRoleType
{
    /// <summary>
    /// Represents an administrative role in the system with elevated privileges and access rights.
    /// </summary>
    Admin,

    /// <summary>
    /// Represents a standard office user with basic access and permissions.
    /// </summary>
    Manager,

    /// <summary>
    /// A driver in the field. Granted access through the same permission matrix as
    /// <see cref="Manager"/>, but denied the capabilities in
    /// <see cref="Authorization.RoleCapabilities"/> — invoicing, the loading breakdown
    /// and money — so the shipment screen shows only what is needed on the road.
    /// </summary>
    Driver
}