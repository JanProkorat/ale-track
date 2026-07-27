using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderDeliveryAddress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "address_changed_at",
                table: "outgoing_shipment_stops",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_address_overridden",
                table: "outgoing_shipment_stops",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "client_delivery_place_id",
                table: "orders",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "delivery_address_kind",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_orders_client_delivery_place_id",
                table: "orders",
                column: "client_delivery_place_id");

            migrationBuilder.AddForeignKey(
                name: "FK_orders_client_delivery_places_client_delivery_place_id",
                table: "orders",
                column: "client_delivery_place_id",
                principalTable: "client_delivery_places",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // A stop the planner deliberately moved off the default predates
            // this feature and must count as an override, so the first order
            // edit after this ships cannot silently relocate a delivery that
            // someone already decided on.
            migrationBuilder.Sql("""
                UPDATE outgoing_shipment_stops
                SET is_address_overridden = true
                WHERE selected_address_kind <> 0 OR client_delivery_place_id IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_client_delivery_places_client_delivery_place_id",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_client_delivery_place_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "address_changed_at",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "is_address_overridden",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "client_delivery_place_id",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "delivery_address_kind",
                table: "orders");
        }
    }
}
