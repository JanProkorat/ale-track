using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceConfirmations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "outgoing_shipment_invoice_confirmations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    outgoing_shipment_id = table.Column<long>(type: "bigint", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    number = table.Column<int>(type: "integer", nullable: false),
                    is_ready = table.Column<bool>(type: "boolean", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_invoice_confirmations", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_confirmations_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_confirmations_outgoing_shipments_~",
                        column: x => x.outgoing_shipment_id,
                        principalTable: "outgoing_shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_confirmations_client_id",
                table: "outgoing_shipment_invoice_confirmations",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_confirmations_outgoing_shipment_~1",
                table: "outgoing_shipment_invoice_confirmations",
                columns: new[] { "outgoing_shipment_id", "number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_confirmations_outgoing_shipment_i~",
                table: "outgoing_shipment_invoice_confirmations",
                columns: new[] { "outgoing_shipment_id", "client_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_confirmations_public_id",
                table: "outgoing_shipment_invoice_confirmations",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_invoice_confirmations");
        }
    }
}
