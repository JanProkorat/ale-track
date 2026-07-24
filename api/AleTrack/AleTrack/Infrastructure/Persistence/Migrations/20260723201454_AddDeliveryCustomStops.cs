using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliveryCustomStops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "brewery_id",
                table: "delivery_stops",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "delivery_stops",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "label",
                table: "delivery_stops",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "latitude",
                table: "delivery_stops",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "longitude",
                table: "delivery_stops",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "order",
                table: "delivery_stops",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "kind",
                table: "delivery_stops");

            migrationBuilder.DropColumn(
                name: "label",
                table: "delivery_stops");

            migrationBuilder.DropColumn(
                name: "latitude",
                table: "delivery_stops");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "delivery_stops");

            migrationBuilder.DropColumn(
                name: "order",
                table: "delivery_stops");

            migrationBuilder.AlterColumn<long>(
                name: "brewery_id",
                table: "delivery_stops",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
