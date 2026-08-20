using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomStops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "client_order_id",
                table: "outgoing_shipment_stops",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "outgoing_shipment_stops",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "label",
                table: "outgoing_shipment_stops",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "latitude",
                table: "outgoing_shipment_stops",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "longitude",
                table: "outgoing_shipment_stops",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "note",
                table: "outgoing_shipment_stops",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "kind",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "label",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "latitude",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "note",
                table: "outgoing_shipment_stops");

            migrationBuilder.AlterColumn<long>(
                name: "client_order_id",
                table: "outgoing_shipment_stops",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
