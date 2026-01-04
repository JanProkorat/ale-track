using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGeoLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "contact_address_latitude",
                table: "clients",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "contact_address_longitude",
                table: "clients",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "official_address_latitude",
                table: "clients",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "official_address_longitude",
                table: "clients",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "contact_address_latitude",
                table: "breweries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "contact_address_longitude",
                table: "breweries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "official_address_latitude",
                table: "breweries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "official_address_longitude",
                table: "breweries",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "contact_address_latitude",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "contact_address_longitude",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "official_address_latitude",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "official_address_longitude",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "contact_address_latitude",
                table: "breweries");

            migrationBuilder.DropColumn(
                name: "contact_address_longitude",
                table: "breweries");

            migrationBuilder.DropColumn(
                name: "official_address_latitude",
                table: "breweries");

            migrationBuilder.DropColumn(
                name: "official_address_longitude",
                table: "breweries");
        }
    }
}
