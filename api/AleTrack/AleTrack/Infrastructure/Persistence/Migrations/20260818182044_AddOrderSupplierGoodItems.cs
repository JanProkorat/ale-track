using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderSupplierGoodItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "order_supplier_good_items",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<long>(type: "bigint", nullable: false),
                    supplier_good_id = table.Column<long>(type: "bigint", nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_order_supplier_good_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_order_supplier_good_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_order_supplier_good_items_supplier_goods_supplier_good_id",
                        column: x => x.supplier_good_id,
                        principalTable: "supplier_goods",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_order_supplier_good_items_order_id",
                table: "order_supplier_good_items",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_order_supplier_good_items_public_id",
                table: "order_supplier_good_items",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_order_supplier_good_items_supplier_good_id",
                table: "order_supplier_good_items",
                column: "supplier_good_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "order_supplier_good_items");
        }
    }
}
