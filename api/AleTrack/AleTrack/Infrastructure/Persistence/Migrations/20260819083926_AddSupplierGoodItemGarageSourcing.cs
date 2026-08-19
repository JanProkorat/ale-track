using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierGoodItemGarageSourcing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "quantity_from_garage",
                table: "order_supplier_good_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Zero means "all collected at the supplier", which is wrong for every existing
            // line whose good is one we keep in the garage — they predate the column and were
            // written under its default alone. Backfilled to the same rule the code now seeds
            // with (SupplierGoodSourcing.DefaultFromGarage), so old and new lines agree; the
            // 0 default already covers goods fetched from the supplier.
            migrationBuilder.Sql(
                """
                UPDATE "order_supplier_good_items" AS i
                SET "quantity_from_garage" = i."quantity"
                FROM "supplier_goods" AS g
                WHERE g."id" = i."supplier_good_id"
                  AND g."pickup_source" = 0
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "quantity_from_garage",
                table: "order_supplier_good_items");
        }
    }
}
