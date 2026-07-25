using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShipmentInvoices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_inventory_extra_items");

            migrationBuilder.DropColumn(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_inventory_extra_items");

            migrationBuilder.DropColumn(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_custom_extra_items");

            migrationBuilder.DropColumn(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_custom_extra_items");

            migrationBuilder.DropColumn(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_client_extra_items");

            migrationBuilder.DropColumn(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_client_extra_items");

            migrationBuilder.DropColumn(
                name: "first_invoice_quantity",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "second_invoice_quantity",
                table: "order_items");

            migrationBuilder.AddColumn<long>(
                name: "client_id",
                table: "outgoing_shipment_custom_extra_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "client_id",
                table: "outgoing_shipment_client_extra_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_invoices",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_invoices", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoices_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoices_outgoing_shipments_outgoing_ship~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_invoice_lines",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    invoice_id = table.Column<long>(type: "bigint", nullable: false),
                    source_kind = table.Column<int>(type: "integer", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    order_item_id = table.Column<long>(type: "bigint", nullable: true),
                    client_extra_item_id = table.Column<long>(type: "bigint", nullable: true),
                    custom_extra_item_id = table.Column<long>(type: "bigint", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_invoice_lines", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_lines_order_items_order_item_id",
                        column: x => x.order_item_id,
                        principalTable: "order_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_lines_outgoing_shipment_client_ex~",
                        column: x => x.client_extra_item_id,
                        principalTable: "outgoing_shipment_client_extra_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_lines_outgoing_shipment_custom_ex~",
                        column: x => x.custom_extra_item_id,
                        principalTable: "outgoing_shipment_custom_extra_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_lines_outgoing_shipment_invoices_~",
                        column: x => x.invoice_id,
                        principalTable: "outgoing_shipment_invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_custom_extra_items_client_id",
                table: "outgoing_shipment_custom_extra_items",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_client_extra_items_client_id",
                table: "outgoing_shipment_client_extra_items",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_client_extra_item_id",
                table: "outgoing_shipment_invoice_lines",
                column: "client_extra_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_custom_extra_item_id",
                table: "outgoing_shipment_invoice_lines",
                column: "custom_extra_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_invoice_id",
                table: "outgoing_shipment_invoice_lines",
                column: "invoice_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_order_item_id",
                table: "outgoing_shipment_invoice_lines",
                column: "order_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_public_id",
                table: "outgoing_shipment_invoice_lines",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoices_client_id",
                table: "outgoing_shipment_invoices",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoices_outgoing_shipment_id_client_id_s~",
                table: "outgoing_shipment_invoices",
                columns: new[] { "outgoing_shipment_id", "client_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoices_public_id",
                table: "outgoing_shipment_invoices",
                column: "public_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_client_extra_items_clients_client_id",
                table: "outgoing_shipment_client_extra_items",
                column: "client_id",
                principalTable: "clients",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_custom_extra_items_clients_client_id",
                table: "outgoing_shipment_custom_extra_items",
                column: "client_id",
                principalTable: "clients",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_client_extra_items_clients_client_id",
                table: "outgoing_shipment_client_extra_items");

            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_custom_extra_items_clients_client_id",
                table: "outgoing_shipment_custom_extra_items");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_invoices");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_custom_extra_items_client_id",
                table: "outgoing_shipment_custom_extra_items");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_client_extra_items_client_id",
                table: "outgoing_shipment_client_extra_items");

            migrationBuilder.DropColumn(
                name: "client_id",
                table: "outgoing_shipment_custom_extra_items");

            migrationBuilder.DropColumn(
                name: "client_id",
                table: "outgoing_shipment_client_extra_items");

            migrationBuilder.AddColumn<int>(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_inventory_extra_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_inventory_extra_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_custom_extra_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_custom_extra_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "first_invoice_quantity",
                table: "outgoing_shipment_client_extra_items",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "second_invoice_quantity",
                table: "outgoing_shipment_client_extra_items",
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
        }
    }
}
