using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InvoiceLineSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "outgoing_shipment_invoice_lines",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "package_size",
                table: "outgoing_shipment_invoice_lines",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "product_name",
                table: "outgoing_shipment_invoice_lines",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "unit_price_with_vat",
                table: "outgoing_shipment_invoice_lines",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "unit_price_without_vat",
                table: "outgoing_shipment_invoice_lines",
                type: "numeric",
                nullable: true);

            // Backfill from values live right now — the same limitation, stated the same way, as
            // the C1 stop-item backfill: pre-migration invoices reflect product values as of this
            // migration rather than as of issue. The read path has no fallback, so this is what
            // keeps historical lines rendering at all.
            //
            // Order-item lines take the product's facts; custom-extra lines take the extra's
            // description and keep null prices, which is what the mapper already returned for them.
            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_invoice_lines l
                SET product_name = left(p.name, 100),
                    kind = p.kind,
                    package_size = p.package_size,
                    unit_price_with_vat = p.price_with_vat,
                    unit_price_without_vat = p.price_without_vat
                FROM order_items oi
                JOIN products p ON p.id = oi.product_id
                WHERE l.order_item_id = oi.id;
                """);

            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_invoice_lines l
                SET product_name = left(e.description, 100)
                FROM order_custom_extra_items e
                WHERE l.custom_extra_item_id = e.id;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "kind",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "package_size",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "product_name",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "unit_price_with_vat",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "unit_price_without_vat",
                table: "outgoing_shipment_invoice_lines");
        }
    }
}
