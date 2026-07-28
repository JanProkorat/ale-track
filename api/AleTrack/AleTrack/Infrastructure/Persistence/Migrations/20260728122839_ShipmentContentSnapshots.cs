using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShipmentContentSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "client_order_id",
                table: "outgoing_shipment_stops");

            migrationBuilder.AddColumn<string>(
                name: "client_name",
                table: "outgoing_shipment_stops",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "client_public_id",
                table: "outgoing_shipment_stops",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "client_region",
                table: "outgoing_shipment_stops",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_stop_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    stop_id = table.Column<long>(type: "bigint", nullable: false),
                    order_item_id = table.Column<long>(type: "bigint", nullable: true),
                    product_id = table.Column<long>(type: "bigint", nullable: true),
                    product_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    package_size = table.Column<double>(type: "double precision", nullable: true),
                    units_per_package = table.Column<int>(type: "integer", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price_with_vat = table.Column<decimal>(type: "numeric", nullable: false),
                    unit_price_without_vat = table.Column<decimal>(type: "numeric", nullable: true),
                    brewery_public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    brewery_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_stop_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_stop_items_order_items_order_item_id",
                        column: x => x.order_item_id,
                        principalTable: "order_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_stop_items_outgoing_shipment_stops_stop_id",
                        column: x => x.stop_id,
                        principalTable: "outgoing_shipment_stops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_stop_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stop_items_order_item_id",
                table: "outgoing_shipment_stop_items",
                column: "order_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stop_items_product_id",
                table: "outgoing_shipment_stop_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stop_items_public_id",
                table: "outgoing_shipment_stop_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stop_items_stop_id",
                table: "outgoing_shipment_stop_items",
                column: "stop_id");

            // Backfill. The snapshot columns are populated from the values live right now, which
            // is the most the existing data can support: pre-migration history therefore reflects
            // product and client values as of this migration, not as of the delivery. That limit
            // is stated here rather than hidden behind a read-time fallback — the read paths
            // deliberately have none, so a snapshot-writer bug stays distinguishable from
            // genuinely old data.
            //
            // Only runs for shipments past Created (Loaded 1, InTransit 2, Delivered 3,
            // Cancelled 4); a run still being planned gets its snapshot when it is loaded.
            migrationBuilder.Sql("""
                INSERT INTO outgoing_shipment_stop_items
                    (public_id, stop_id, order_item_id, product_id, product_name, kind, type,
                     package_size, units_per_package, quantity,
                     unit_price_with_vat, unit_price_without_vat,
                     brewery_public_id, brewery_name)
                SELECT gen_random_uuid(), s.id, oi.id, p.id, p.name, p.kind, p.type,
                       p.package_size, p.units_per_package, oi.quantity,
                       p.price_with_vat, p.price_without_vat,
                       b.public_id, b.name
                FROM outgoing_shipment_stops s
                JOIN outgoing_shipments sh ON sh.id = s.outgoing_shipment_id
                JOIN orders o ON o.outgoing_shipment_stop_id = s.id
                JOIN order_items oi ON oi.order_id = o.id
                JOIN products p ON p.id = oi.product_id
                JOIN breweries b ON b.id = p.brewery_id
                WHERE s.kind = 0 AND sh.state IN (1, 2, 3, 4);
                """);

            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_stops s
                SET client_public_id = c.public_id,
                    client_name = c.name,
                    client_region = c.region
                FROM orders o
                JOIN clients c ON c.id = o.client_id
                JOIN outgoing_shipments sh ON sh.id = s.outgoing_shipment_id
                WHERE o.outgoing_shipment_stop_id = s.id
                  AND s.kind = 0
                  AND sh.state IN (1, 2, 3, 4);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_stop_items");

            migrationBuilder.DropColumn(
                name: "client_name",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "client_public_id",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "client_region",
                table: "outgoing_shipment_stops");

            migrationBuilder.AddColumn<long>(
                name: "client_order_id",
                table: "outgoing_shipment_stops",
                type: "bigint",
                nullable: true);
        }
    }
}
