using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Adds the containers-per-sellable-unit count and backfills it from the only two places the
    /// information previously existed: the crate size implied by a product's price ratio, and the
    /// pack count written into multipack names.
    /// </summary>
    /// <inheritdoc />
    public partial class AddProductUnitsPerPackage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1, not 0: every product holds at least one container, and a 0 would collapse its
            // weight. Existing rows are backfilled with this, then corrected below.
            migrationBuilder.AddColumn<int>(
                name: "units_per_package",
                table: "products",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            // Crates. ProductKind.Bottle (2) renders as "Basa", so the unit is a crate; the counts
            // match the seed data's own PriceWithVat / PriceForUnitWithVat ratio.
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 20 WHERE kind = 2 AND package_size = 0.5;");
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 24 WHERE kind = 2 AND package_size = 0.33;");

            // Multipacks (4). The count lived only in the name, which is precisely why these had no
            // computable weight at all.
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 8 WHERE kind = 4 AND name LIKE '%8x';");
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 7 WHERE kind = 4 AND name LIKE '%7 svijanských kousků%';");
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 6 WHERE kind = 4 AND name LIKE '%6 piv%';");
            // Duo packs: two 1 l bottles, implied only by the builder name and a Description.
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 2 WHERE kind = 4 AND package_size = 1;");

            // One six-pack is filed as a Can (3) rather than a Multipack.
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 6 WHERE kind = 3 AND name LIKE '6-Pack%';");

            // Belt and braces for any row that predates the default.
            migrationBuilder.Sql(
                "UPDATE products SET units_per_package = 1 WHERE units_per_package < 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "units_per_package",
                table: "products");
        }
    }
}
