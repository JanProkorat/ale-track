using System.Security.Claims;
using AleTrack.Common.Enums;

namespace AleTrack.Common.Utils;

/// <inheritdoc />
public class AppContext(IHttpContextAccessor httpContextAccessor) : IAppContext
{
    private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    /// <inheritdoc />
    public Guid? UserId
    {
        get
        {
            var id = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(id, out var guid) ? guid : null;
        }
    }

    /// <inheritdoc />
    public string? UserName => User?.FindFirst(ClaimTypes.Name)?.Value;

    /// <inheritdoc />
    public List<UserRoleType> Roles
    {
        get
        {
            var roles = _httpContextAccessor.HttpContext?.User
                .FindAll(ClaimTypes.Role)
                .Select(c => Enum.Parse<UserRoleType>(c.Value))
                .ToList();
            
            return roles ?? [];
        }
    }
}