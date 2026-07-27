using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class StockPurchasesAndPurchaseInvoices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Hand-edited: EF scaffolded a drop + create for the renamed stock-purchase table,
            // which would have thrown away every existing row. The table and its constraints are
            // renamed in place instead; the CreateTable EF produced for it is gone.
            migrationBuilder.RenameTable(
                name: "outgoing_shipment_inventory_extra_items",
                newName: "outgoing_shipment_stock_purchase_items");

            migrationBuilder.RenameIndex(
                name: "IX_outgoing_shipment_inventory_extra_items_outgoing_shipment_id",
                table: "outgoing_shipment_stock_purchase_items",
                newName: "IX_outgoing_shipment_stock_purchase_items_outgoing_shipment_id");

            migrationBuilder.RenameIndex(
                name: "IX_outgoing_shipment_inventory_extra_items_product_id",
                table: "outgoing_shipment_stock_purchase_items",
                newName: "IX_outgoing_shipment_stock_purchase_items_product_id");

            migrationBuilder.RenameIndex(
                name: "IX_outgoing_shipment_inventory_extra_items_public_id",
                table: "outgoing_shipment_stock_purchase_items",
                newName: "IX_outgoing_shipment_stock_purchase_items_public_id");

            migrationBuilder.Sql("""
                ALTER TABLE outgoing_shipment_stock_purchase_items
                    RENAME CONSTRAINT "PK_outgoing_shipment_inventory_extra_items"
                    TO "PK_outgoing_shipment_stock_purchase_items";
                ALTER TABLE outgoing_shipment_stock_purchase_items
                    RENAME CONSTRAINT "FK_outgoing_shipment_inventory_extra_items_outgoing_shipments_~"
                    TO "FK_outgoing_shipment_stock_purchase_items_outgoing_shipments_o~";
                ALTER TABLE outgoing_shipment_stock_purchase_items
                    RENAME CONSTRAINT "FK_outgoing_shipment_inventory_extra_items_products_product_id"
                    TO "FK_outgoing_shipment_stock_purchase_items_products_product_id";
                """);

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_purchase_invoices",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    label = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_purchase_invoices", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_purchase_invoices_outgoing_shipments_outg~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_purchase_invoice_lines",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    purchase_invoice_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_purchase_invoice_lines", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_purchase_invoice_lines_outgoing_shipment_~",
                        column: x => x.purchase_invoice_id,
                        principalTable: "outgoing_shipment_purchase_invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_purchase_invoice_lines_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_purchase_invoice_lines_product_id",
                table: "outgoing_shipment_purchase_invoice_lines",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_purchase_invoice_lines_public_id",
                table: "outgoing_shipment_purchase_invoice_lines",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_purchase_invoice_lines_purchase_invoice_i~",
                table: "outgoing_shipment_purchase_invoice_lines",
                columns: new[] { "purchase_invoice_id", "product_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_purchase_invoices_outgoing_shipment_id_se~",
                table: "outgoing_shipment_purchase_invoices",
                columns: new[] { "outgoing_shipment_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_purchase_invoices_public_id",
                table: "outgoing_shipment_purchase_invoices",
                column: "public_id",
                unique: true);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_purchase_invoice_lines");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_purchase_invoices");

            // Mirror of the hand-edited rename in Up — the stock-purchase rows are kept.
            migrationBuilder.Sql("""
                ALTER TABLE outgoing_shipment_stock_purchase_items
                    RENAME CONSTRAINT "PK_outgoing_shipment_stock_purchase_items"
                    TO "PK_outgoing_shipment_inventory_extra_items";
                ALTER TABLE outgoing_shipment_stock_purchase_items
                    RENAME CONSTRAINT "FK_outgoing_shipment_stock_purchase_items_outgoing_shipments_o~"
                    TO "FK_outgoing_shipment_inventory_extra_items_outgoing_shipments_~";
                ALTER TABLE outgoing_shipment_stock_purchase_items
                    RENAME CONSTRAINT "FK_outgoing_shipment_stock_purchase_items_products_product_id"
                    TO "FK_outgoing_shipment_inventory_extra_items_products_product_id";
                """);

            migrationBuilder.RenameIndex(
                name: "IX_outgoing_shipment_stock_purchase_items_outgoing_shipment_id",
                table: "outgoing_shipment_stock_purchase_items",
                newName: "IX_outgoing_shipment_inventory_extra_items_outgoing_shipment_id");

            migrationBuilder.RenameIndex(
                name: "IX_outgoing_shipment_stock_purchase_items_product_id",
                table: "outgoing_shipment_stock_purchase_items",
                newName: "IX_outgoing_shipment_inventory_extra_items_product_id");

            migrationBuilder.RenameIndex(
                name: "IX_outgoing_shipment_stock_purchase_items_public_id",
                table: "outgoing_shipment_stock_purchase_items",
                newName: "IX_outgoing_shipment_inventory_extra_items_public_id");

            migrationBuilder.RenameTable(
                name: "outgoing_shipment_stock_purchase_items",
                newName: "outgoing_shipment_inventory_extra_items");
        }
    }
}
