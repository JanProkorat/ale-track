using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientNoteConfiguration : IEntityTypeConfiguration<ClientNote>
{
    public void Configure(EntityTypeBuilder<ClientNote> builder)
    {
        // Filter out notes of soft-deleted clients through the relationship
        builder.HasQueryFilter(cn => !cn.Client.IsDeleted);
    }
}
