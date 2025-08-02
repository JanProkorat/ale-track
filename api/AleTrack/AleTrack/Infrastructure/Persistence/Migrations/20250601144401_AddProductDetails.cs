using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Migrations
{
    /// <inheritdoc />
    public partial class AddProductDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "price",
                table: "products",
                newName: "price_with_vat");

            migrationBuilder.AddColumn<float>(
                name: "alcohol_percentage",
                table: "products",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "products",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<double>(
                name: "package_size",
                table: "products",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "plato_degree",
                table: "products",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "price_for_unit_with_vat",
                table: "products",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "price_for_unit_without_vat",
                table: "products",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "type",
                table: "products",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "alcohol_percentage",
                table: "products");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "products");

            migrationBuilder.DropColumn(
                name: "package_size",
                table: "products");

            migrationBuilder.DropColumn(
                name: "plato_degree",
                table: "products");

            migrationBuilder.DropColumn(
                name: "price_for_unit_with_vat",
                table: "products");

            migrationBuilder.DropColumn(
                name: "price_for_unit_without_vat",
                table: "products");

            migrationBuilder.DropColumn(
                name: "type",
                table: "products");

            migrationBuilder.RenameColumn(
                name: "price_with_vat",
                table: "products",
                newName: "price");
        }
    }
}
