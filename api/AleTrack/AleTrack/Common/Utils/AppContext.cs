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

    /// <inheritdoc />
    public IReadOnlyDictionary<ModuleType, PermissionLevel> Permissions
    {
        get
        {
            // Admin ⇒ full access to every module.
            if (Roles.Contains(UserRoleType.Admin))
                return Enum.GetValues<ModuleType>().ToDictionary(m => m, _ => PermissionLevel.Edit);

            var result = new Dictionary<ModuleType, PermissionLevel>();
            var claims = User?.FindAll(JwtService.PermissionClaimType) ?? [];
            foreach (var claim in claims)
            {
                var parts = claim.Value.Split(':');
                if (parts.Length == 2
                    && Enum.TryParse<ModuleType>(parts[0], out var module)
                    && Enum.TryParse<PermissionLevel>(parts[1], out var level))
                {
                    result[module] = level;
                }
            }

            return result;
        }
    }
}