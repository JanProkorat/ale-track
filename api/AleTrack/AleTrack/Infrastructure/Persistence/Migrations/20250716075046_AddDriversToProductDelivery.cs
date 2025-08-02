using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Migrations
{
    /// <inheritdoc />
    public partial class AddDriversToProductDelivery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DriverProductDelivery");

            migrationBuilder.CreateTable(
                name: "product_delivery_drivers",
                columns: table => new
                {
                    product_delivery_id = table.Column<long>(type: "INTEGER", nullable: false),
                    driver_id = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_delivery_drivers", x => new { x.product_delivery_id, x.driver_id });
                    table.ForeignKey(
                        name: "FK_product_delivery_drivers_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_product_delivery_drivers_product_deliveries_product_delivery_id",
                        column: x => x.product_delivery_id,
                        principalTable: "product_deliveries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_product_delivery_drivers_driver_id",
                table: "product_delivery_drivers",
                column: "driver_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "product_delivery_drivers");

            migrationBuilder.CreateTable(
                name: "DriverProductDelivery",
                columns: table => new
                {
                    DeliveriesId = table.Column<long>(type: "INTEGER", nullable: false),
                    DriversId = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DriverProductDelivery", x => new { x.DeliveriesId, x.DriversId });
                    table.ForeignKey(
                        name: "FK_DriverProductDelivery_drivers_DriversId",
                        column: x => x.DriversId,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DriverProductDelivery_product_deliveries_DeliveriesId",
                        column: x => x.DeliveriesId,
                        principalTable: "product_deliveries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DriverProductDelivery_DriversId",
                table: "DriverProductDelivery",
                column: "DriversId");
        }
    }
}
