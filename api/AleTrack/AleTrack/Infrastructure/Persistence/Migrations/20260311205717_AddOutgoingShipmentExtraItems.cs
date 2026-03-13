using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOutgoingShipmentExtraItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_extra_items");

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_client_extra_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    inventory_item_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    is_shipment_loading_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    first_invoice_quantity = table.Column<int>(type: "integer", nullable: true),
                    second_invoice_quantity = table.Column<int>(type: "integer", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_client_extra_items", x => x.id);
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
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    is_shipment_loading_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    first_invoice_quantity = table.Column<int>(type: "integer", nullable: true),
                    second_invoice_quantity = table.Column<int>(type: "integer", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_custom_extra_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_custom_extra_items_outgoing_shipments_out~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_inventory_extra_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    is_shipment_loading_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    first_invoice_quantity = table.Column<int>(type: "integer", nullable: true),
                    second_invoice_quantity = table.Column<int>(type: "integer", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_inventory_extra_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_inventory_extra_items_outgoing_shipments_~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_inventory_extra_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

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
                name: "IX_outgoing_shipment_custom_extra_items_outgoing_shipment_id",
                table: "outgoing_shipment_custom_extra_items",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_custom_extra_items_public_id",
                table: "outgoing_shipment_custom_extra_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_inventory_extra_items_outgoing_shipment_id",
                table: "outgoing_shipment_inventory_extra_items",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_inventory_extra_items_product_id",
                table: "outgoing_shipment_inventory_extra_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_inventory_extra_items_public_id",
                table: "outgoing_shipment_inventory_extra_items",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_client_extra_items");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_custom_extra_items");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_inventory_extra_items");

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_extra_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    inventory_item_id = table.Column<long>(type: "bigint", nullable: true),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: true),
                    first_invoice_quantity = table.Column<int>(type: "integer", nullable: true),
                    is_shipment_loading_confirmed = table.Column<bool>(type: "boolean", nullable: false),
                    product_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    second_invoice_quantity = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_extra_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_extra_items_inventory_items_inventory_ite~",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_extra_items_outgoing_shipments_outgoing_s~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_extra_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_extra_items_inventory_item_id",
                table: "outgoing_shipment_extra_items",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_extra_items_outgoing_shipment_id",
                table: "outgoing_shipment_extra_items",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_extra_items_product_id",
                table: "outgoing_shipment_extra_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_extra_items_public_id",
                table: "outgoing_shipment_extra_items",
                column: "public_id",
                unique: true);
        }
    }
}
