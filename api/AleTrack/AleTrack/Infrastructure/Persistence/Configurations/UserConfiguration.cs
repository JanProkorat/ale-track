using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

/// <summary>
/// Configures the database schema and relationships for the User entity.
/// </summary>
/// <remarks>
/// This configuration uses Entity Framework Core's Fluent API to define settings for the User entity.
/// It sets default data, specifies property constraints, and establishes entity relationships.
/// </remarks>
internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasData(new User
        {
            Id = 1,
            UserName = "admin",
            Password = "$2a$13$vSTwVilIMPc4b6AQEx6BAe.jKbwcLbBcUuaPZ6P.s23N36bB4MbFu",
            PublicId = new Guid("5e58584b-76f1-4205-a5ab-9a37730db25b")
        });
    }
}