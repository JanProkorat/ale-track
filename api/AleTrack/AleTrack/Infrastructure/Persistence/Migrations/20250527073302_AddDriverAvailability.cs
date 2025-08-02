using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverAvailability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "available_dates",
                table: "drivers");

            migrationBuilder.CreateTable(
                name: "driver_availabilities",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    driver_id = table.Column<long>(type: "INTEGER", nullable: false),
                    from = table.Column<DateTime>(type: "TEXT", nullable: false),
                    until = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_driver_availabilities", x => x.id);
                    table.ForeignKey(
                        name: "FK_driver_availabilities_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_driver_availabilities_driver_id",
                table: "driver_availabilities",
                column: "driver_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "driver_availabilities");

            migrationBuilder.AddColumn<string>(
                name: "available_dates",
                table: "drivers",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }
    }
}
