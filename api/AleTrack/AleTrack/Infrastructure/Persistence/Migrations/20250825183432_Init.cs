using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
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
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    official_address_country = table.Column<int>(type: "integer", nullable: false),
                    contact_address_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    contact_address_country = table.Column<int>(type: "integer", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_breweries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "clients",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    official_address_country = table.Column<int>(type: "integer", nullable: false),
                    contact_address_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    contact_address_country = table.Column<int>(type: "integer", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_clients", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "drivers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    first_name = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    last_name = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    phone_number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    color = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drivers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    first_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    last_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    user_name = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    password = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "vehicles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    max_weight = table.Column<double>(type: "double precision", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vehicles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    brewery_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    alcohol_percentage = table.Column<float>(type: "real", nullable: true),
                    plato_degree = table.Column<float>(type: "real", nullable: true),
                    package_size = table.Column<double>(type: "double precision", nullable: true),
                    price_with_vat = table.Column<decimal>(type: "numeric", nullable: false),
                    price_for_unit_with_vat = table.Column<decimal>(type: "numeric", nullable: false),
                    price_for_unit_without_vat = table.Column<decimal>(type: "numeric", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_products", x => x.id);
                    table.ForeignKey(
                        name: "fk_products_breweries_brewery_id",
                        column: x => x.brewery_id,
                        principalTable: "breweries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    state = table.Column<int>(type: "integer", nullable: false),
                    delivery_date = table.Column<DateOnly>(type: "date", nullable: true),
                    created_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_orders", x => x.id);
                    table.ForeignKey(
                        name: "fk_orders_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "driver_availabilities",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    driver_id = table.Column<long>(type: "bigint", nullable: false),
                    from = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    until = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_driver_availabilities", x => x.id);
                    table.ForeignKey(
                        name: "fk_driver_availabilities_drivers_driver_id",
                        column: x => x.driver_id,
                        principalTable: "drivers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_roles", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_roles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_deliveries",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    vehicle_id = table.Column<long>(type: "bigint", nullable: true),
                    state = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_deliveries", x => x.id);
                    table.ForeignKey(
                        name: "fk_product_deliveries_vehicles_vehicle_id",
                        column: x => x.vehicle_id,
                        principalTable: "vehicles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<long>(type: "bigint", nullable: true),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_inventory_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_inventory_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_order_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "delivery_stops",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    delivery_id = table.Column<long>(type: "bigint", nullable: false),
                    brewery_id = table.Column<long>(type: "bigint", nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_delivery_stops", x => x.id);
                    table.ForeignKey(
                        name: "fk_delivery_stops_breweries_brewery_id",
                        column: x => x.brewery_id,
                        principalTable: "breweries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_delivery_stops_product_deliveries_delivery_id",
                        column: x => x.delivery_id,
                        principalTable: "product_deliveries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_delivery_drivers",
                columns: table => new
                {
                    product_delivery_id = table.Column<long>(type: "bigint", nullable: false),
                    driver_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_delivery_drivers", x => new { x.product_delivery_id, x.driver_id });
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

            migrationBuilder.CreateTable(
                name: "delivery_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    delivery_stop_id = table.Column<long>(type: "bigint", nullable: false),
                    product_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_delivery_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_delivery_items_delivery_stops_delivery_stop_id",
                        column: x => x.delivery_stop_id,
                        principalTable: "delivery_stops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_delivery_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
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
                name: "ix_breweries_public_id",
                table: "breweries",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_clients_public_id",
                table: "clients",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_delivery_items_delivery_stop_id",
                table: "delivery_items",
                column: "delivery_stop_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_items_product_id",
                table: "delivery_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_stops_brewery_id",
                table: "delivery_stops",
                column: "brewery_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_stops_delivery_id",
                table: "delivery_stops",
                column: "delivery_id");

            migrationBuilder.CreateIndex(
                name: "ix_delivery_stops_public_id",
                table: "delivery_stops",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_driver_availabilities_driver_id",
                table: "driver_availabilities",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_drivers_public_id",
                table: "drivers",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_inventory_items_product_id",
                table: "inventory_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_inventory_items_public_id",
                table: "inventory_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_order_items_order_id",
                table: "order_items",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_product_id",
                table: "order_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_public_id",
                table: "order_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_orders_client_id",
                table: "orders",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_public_id",
                table: "orders",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_deliveries_public_id",
                table: "product_deliveries",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_product_deliveries_vehicle_id",
                table: "product_deliveries",
                column: "vehicle_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_delivery_drivers_driver_id",
                table: "product_delivery_drivers",
                column: "driver_id");

            migrationBuilder.CreateIndex(
                name: "ix_products_brewery_id",
                table: "products",
                column: "brewery_id");

            migrationBuilder.CreateIndex(
                name: "ix_products_public_id",
                table: "products",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_roles_user_id",
                table: "user_roles",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_public_id",
                table: "users",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_user_name",
                table: "users",
                column: "user_name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_vehicles_public_id",
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
                name: "driver_availabilities");

            migrationBuilder.DropTable(
                name: "inventory_items");

            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "product_delivery_drivers");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "delivery_stops");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "drivers");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "product_deliveries");

            migrationBuilder.DropTable(
                name: "clients");

            migrationBuilder.DropTable(
                name: "breweries");

            migrationBuilder.DropTable(
                name: "vehicles");
        }
    }
}
