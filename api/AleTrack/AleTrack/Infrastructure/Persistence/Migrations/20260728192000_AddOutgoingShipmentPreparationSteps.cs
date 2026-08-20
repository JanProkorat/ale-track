using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOutgoingShipmentPreparationSteps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "outgoing_shipment_preparation_steps",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    order = table.Column<int>(type: "integer", nullable: false),
                    label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    is_done = table.Column<bool>(type: "boolean", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_preparation_steps", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_preparation_steps_outgoing_shipments_outg~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_preparation_steps_outgoing_shipment_id",
                table: "outgoing_shipment_preparation_steps",
                column: "outgoing_shipment_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_preparation_steps_public_id",
                table: "outgoing_shipment_preparation_steps",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_preparation_steps");
        }
    }
}
