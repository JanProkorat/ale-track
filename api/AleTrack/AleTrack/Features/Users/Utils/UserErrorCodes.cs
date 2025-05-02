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
    public static string InvalidPasswordError = "INVALID_PASSWORD";
}