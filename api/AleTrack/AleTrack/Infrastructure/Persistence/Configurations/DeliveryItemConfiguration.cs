using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public sealed class DeliveryItemConfiguration : IEntityTypeConfiguration<DeliveryItem>
{
    public void Configure(EntityTypeBuilder<DeliveryItem> builder)
    {
        // A line is either a brewery product or one charge kind of a supplier good, never both and
        // never neither. Both foreign keys are nullable to say so, which on its own would also
        // permit a line pointing at nothing — the validators reject that shape, but a validator
        // only guards the endpoints it is wired to, and these rows are also written by the seeder
        // and by hand during migrations. The constraint is what makes the invariant true of the
        // table rather than of one code path.
        builder.ToTable(t =>
        {
            t.HasCheckConstraint(
                "ck_delivery_items_exactly_one_source",
                """("product_id" IS NULL) <> ("supplier_good_id" IS NULL)""");

            // The charge kind is meaningless without a good to charge for, and a good's price cannot
            // be resolved without it — so the two travel together or not at all.
            t.HasCheckConstraint(
                "ck_delivery_items_charge_kind_with_good",
                """("supplier_good_id" IS NULL) = ("charge_kind" IS NULL)""");

            // The weight inputs describe a product's packaging. A supplier good states its size as
            // free text, so it has none to record; keeping them non-null there would have meant
            // inventing a ProductKind for a CO₂ bottle, which the Operations report would then have
            // weighed into the incoming series.
            t.HasCheckConstraint(
                "ck_delivery_items_weight_inputs_on_products_only",
                """("product_id" IS NOT NULL) OR ("kind" IS NULL AND "package_size" IS NULL AND "units_per_package" IS NULL)""");
        });
    }
}
