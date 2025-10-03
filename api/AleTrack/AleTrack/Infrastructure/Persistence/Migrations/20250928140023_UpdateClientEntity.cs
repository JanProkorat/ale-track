using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateClientEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_clients_client_id",
                table: "orders");

            migrationBuilder.DropTable(
                name: "reminders");

            migrationBuilder.AddColumn<string>(
                name: "business_name",
                table: "clients",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_deleted",
                table: "clients",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "region",
                table: "clients",
                type: "integer",
                nullable: false,
                defaultValue: 8);

            migrationBuilder.CreateTable(
                name: "brewery_reminders",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    brewery_id = table.Column<long>(type: "bigint", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    OccurrenceDate = table.Column<DateOnly>(type: "date", nullable: true),
                    NumberOfDaysToRemindBefore = table.Column<int>(type: "integer", nullable: false),
                    RecurrenceType = table.Column<int>(type: "integer", nullable: true),
                    DaysOfWeek = table.Column<string>(type: "text", nullable: true),
                    DaysOfMonth = table.Column<string>(type: "text", nullable: true),
                    ActiveUntil = table.Column<DateOnly>(type: "date", nullable: true),
                    ResolvedDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_brewery_reminders", x => x.id);
                    table.ForeignKey(
                        name: "FK_brewery_reminders_breweries_brewery_id",
                        column: x => x.brewery_id,
                        principalTable: "breweries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_contacts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    value = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_contacts", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_contacts_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_notes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    Text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_notes", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_notes_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "client_reminders",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    OccurrenceDate = table.Column<DateOnly>(type: "date", nullable: true),
                    NumberOfDaysToRemindBefore = table.Column<int>(type: "integer", nullable: false),
                    RecurrenceType = table.Column<int>(type: "integer", nullable: true),
                    DaysOfWeek = table.Column<string>(type: "text", nullable: true),
                    DaysOfMonth = table.Column<string>(type: "text", nullable: true),
                    ActiveUntil = table.Column<DateOnly>(type: "date", nullable: true),
                    ResolvedDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_reminders", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_reminders_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_brewery_reminders_brewery_id",
                table: "brewery_reminders",
                column: "brewery_id");

            migrationBuilder.CreateIndex(
                name: "IX_brewery_reminders_public_id",
                table: "brewery_reminders",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_client_contacts_client_id",
                table: "client_contacts",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_notes_client_id",
                table: "client_notes",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_notes_public_id",
                table: "client_notes",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_client_reminders_client_id",
                table: "client_reminders",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_reminders_public_id",
                table: "client_reminders",
                column: "public_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_clients_client_id",
                table: "orders",
                column: "client_id",
                principalTable: "clients",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_orders_clients_client_id",
                table: "orders");

            migrationBuilder.DropTable(
                name: "brewery_reminders");

            migrationBuilder.DropTable(
                name: "client_contacts");

            migrationBuilder.DropTable(
                name: "client_notes");

            migrationBuilder.DropTable(
                name: "client_reminders");

            migrationBuilder.DropColumn(
                name: "business_name",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "is_deleted",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "region",
                table: "clients");

            migrationBuilder.CreateTable(
                name: "reminders",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BreweryId = table.Column<long>(type: "bigint", nullable: false),
                    ActiveUntil = table.Column<DateOnly>(type: "date", nullable: true),
                    DaysOfMonth = table.Column<string>(type: "text", nullable: true),
                    DaysOfWeek = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NumberOfDaysToRemindBefore = table.Column<int>(type: "integer", nullable: false),
                    OccurrenceDate = table.Column<DateOnly>(type: "date", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    RecurrenceType = table.Column<int>(type: "integer", nullable: true),
                    ResolvedDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false)
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

            migrationBuilder.AddForeignKey(
                name: "FK_orders_clients_client_id",
                table: "orders",
                column: "client_id",
                principalTable: "clients",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
