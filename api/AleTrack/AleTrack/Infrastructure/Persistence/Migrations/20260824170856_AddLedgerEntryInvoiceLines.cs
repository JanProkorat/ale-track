using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLedgerEntryInvoiceLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ledger_entry_id",
                table: "outgoing_shipment_invoice_lines",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_ledger_entry_id",
                table: "outgoing_shipment_invoice_lines",
                column: "ledger_entry_id");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_client_ledger_entries_ledge~",
                table: "outgoing_shipment_invoice_lines",
                column: "ledger_entry_id",
                principalTable: "client_ledger_entries",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_client_ledger_entries_ledge~",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_invoice_lines_ledger_entry_id",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "ledger_entry_id",
                table: "outgoing_shipment_invoice_lines");
        }
    }
}
