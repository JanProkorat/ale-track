using AleTrack.Common.Models;

namespace AleTrack.Features.Users.Utils;

/// <summary>
/// Throw helper for all user features
/// </summary>
public static class UserThrowHelper
{
    /// <summary>
    /// Throws an AleTrackException indicating that a user with the specified user name was not found.
    /// </summary>
    /// <param name="userName">The name of the user that was not found.</param>
    /// <exception cref="AleTrackException">Thrown when the user is not found, containing details such as status code, error code, and error properties.</exception>
    public static void UserNotFound(string userName)
        => throw new AleTrackException(
            StatusCodes.Status404NotFound,
            UserErrorCodes.UserNotFoundError,
            new Dictionary<string, object>
            {
                { nameof(userName), userName }
            });

    /// <summary>
    /// Throws an AleTrackException indicating that the provided password is invalid.
    /// </summary>
    /// <exception cref="AleTrackException">
    /// Thrown when the password provided during authentication does not match the stored password.
    /// The exception includes details such as the status code and error code.
    /// </exception>
    public static void InvalidPassword()
        => throw new AleTrackException(
            StatusCodes.Status401Unauthorized,
            UserErrorCodes.InvalidPasswordError);
}