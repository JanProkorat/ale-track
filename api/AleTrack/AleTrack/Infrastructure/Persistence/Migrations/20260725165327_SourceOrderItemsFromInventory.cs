using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SourceOrderItemsFromInventory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_outgoing_shipment_client_ex~",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_outgoing_shipment_custom_ex~",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_client_extra_items");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_custom_extra_items");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_invoice_lines_client_extra_item_id",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropColumn(
                name: "client_extra_item_id",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.AddColumn<long>(
                name: "inventory_item_id",
                table: "order_items",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "quantity_from_inventory",
                table: "order_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "order_custom_extra_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    is_shipment_loading_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_custom_extra_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_custom_extra_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_order_items_inventory_item_id",
                table: "order_items",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_custom_extra_items_order_id",
                table: "order_custom_extra_items",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_custom_extra_items_public_id",
                table: "order_custom_extra_items",
                column: "public_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_order_items_inventory_items_inventory_item_id",
                table: "order_items",
                column: "inventory_item_id",
                principalTable: "inventory_items",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_order_custom_extra_items_cu~",
                table: "outgoing_shipment_invoice_lines",
                column: "custom_extra_item_id",
                principalTable: "order_custom_extra_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_order_items_inventory_items_inventory_item_id",
                table: "order_items");

            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_order_custom_extra_items_cu~",
                table: "outgoing_shipment_invoice_lines");

            migrationBuilder.DropTable(
                name: "order_custom_extra_items");

            migrationBuilder.DropIndex(
                name: "IX_order_items_inventory_item_id",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "inventory_item_id",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "quantity_from_inventory",
                table: "order_items");

            migrationBuilder.AddColumn<long>(
                name: "client_extra_item_id",
                table: "outgoing_shipment_invoice_lines",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_client_extra_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: true),
                    inventory_item_id = table.Column<long>(type: "bigint", nullable: false),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    is_shipment_loading_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_client_extra_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_client_extra_items_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_client_extra_items_inventory_items_invent~",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_client_extra_items_outgoing_shipments_out~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_custom_extra_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: true),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_shipment_loading_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_custom_extra_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_custom_extra_items_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_custom_extra_items_outgoing_shipments_out~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_lines_client_extra_item_id",
                table: "outgoing_shipment_invoice_lines",
                column: "client_extra_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_client_extra_items_client_id",
                table: "outgoing_shipment_client_extra_items",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_client_extra_items_inventory_item_id",
                table: "outgoing_shipment_client_extra_items",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_client_extra_items_outgoing_shipment_id",
                table: "outgoing_shipment_client_extra_items",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_client_extra_items_public_id",
                table: "outgoing_shipment_client_extra_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_custom_extra_items_client_id",
                table: "outgoing_shipment_custom_extra_items",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_custom_extra_items_outgoing_shipment_id",
                table: "outgoing_shipment_custom_extra_items",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_custom_extra_items_public_id",
                table: "outgoing_shipment_custom_extra_items",
                column: "public_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_outgoing_shipment_client_ex~",
                table: "outgoing_shipment_invoice_lines",
                column: "client_extra_item_id",
                principalTable: "outgoing_shipment_client_extra_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_invoice_lines_outgoing_shipment_custom_ex~",
                table: "outgoing_shipment_invoice_lines",
                column: "custom_extra_item_id",
                principalTable: "outgoing_shipment_custom_extra_items",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
