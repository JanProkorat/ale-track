using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Migrations
{
    /// <inheritdoc />
    public partial class Init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "breweries",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_street_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_street_number = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_city = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_zip = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    official_address_country = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    contact_address_street_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    contact_address_street_number = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    contact_address_city = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    contact_address_zip = table.Column<string>(type: "TEXT", maxLength: 10, nullable: true),
                    contact_address_country = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_breweries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "clients",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_street_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_street_number = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_city = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    official_address_zip = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    official_address_country = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    contact_address_street_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    contact_address_street_number = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    contact_address_city = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    contact_address_zip = table.Column<string>(type: "TEXT", maxLength: 10, nullable: true),
                    contact_address_country = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_clients", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "drivers",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    first_name = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    last_name = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    email = table.Column<string>(type: "TEXT", maxLength: 40, nullable: true),
                    phone_number = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_drivers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    first_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    last_name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    user_name = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    password = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "vehicles",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    max_weight = table.Column<double>(type: "REAL", nullable: false),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_vehicles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    brewery_id = table.Column<long>(type: "INTEGER", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    price = table.Column<decimal>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_products", x => x.id);
                    table.ForeignKey(
                        name: "FK_products_breweries_brewery_id",
                        column: x => x.brewery_id,
                        principalTable: "breweries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    client_id = table.Column<long>(type: "INTEGER", nullable: false),
                    state = table.Column<int>(type: "INTEGER", nullable: false),
                    delivery_date = table.Column<DateTime>(type: "TEXT", nullable: true),
                    created_date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_orders", x => x.id);
                    table.ForeignKey(
                        name: "FK_orders_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<long>(type: "INTEGER", nullable: false),
                    type = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => x.id);
                    table.ForeignKey(
                        name: "FK_user_roles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_deliveries",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    date = table.Column<DateTime>(type: "TEXT", nullable: false),
                    vehicle_id = table.Column<long>(type: "INTEGER", nullable: true),
                    state = table.Column<int>(type: "INTEGER", nullable: false),
                    brewery_id = table.Column<long>(type: "INTEGER", nullable: false),
                    note = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_product_deliveries", x => x.id);
                    table.ForeignKey(
                        name: "FK_product_deliveries_breweries_brewery_id",
                        column: x => x.brewery_id,
                        principalTable: "breweries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_product_deliveries_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    product_id = table.Column<long>(type: "INTEGER", nullable: true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    amount = table.Column<int>(type: "INTEGER", nullable: false),
                    note = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_inventory_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    order_id = table.Column<long>(type: "INTEGER", nullable: false),
                    product_id = table.Column<long>(type: "INTEGER", nullable: false),
                    amount = table.Column<int>(type: "INTEGER", nullable: false),
                    public_id = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_order_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delivery_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    delivery_id = table.Column<long>(type: "INTEGER", nullable: false),
                    product_id = table.Column<long>(type: "INTEGER", nullable: false),
                    amount = table.Column<int>(type: "INTEGER", nullable: false),
                    name = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    note = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_delivery_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_delivery_items_product_deliveries_delivery_id",
                        column: x => x.delivery_id,
                        principalTable: "product_deliveries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_delivery_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

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

            migrationBuilder.InsertData(
                table: "users",
                columns: new[] { "id", "first_name", "last_name", "password", "public_id", "user_name" },
                values: new object[] { 1L, null, null, "$2a$13$vSTwVilIMPc4b6AQEx6BAe.jKbwcLbBcUuaPZ6P.s23N36bB4MbFu", new Guid("5e58584b-76f1-4205-a5ab-9a37730db25b"), "admin" });

            migrationBuilder.InsertData(
                table: "user_roles",
                columns: new[] { "id", "type", "user_id" },
                values: new object[] { 1L, 0, 1L });

            migrationBuilder.CreateIndex(
                name: "IX_breweries_public_id",
                table: "breweries",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_clients_public_id",
                table: "clients",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_delivery_items_delivery_id",
                table: "delivery_items",
                column: "delivery_id");

            migrationBuilder.CreateIndex(
                name: "IX_delivery_items_product_id",
                table: "delivery_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_DriverProductDelivery_DriversId",
                table: "DriverProductDelivery",
                column: "DriversId");

            migrationBuilder.CreateIndex(
                name: "IX_drivers_public_id",
                table: "drivers",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_product_id",
                table: "inventory_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_public_id",
                table: "inventory_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_order_items_order_id",
                table: "order_items",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_product_id",
                table: "order_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_items_public_id",
                table: "order_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_orders_client_id",
                table: "orders",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_orders_public_id",
                table: "orders",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_deliveries_brewery_id",
                table: "product_deliveries",
                column: "brewery_id");

            migrationBuilder.CreateIndex(
                name: "IX_product_deliveries_public_id",
                table: "product_deliveries",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_product_deliveries_vehicle_id",
                table: "product_deliveries",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "IX_products_brewery_id",
                table: "products",
                column: "brewery_id");

            migrationBuilder.CreateIndex(
                name: "IX_products_public_id",
                table: "products",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_user_id",
                table: "user_roles",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_users_public_id",
                table: "users",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_user_name",
                table: "users",
                column: "user_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_vehicles_public_id",
                table: "vehicles",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "delivery_items");

            migrationBuilder.DropTable(
                name: "DriverProductDelivery");

            migrationBuilder.DropTable(
                name: "inventory_items");

            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "drivers");

            migrationBuilder.DropTable(
                name: "product_deliveries");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "vehicles");

            migrationBuilder.DropTable(
                name: "clients");

            migrationBuilder.DropTable(
                name: "breweries");
        }
    }
}
