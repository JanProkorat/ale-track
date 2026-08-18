using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierDeliveryStops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "supplier_id",
                table: "delivery_stops",
                type: "bigint",
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "units_per_package",
                table: "delivery_items",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<long>(
                name: "product_id",
                table: "delivery_items",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AlterColumn<int>(
                name: "kind",
                table: "delivery_items",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<int>(
                name: "charge_kind",
                table: "delivery_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "supplier_good_id",
                table: "delivery_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_delivery_stops_supplier_id",
                table: "delivery_stops",
                column: "supplier_id");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_items_supplier_good_id",
                table: "delivery_items",
                column: "supplier_good_id");

            migrationBuilder.AddCheckConstraint(
                name: "ck_delivery_items_charge_kind_with_good",
                table: "delivery_items",
                sql: "(\"supplier_good_id\" IS NULL) = (\"charge_kind\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_delivery_items_exactly_one_source",
                table: "delivery_items",
                sql: "(\"product_id\" IS NULL) <> (\"supplier_good_id\" IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_delivery_items_weight_inputs_on_products_only",
                table: "delivery_items",
                sql: "(\"product_id\" IS NOT NULL) OR (\"kind\" IS NULL AND \"package_size\" IS NULL AND \"units_per_package\" IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_delivery_items_supplier_goods_supplier_good_id",
                table: "delivery_items",
                column: "supplier_good_id",
                principalTable: "supplier_goods",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_delivery_stops_suppliers_supplier_id",
                table: "delivery_stops",
                column: "supplier_id",
                principalTable: "suppliers",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_delivery_items_supplier_goods_supplier_good_id",
                table: "delivery_items");

            migrationBuilder.DropForeignKey(
                name: "FK_delivery_stops_suppliers_supplier_id",
                table: "delivery_stops");

            migrationBuilder.DropIndex(
                name: "IX_delivery_stops_supplier_id",
                table: "delivery_stops");

            migrationBuilder.DropIndex(
                name: "IX_delivery_items_supplier_good_id",
                table: "delivery_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_delivery_items_charge_kind_with_good",
                table: "delivery_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_delivery_items_exactly_one_source",
                table: "delivery_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_delivery_items_weight_inputs_on_products_only",
                table: "delivery_items");

            migrationBuilder.DropColumn(
                name: "supplier_id",
                table: "delivery_stops");

            migrationBuilder.DropColumn(
                name: "charge_kind",
                table: "delivery_items");

            migrationBuilder.DropColumn(
                name: "supplier_good_id",
                table: "delivery_items");

            migrationBuilder.AlterColumn<int>(
                name: "units_per_package",
                table: "delivery_items",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "product_id",
                table: "delivery_items",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "kind",
                table: "delivery_items",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
