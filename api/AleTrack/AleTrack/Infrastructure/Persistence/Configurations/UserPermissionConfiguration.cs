using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

/// <summary>
/// Configures the <see cref="UserPermission"/> entity: one row per (user, module),
/// cascade-deleted with the user.
/// </summary>
internal sealed class UserPermissionConfiguration : IEntityTypeConfiguration<UserPermission>
{
    public void Configure(EntityTypeBuilder<UserPermission> builder)
    {
        builder.HasIndex(p => new { p.UserId, p.Module }).IsUnique();

        builder.HasOne(p => p.User)
            .WithMany(u => u.Permissions)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
