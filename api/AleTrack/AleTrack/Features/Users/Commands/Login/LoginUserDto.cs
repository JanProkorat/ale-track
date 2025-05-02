namespace AleTrack.Features.Users.Commands.Login;

public sealed record LoginUserDto
{
    /// <summary>
    /// User name to be logged in
    /// </summary>
    public string UserName { get; set; } = null!;
    
    /// <summary>
    /// User password
    /// </summary>
    public string Password { get; set; } = null!;
}