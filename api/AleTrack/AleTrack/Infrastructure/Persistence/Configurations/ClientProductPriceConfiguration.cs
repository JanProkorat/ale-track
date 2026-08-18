using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class ClientProductPriceConfiguration : IEntityTypeConfiguration<ClientProductPrice>
{
    public void Configure(EntityTypeBuilder<ClientProductPrice> builder)
    {
        // One price per client per product — the pair is the real key, and the upsert
        // endpoint relies on this to stay true.
        builder.HasIndex(x => new { x.ClientId, x.ProductId }).IsUnique();

        // FK columns are indexed for the per-client list read and for the product-side
        // Restrict check.
        builder.HasIndex(x => x.ProductId);
    }
}
