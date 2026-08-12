using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

/// <summary>
/// Maps <see cref="RoleCapability"/>. One row per (role, capability) at most.
/// </summary>
public sealed class RoleCapabilityConfiguration : IEntityTypeConfiguration<RoleCapability>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<RoleCapability> builder)
    {
        builder.HasIndex(x => new { x.Role, x.CapabilityKey }).IsUnique();
    }
}
