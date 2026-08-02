using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOutgoingShipmentCreatedDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "created_date",
                table: "outgoing_shipments",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            // Shipments predating this column have no recorded creation time. The
            // identity PK is assigned in insertion order, so spacing existing rows one
            // second apart backwards from now reproduces their true creation *order*
            // (the absolute timestamps are synthetic).
            migrationBuilder.Sql(
                """
                UPDATE outgoing_shipments s
                SET created_date = now() - (((SELECT MAX(id) FROM outgoing_shipments) - s.id) * INTERVAL '1 second');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "created_date",
                table: "outgoing_shipments");
        }
    }
}
