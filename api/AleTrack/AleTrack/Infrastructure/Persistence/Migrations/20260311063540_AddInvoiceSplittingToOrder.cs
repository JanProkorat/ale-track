using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceSplittingToOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_inventory_items_product_id",
                table: "inventory_items");

            migrationBuilder.AddColumn<int>(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_extra_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "inventory_item_id",
                table: "outgoing_shipment_extra_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "public_id",
                table: "outgoing_shipment_extra_items",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_extra_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "first_invoice_quantity",
                table: "order_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "second_invoice_quantity",
                table: "order_items",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_extra_items_inventory_item_id",
                table: "outgoing_shipment_extra_items",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_extra_items_public_id",
                table: "outgoing_shipment_extra_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_product_id",
                table: "inventory_items",
                column: "product_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_extra_items_inventory_items_inventory_ite~",
                table: "outgoing_shipment_extra_items",
                column: "inventory_item_id",
                principalTable: "inventory_items",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_extra_items_inventory_items_inventory_ite~",
                table: "outgoing_shipment_extra_items");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_extra_items_inventory_item_id",
                table: "outgoing_shipment_extra_items");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_extra_items_public_id",
                table: "outgoing_shipment_extra_items");

            migrationBuilder.DropIndex(
                name: "IX_inventory_items_product_id",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_extra_items");

            migrationBuilder.DropColumn(
                name: "inventory_item_id",
                table: "outgoing_shipment_extra_items");

            migrationBuilder.DropColumn(
                name: "public_id",
                table: "outgoing_shipment_extra_items");

            migrationBuilder.DropColumn(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_extra_items");

            migrationBuilder.DropColumn(
                name: "first_invoice_quantity",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "second_invoice_quantity",
                table: "order_items");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_product_id",
                table: "inventory_items",
                column: "product_id");
        }
    }
}
