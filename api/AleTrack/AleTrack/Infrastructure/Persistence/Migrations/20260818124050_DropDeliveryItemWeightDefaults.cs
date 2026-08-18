using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Drops the database defaults left on delivery_items' weight-input columns from when they were
    /// NOT NULL.
    /// </summary>
    /// <remarks>
    /// Hand-written: the EF model never declared these defaults, so no model change produces this
    /// diff — they exist only in the database, which is precisely why they are a trap.
    ///
    /// With them in place, an INSERT that omits kind and units_per_package — the natural way to
    /// write a supplier line, which has no weight inputs — gets 0 and 1 instead of nulls and is
    /// rejected by ck_delivery_items_weight_inputs_on_products_only. Verified against the local
    /// database before writing this. The endpoints set both columns to null explicitly and are
    /// unaffected, but a default that turns an omission into an invalid row is a hazard for the
    /// seeder and for any later hand-written statement, and the columns are nullable now: absent
    /// weight inputs are exactly what null means.
    /// </remarks>
    public partial class DropDeliveryItemWeightDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""ALTER TABLE delivery_items ALTER COLUMN "kind" DROP DEFAULT;""");
            migrationBuilder.Sql("""ALTER TABLE delivery_items ALTER COLUMN "units_per_package" DROP DEFAULT;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""ALTER TABLE delivery_items ALTER COLUMN "kind" SET DEFAULT 0;""");
            migrationBuilder.Sql("""ALTER TABLE delivery_items ALTER COLUMN "units_per_package" SET DEFAULT 1;""");
        }
    }
}
