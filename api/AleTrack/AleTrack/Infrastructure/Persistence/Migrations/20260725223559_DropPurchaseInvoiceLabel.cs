using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropPurchaseInvoiceLabel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "label",
                table: "outgoing_shipment_purchase_invoices");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "label",
                table: "outgoing_shipment_purchase_invoices",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);
        }
    }
}
