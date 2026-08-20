using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierGoodPickupSourceAndSupplierStops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "pickup_source",
                table: "supplier_goods",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "supplier_id",
                table: "outgoing_shipment_stops",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stops_supplier_id",
                table: "outgoing_shipment_stops",
                column: "supplier_id");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_stops_suppliers_supplier_id",
                table: "outgoing_shipment_stops",
                column: "supplier_id",
                principalTable: "suppliers",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_stops_suppliers_supplier_id",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_stops_supplier_id",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "pickup_source",
                table: "supplier_goods");

            migrationBuilder.DropColumn(
                name: "supplier_id",
                table: "outgoing_shipment_stops");
        }
    }
}
