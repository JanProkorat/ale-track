using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sales",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    sale_date = table.Column<DateOnly>(type: "date", nullable: false),
                    state = table.Column<int>(type: "integer", nullable: false),
                    buyer_kind = table.Column<int>(type: "integer", nullable: false),
                    client_id = table.Column<long>(type: "bigint", nullable: true),
                    buyer_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    payment = table.Column<int>(type: "integer", nullable: false),
                    billing_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    billing_company_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    billing_vat_id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    billing_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    billing_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    billing_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    billing_zip = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    billing_due_date = table.Column<DateOnly>(type: "date", nullable: true),
                    billing_is_paid = table.Column<bool>(type: "boolean", nullable: true),
                    billing_paid_date = table.Column<DateOnly>(type: "date", nullable: true),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sold_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales", x => x.id);
                    table.ForeignKey(
                        name: "FK_sales_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sales_users_sold_by_user_id",
                        column: x => x.sold_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "sale_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    sale_id = table.Column<long>(type: "bigint", nullable: false),
                    inventory_item_id = table.Column<long>(type: "bigint", nullable: true),
                    product_id = table.Column<long>(type: "bigint", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    package_size = table.Column<double>(type: "double precision", nullable: true),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    unit_price_with_vat = table.Column<decimal>(type: "numeric", nullable: false),
                    list_price_with_vat = table.Column<decimal>(type: "numeric", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sale_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_sale_items_inventory_items_inventory_item_id",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_sale_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_sale_items_sales_sale_id",
                        column: x => x.sale_id,
                        principalTable: "sales",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sale_items_inventory_item_id",
                table: "sale_items",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_sale_items_product_id",
                table: "sale_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_sale_items_public_id",
                table: "sale_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sale_items_sale_id",
                table: "sale_items",
                column: "sale_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_client_id",
                table: "sales",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_public_id",
                table: "sales",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_sale_date",
                table: "sales",
                column: "sale_date");

            migrationBuilder.CreateIndex(
                name: "IX_sales_sold_by_user_id",
                table: "sales",
                column: "sold_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_state",
                table: "sales",
                column: "state");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sale_items");

            migrationBuilder.DropTable(
                name: "sales");
        }
    }
}
