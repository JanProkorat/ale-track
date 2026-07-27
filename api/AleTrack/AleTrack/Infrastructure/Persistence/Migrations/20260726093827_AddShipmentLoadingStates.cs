using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShipmentLoadingStates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "outgoing_shipment_loading_states",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    state = table.Column<int>(type: "integer", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_loading_states", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_loading_states_outgoing_shipments_outgoin~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_loading_states_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_loading_states_outgoing_shipment_id_produ~",
                table: "outgoing_shipment_loading_states",
                columns: new[] { "outgoing_shipment_id", "product_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_loading_states_product_id",
                table: "outgoing_shipment_loading_states",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_loading_states_public_id",
                table: "outgoing_shipment_loading_states",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_loading_states");
        }
    }
}
