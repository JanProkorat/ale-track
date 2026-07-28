using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DeliveryItemWeightInputs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "delivery_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "package_size",
                table: "delivery_items",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "units_per_package",
                table: "delivery_items",
                type: "integer",
                nullable: false,
                // 1, not the scaffolded 0, matching the property initialiser: a single container
                // per unit is the neutral value. Zero would silently produce a zero line weight
                // for any row inserted without going through EF.
                defaultValue: 1);

            // Backfill from values live right now, as with the other snapshots in this work.
            migrationBuilder.Sql("""
                UPDATE delivery_items di
                SET kind = p.kind,
                    package_size = p.package_size,
                    units_per_package = p.units_per_package
                FROM products p
                WHERE di.product_id = p.id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "kind",
                table: "delivery_items");

            migrationBuilder.DropColumn(
                name: "package_size",
                table: "delivery_items");

            migrationBuilder.DropColumn(
                name: "units_per_package",
                table: "delivery_items");
        }
    }
}
