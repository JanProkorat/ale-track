using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProductPackaging : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "container",
                table: "products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "sale_unit",
                table: "products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Both enums start at 1, so the added columns hold an invalid 0 until backfilled. Every
            // branch below ends in a catch-all, so no row is left at 0.
            //
            // ProductPackaging.FromLegacyShape is the C# mirror of this mapping, used for seeded
            // fixtures and covered case-for-case by ProductPackagingLegacyShapeTests. Change one and
            // the other has to follow.
            //
            // container:  1 Keg  2 Bottle  3 Can  4 Jug  5 Other
            // sale_unit:  1 Single  2 Crate  3 Multipack  4 Tray
            // kind:       1 Keg  2 Bottle  3 Can  4 Multipack  5 Other
            migrationBuilder.Sql(
                """
                UPDATE products SET
                    container = CASE
                        WHEN kind = 1 THEN 1
                        WHEN kind = 2 AND package_size IN (0.33, 0.5, 0.75, 10) THEN 2
                        -- A 1 l or 2 l "bottle" is decorative glassware: a džbán, never crated.
                        WHEN kind = 2 AND package_size IN (1, 2) THEN 4
                        WHEN kind = 3 THEN 3
                        -- A multipack's container is not recorded anywhere; the name is the only
                        -- evidence, and it only ever says so for cans.
                        WHEN kind = 4 AND name ILIKE '%plech%' THEN 3
                        WHEN kind = 4 THEN 2
                        ELSE 5
                    END,
                    sale_unit = CASE
                        WHEN kind = 2 AND package_size IN (0.33, 0.5) THEN 2
                        -- package_size = 10 is the superseded encoding that held a crate's total
                        -- volume rather than one bottle's. Left as a single unit so the weight
                        -- table's whole-crate figure for it is not charged a second crate tare.
                        WHEN kind = 3 AND units_per_package > 1 THEN 4
                        WHEN kind = 4 THEN 3
                        ELSE 1
                    END;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "container",
                table: "products");

            migrationBuilder.DropColumn(
                name: "sale_unit",
                table: "products");
        }
    }
}
