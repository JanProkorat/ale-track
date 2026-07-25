using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateInvoiceLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "invoice_id",
                table: "outgoing_shipment_invoice_lines",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<bool>(
                name: "is_private",
                table: "outgoing_shipment_invoice_lines",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "outgoing_shipment_id",
                table: "outgoing_shipment_invoice_lines",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            // Every existing line hangs off an invoice, which already knows its shipment. Without
            // this backfill the rows keep the 0 default and the foreign key below cannot be added.
            migrationBuilder.Sql(
                """
                UPDATE outgoing_shipment_invoice_lines AS l
                SET outgoing_shipment_id = i.outgoing_shipment_id
                FROM outgoing_shipment_invoices AS i
                WHERE l.invoice_id = i.id;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_outgoing_shipment_id",
                table: "outgoing_shipment_invoice_lines",
                column: "outgoing_shipment_id");

            migrationBuilder.AddCheckConstraint(
                name: "ck_outgoing_shipment_invoice_lines_private_has_no_invoice",
                table: "outgoing_shipment_invoice_lines",
                sql: "(\"is_private\" AND \"invoice_id\" IS NULL) OR (NOT \"is_private\" AND \"invoice_id\" IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_outgoing_shipments_outgoing~",
                table: "outgoing_shipment_invoice_lines",
                column: "outgoing_shipment_id",
                principalTable: "outgoing_shipments",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_outgoing_shipments_outgoing~",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_invoice_lines_outgoing_shipment_id",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropCheckConstraint(
                name: "ck_outgoing_shipment_invoice_lines_private_has_no_invoice",
                table: "outgoing_shipment_invoice_lines");

            // Pieces excluded from invoicing cannot be expressed once invoice_id is required
            // again, so they are dropped rather than silently rolled onto invoice 0.
            migrationBuilder.Sql("DELETE FROM outgoing_shipment_invoice_lines WHERE invoice_id IS NULL;");

            migrationBuilder.DropColumn(
                name: "is_private",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "outgoing_shipment_id",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.AlterColumn<long>(
                name: "invoice_id",
                table: "outgoing_shipment_invoice_lines",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
