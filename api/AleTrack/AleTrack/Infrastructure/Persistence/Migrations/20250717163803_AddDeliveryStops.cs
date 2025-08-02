using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Migrations
{
    /// <inheritdoc />
    public partial class AddDeliveryStops : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_delivery_items_product_deliveries_delivery_id",
                table: "delivery_items");

            migrationBuilder.DropForeignKey(
                name: "FK_product_deliveries_breweries_brewery_id",
                table: "product_deliveries");

            migrationBuilder.DropIndex(
                name: "IX_product_deliveries_brewery_id",
                table: "product_deliveries");

            migrationBuilder.DropColumn(
                name: "brewery_id",
                table: "product_deliveries");

            migrationBuilder.DropColumn(
                name: "name",
                table: "delivery_items");

            migrationBuilder.RenameColumn(
                name: "delivery_id",
                table: "delivery_items",
                newName: "delivery_stop_id");

            migrationBuilder.RenameIndex(
                name: "IX_delivery_items_delivery_id",
                table: "delivery_items",
                newName: "IX_delivery_items_delivery_stop_id");

            migrationBuilder.CreateTable(
                name: "delivery_stops",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    delivery_id = table.Column<long>(type: "INTEGER", nullable: false),
                    brewery_id = table.Column<long>(type: "INTEGER", nullable: false),
                    note = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_stops", x => x.id);
                    table.ForeignKey(
                        name: "FK_delivery_stops_breweries_brewery_id",
                        column: x => x.brewery_id,
                        principalTable: "breweries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_delivery_stops_product_deliveries_delivery_id",
                        column: x => x.delivery_id,
                        principalTable: "product_deliveries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_delivery_stops_brewery_id",
                table: "delivery_stops",
                column: "brewery_id");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_stops_delivery_id",
                table: "delivery_stops",
                column: "delivery_id");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_stops_public_id",
                table: "delivery_stops",
                column: "public_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_delivery_items_delivery_stops_delivery_stop_id",
                table: "delivery_items",
                column: "delivery_stop_id",
                principalTable: "delivery_stops",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_delivery_items_delivery_stops_delivery_stop_id",
                table: "delivery_items");

            migrationBuilder.DropTable(
                name: "delivery_stops");

            migrationBuilder.RenameColumn(
                name: "delivery_stop_id",
                table: "delivery_items",
                newName: "delivery_id");

            migrationBuilder.RenameIndex(
                name: "IX_delivery_items_delivery_stop_id",
                table: "delivery_items",
                newName: "IX_delivery_items_delivery_id");

            migrationBuilder.AddColumn<long>(
                name: "brewery_id",
                table: "product_deliveries",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "name",
                table: "delivery_items",
                type: "TEXT",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_deliveries_brewery_id",
                table: "product_deliveries",
                column: "brewery_id");

            migrationBuilder.AddForeignKey(
                name: "FK_delivery_items_product_deliveries_delivery_id",
                table: "delivery_items",
                column: "delivery_id",
                principalTable: "product_deliveries",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_product_deliveries_breweries_brewery_id",
                table: "product_deliveries",
                column: "brewery_id",
                principalTable: "breweries",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
