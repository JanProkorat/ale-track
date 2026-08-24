using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceBillingRecipients : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "outgoing_shipment_invoice_billing_recipients",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    invoice_id = table.Column<long>(type: "bigint", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    official_address_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    official_address_country = table.Column<int>(type: "integer", nullable: false),
                    official_address_latitude = table.Column<decimal>(type: "numeric", nullable: true),
                    official_address_longitude = table.Column<decimal>(type: "numeric", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_outgoing_shipment_invoice_billing_recipients", x => x.id);
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_billing_recipients_clients_client~",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "FK_outgoing_shipment_invoice_billing_recipients_outgoing_shipm~",
                        column: x => x.invoice_id,
                        principalTable: "outgoing_shipment_invoices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_billing_recipients_client_id",
                table: "outgoing_shipment_invoice_billing_recipients",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_billing_recipients_invoice_id_cli~",
                table: "outgoing_shipment_invoice_billing_recipients",
                columns: new[] { "invoice_id", "client_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipment_invoice_billing_recipients_public_id",
                table: "outgoing_shipment_invoice_billing_recipients",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "outgoing_shipment_invoice_billing_recipients");
        }
    }
}
