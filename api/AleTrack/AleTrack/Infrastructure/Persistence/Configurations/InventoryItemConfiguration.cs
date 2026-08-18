using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> builder)
    {
        // At most one reference, not exactly one: a hand-written row names something the app knows
        // nothing about and legitimately has neither. What must never happen is a row claiming to be
        // both a brewery product and a supplier's goods, because every read picks one of the two to
        // resolve its name and price from and would silently disagree with the other.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_inventory_items_at_most_one_source",
            """NOT ("product_id" IS NOT NULL AND "supplier_good_id" IS NOT NULL)"""));
    }
}
