using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Migrations
{
    /// <inheritdoc />
    public partial class RenameAmountToQuantity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "amount",
                table: "order_items",
                newName: "quantity");

            migrationBuilder.RenameColumn(
                name: "amount",
                table: "inventory_items",
                newName: "quantity");

            migrationBuilder.RenameColumn(
                name: "amount",
                table: "delivery_items",
                newName: "quantity");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "quantity",
                table: "order_items",
                newName: "amount");

            migrationBuilder.RenameColumn(
                name: "quantity",
                table: "inventory_items",
                newName: "amount");

            migrationBuilder.RenameColumn(
                name: "quantity",
                table: "delivery_items",
                newName: "amount");
        }
    }
}
