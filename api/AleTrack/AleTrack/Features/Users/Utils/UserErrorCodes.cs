namespace AleTrack.Features.Users.Utils;

/// <summary>
/// Contains a collection of error codes used to indicate specific user-related error scenarios.
/// </summary>
public static class UserErrorCodes
{
    /// <summary>
    /// Error code for case when user with given user name was not found in database
    /// </summary>
    public const string UserNotFoundError = "USER_NOT_FOUND";

    /// <summary>
    /// Error code for case when the provided password is incorrect.
    /// </summary>
    public const string InvalidPasswordError = "INVALID_PASSWORD";

    /// <summary>
    /// Error code for case when the provided refresh token is invalid or expired.
    /// </summary>
    public const string InvalidRefreshTokenError = "INVALID_REFRESH_TOKEN";

    /// <summary>
    /// Error code for case when a driver record is linked to a user who does not hold the Driver role.
    /// </summary>
    public const string DriverLinkRequiresDriverRole = "DRIVER_LINK_REQUIRES_DRIVER_ROLE";
}