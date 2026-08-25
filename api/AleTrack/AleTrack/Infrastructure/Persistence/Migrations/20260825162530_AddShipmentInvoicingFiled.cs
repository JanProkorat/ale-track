using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShipmentInvoicingFiled : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "invoicing_filed_at",
                table: "outgoing_shipments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "invoicing_filed_by_user_id",
                table: "outgoing_shipments",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_outgoing_shipments_invoicing_filed_by_user_id",
                table: "outgoing_shipments",
                column: "invoicing_filed_by_user_id");

            migrationBuilder.AddForeignKey(
                name: "FK_outgoing_shipments_users_invoicing_filed_by_user_id",
                table: "outgoing_shipments",
                column: "invoicing_filed_by_user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_outgoing_shipments_users_invoicing_filed_by_user_id",
                table: "outgoing_shipments");

            migrationBuilder.DropIndex(
                name: "IX_outgoing_shipments_invoicing_filed_by_user_id",
                table: "outgoing_shipments");

            migrationBuilder.DropColumn(
                name: "invoicing_filed_at",
                table: "outgoing_shipments");

            migrationBuilder.DropColumn(
                name: "invoicing_filed_by_user_id",
                table: "outgoing_shipments");
        }
    }
}
