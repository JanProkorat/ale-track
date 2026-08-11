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
    /// <see cref="Manager"/>, but denied capabilities configured per role in the
    /// role_capabilities table — by default invoicing, the loading breakdown and money.
    /// </summary>
    Driver
}