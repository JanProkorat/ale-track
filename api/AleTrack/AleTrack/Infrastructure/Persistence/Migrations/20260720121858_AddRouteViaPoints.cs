using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRouteViaPoints : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "outgoing_shipment_route_points",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    latitude = table.Column<decimal>(type: "numeric", nullable: false),
                    longitude = table.Column<decimal>(type: "numeric", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_route_points", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_route_points_outgoing_shipments_outgoing_~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_route_points_outgoing_shipment_id",
                table: "outgoing_shipment_route_points",
                column: "outgoing_shipment_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_route_points");
        }
    }
}
