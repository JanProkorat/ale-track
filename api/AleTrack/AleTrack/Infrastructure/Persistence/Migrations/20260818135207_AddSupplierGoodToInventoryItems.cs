using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierGoodToInventoryItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "supplier_good_id",
                table: "inventory_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_supplier_good_id",
                table: "inventory_items",
                column: "supplier_good_id",
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_at_most_one_source",
                table: "inventory_items",
                sql: "NOT (\"product_id\" IS NOT NULL AND \"supplier_good_id\" IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_inventory_items_supplier_goods_supplier_good_id",
                table: "inventory_items",
                column: "supplier_good_id",
                principalTable: "supplier_goods",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_inventory_items_supplier_goods_supplier_good_id",
                table: "inventory_items");

            migrationBuilder.DropIndex(
                name: "IX_inventory_items_supplier_good_id",
                table: "inventory_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_at_most_one_source",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "supplier_good_id",
                table: "inventory_items");
        }
    }
}
