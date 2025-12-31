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
                name: "latitude",
                table: "clients",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "longitude",
                table: "clients",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "latitude",
                table: "breweries",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "longitude",
                table: "breweries",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "latitude",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "latitude",
                table: "breweries");

            migrationBuilder.DropColumn(
                name: "longitude",
                table: "breweries");
        }
    }
}
