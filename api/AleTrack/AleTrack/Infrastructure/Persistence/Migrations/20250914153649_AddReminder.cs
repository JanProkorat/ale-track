using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReminder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reminders",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    OccurrenceDate = table.Column<DateOnly>(type: "date", nullable: true),
                    NumberOfDaysToRemindBefore = table.Column<int>(type: "integer", nullable: false),
                    RecurrenceType = table.Column<int>(type: "integer", nullable: true),
                    DaysOfWeek = table.Column<string>(type: "text", nullable: true),
                    DaysOfMonth = table.Column<string>(type: "text", nullable: true),
                    ActiveUntil = table.Column<DateOnly>(type: "date", nullable: true),
                    ResolvedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    BreweryId = table.Column<long>(type: "bigint", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reminders", x => x.id);
                    table.ForeignKey(
                        name: "FK_reminders_breweries_BreweryId",
                        column: x => x.BreweryId,
                        principalTable: "breweries",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_reminders_BreweryId",
                table: "reminders",
                column: "BreweryId");

            migrationBuilder.CreateIndex(
                name: "IX_reminders_public_id",
                table: "reminders",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reminders");
        }
    }
}
