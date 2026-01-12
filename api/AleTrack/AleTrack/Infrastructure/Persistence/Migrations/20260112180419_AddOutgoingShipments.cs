using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOutgoingShipments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "outgoing_shipment_stop_id",
                table: "orders",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "outgoing_shipments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    delivery_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    vehicle_id = table.Column<long>(type: "bigint", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    state = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipments", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipments_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_drivers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    driver_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_drivers", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_drivers_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_drivers_outgoing_shipments_outgoing_shipm~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "outgoing_shipment_stops",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    client_order_id = table.Column<long>(type: "bigint", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_stops", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_stops_outgoing_shipments_outgoing_shipmen~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_orders_outgoing_shipment_stop_id",
                table: "orders",
                column: "outgoing_shipment_stop_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_drivers_driver_id",
                table: "outgoing_shipment_drivers",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_drivers_outgoing_shipment_id",
                table: "outgoing_shipment_drivers",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stops_outgoing_shipment_id",
                table: "outgoing_shipment_stops",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stops_public_id",
                table: "outgoing_shipment_stops",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipments_public_id",
                table: "outgoing_shipments",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipments_vehicle_id",
                table: "outgoing_shipments",
                column: "vehicle_id");

            migrationBuilder.AddForeignKey(
                name: "FK_orders_outgoing_shipment_stops_outgoing_shipment_stop_id",
                table: "orders",
                column: "outgoing_shipment_stop_id",
                principalTable: "outgoing_shipment_stops",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_outgoing_shipment_stops_outgoing_shipment_stop_id",
                table: "orders");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_drivers");

            migrationBuilder.DropTable(
                name: "outgoing_shipment_stops");

            migrationBuilder.DropTable(
                name: "outgoing_shipments");

            migrationBuilder.DropIndex(
                name: "IX_orders_outgoing_shipment_stop_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "outgoing_shipment_stop_id",
                table: "orders");
        }
    }
}
