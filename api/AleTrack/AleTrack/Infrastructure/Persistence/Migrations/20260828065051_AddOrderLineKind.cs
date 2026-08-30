using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderLineKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "line_kind",
                table: "outgoing_shipment_stop_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "line_kind",
                table: "order_supplier_good_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "line_kind",
                table: "order_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "line_kind",
                table: "outgoing_shipment_stop_items");

            migrationBuilder.DropColumn(
                name: "line_kind",
                table: "order_supplier_good_items");

            migrationBuilder.DropColumn(
                name: "line_kind",
                table: "order_items");
        }
    }
}
