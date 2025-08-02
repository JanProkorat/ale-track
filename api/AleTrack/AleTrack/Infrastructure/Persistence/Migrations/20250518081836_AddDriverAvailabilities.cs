using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverAvailabilities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "email",
                table: "drivers");

            migrationBuilder.AddColumn<string>(
                name: "available_dates",
                table: "drivers",
                type: "TEXT",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "available_dates",
                table: "drivers");

            migrationBuilder.AddColumn<string>(
                name: "email",
                table: "drivers",
                type: "TEXT",
                maxLength: 40,
                nullable: true);
        }
    }
}
