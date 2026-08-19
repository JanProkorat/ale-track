using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierGoodInvoiceLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "supplier_good_item_id",
                table: "outgoing_shipment_invoice_lines",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_supplier_good_item_id",
                table: "outgoing_shipment_invoice_lines",
                column: "supplier_good_item_id");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_order_supplier_good_items_s~",
                table: "outgoing_shipment_invoice_lines",
                column: "supplier_good_item_id",
                principalTable: "order_supplier_good_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_order_supplier_good_items_s~",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_invoice_lines_supplier_good_item_id",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "supplier_good_item_id",
                table: "outgoing_shipment_invoice_lines");
        }
    }
}
