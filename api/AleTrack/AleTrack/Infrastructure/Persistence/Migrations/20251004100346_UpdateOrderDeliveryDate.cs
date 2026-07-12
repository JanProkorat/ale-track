using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateOrderDeliveryDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "delivery_date",
                table: "orders",
                newName: "required_delivery_date");

            migrationBuilder.AddColumn<DateOnly>(
                name: "actual_delivery_date",
                table: "orders",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "actual_delivery_date",
                table: "orders");

            migrationBuilder.RenameColumn(
                name: "required_delivery_date",
                table: "orders",
                newName: "delivery_date");
        }
    }
}
