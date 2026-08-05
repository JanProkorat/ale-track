using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOutgoingShipmentStartPoint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "start_brewery_address_kind",
                table: "outgoing_shipments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "start_brewery_id",
                table: "outgoing_shipments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "start_point_kind",
                table: "outgoing_shipments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipments_start_brewery_id",
                table: "outgoing_shipments",
                column: "start_brewery_id");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipments_breweries_start_brewery_id",
                table: "outgoing_shipments",
                column: "start_brewery_id",
                principalTable: "breweries",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipments_breweries_start_brewery_id",
                table: "outgoing_shipments");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipments_start_brewery_id",
                table: "outgoing_shipments");

            migrationBuilder.DropColumn(
                name: "start_brewery_address_kind",
                table: "outgoing_shipments");

            migrationBuilder.DropColumn(
                name: "start_brewery_id",
                table: "outgoing_shipments");

            migrationBuilder.DropColumn(
                name: "start_point_kind",
                table: "outgoing_shipments");
        }
    }
}
