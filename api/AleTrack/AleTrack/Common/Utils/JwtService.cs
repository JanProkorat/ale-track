using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AleTrack.Common.Enums;
using AleTrack.Entities;
using Microsoft.IdentityModel.Tokens;

namespace AleTrack.Common.Utils;

/// <inheritdoc/>
internal sealed class JwtService(IConfiguration configuration) : IJwtService
{
    private readonly IConfiguration _configuration = configuration;

    /// <inheritdoc/>
    public string GenerateToken(User user)
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JWT_Key"]));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? string.Empty),
            new(ClaimTypes.GivenName, user.FirstName ?? string.Empty),
            new(ClaimTypes.Surname, user.LastName ?? string.Empty)
        };
        claims.AddRange(user.UserRoles.Select(role => new Claim(ClaimTypes.Role, role.Type.ToString())));
        
        var token = new JwtSecurityToken(
            issuer: _configuration["JWT_Issuer"],
            claims: claims,
            expires: DateTime.Now.AddHours(24), // Token valid for 24 hours
            signingCredentials: credentials
        );
        
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}