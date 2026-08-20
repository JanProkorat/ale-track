using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClientDeliveryPlaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "client_delivery_place_id",
                table: "outgoing_shipment_stops",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "client_delivery_places",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    country = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    latitude = table.Column<decimal>(type: "numeric", nullable: false),
                    longitude = table.Column<decimal>(type: "numeric", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_delivery_places", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_delivery_places_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_stops_client_delivery_place_id",
                table: "outgoing_shipment_stops",
                column: "client_delivery_place_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_delivery_places_client_id",
                table: "client_delivery_places",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_delivery_places_public_id",
                table: "client_delivery_places",
                column: "public_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipment_stops_client_delivery_places_client_deliv~",
                table: "outgoing_shipment_stops",
                column: "client_delivery_place_id",
                principalTable: "client_delivery_places",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipment_stops_client_delivery_places_client_deliv~",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropTable(
                name: "client_delivery_places");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipment_stops_client_delivery_place_id",
                table: "outgoing_shipment_stops");

            migrationBuilder.DropColumn(
                name: "client_delivery_place_id",
                table: "outgoing_shipment_stops");
        }
    }
}
