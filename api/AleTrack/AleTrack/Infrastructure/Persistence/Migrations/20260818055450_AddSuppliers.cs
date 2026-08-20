using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSuppliers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "suppliers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    business_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    official_address_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    official_address_zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    official_address_country = table.Column<int>(type: "integer", nullable: false),
                    official_address_latitude = table.Column<decimal>(type: "numeric", nullable: true),
                    official_address_longitude = table.Column<decimal>(type: "numeric", nullable: true),
                    contact_address_street_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_street_number = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_city = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    contact_address_zip = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    contact_address_country = table.Column<int>(type: "integer", nullable: true),
                    contact_address_latitude = table.Column<decimal>(type: "numeric", nullable: true),
                    contact_address_longitude = table.Column<decimal>(type: "numeric", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_suppliers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "supplier_contacts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    supplier_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    value = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_contacts", x => x.id);
                    table.ForeignKey(
                        name: "FK_supplier_contacts_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "supplier_goods",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    supplier_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    size = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_goods", x => x.id);
                    table.ForeignKey(
                        name: "FK_supplier_goods_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "supplier_notes",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    supplier_id = table.Column<long>(type: "bigint", nullable: false),
                    date_created = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false),
                    text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_notes", x => x.id);
                    table.ForeignKey(
                        name: "FK_supplier_notes_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "supplier_opening_hours",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    supplier_id = table.Column<long>(type: "bigint", nullable: false),
                    day_of_week = table.Column<int>(type: "integer", nullable: false),
                    from_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    to_time = table.Column<TimeOnly>(type: "time without time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_opening_hours", x => x.id);
                    table.ForeignKey(
                        name: "FK_supplier_opening_hours_suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "supplier_good_prices",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    supplier_good_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    price_with_vat = table.Column<decimal>(type: "numeric", nullable: false),
                    price_without_vat = table.Column<decimal>(type: "numeric", nullable: true),
                    note = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_supplier_good_prices", x => x.id);
                    table.ForeignKey(
                        name: "FK_supplier_good_prices_supplier_goods_supplier_good_id",
                        column: x => x.supplier_good_id,
                        principalTable: "supplier_goods",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_supplier_contacts_supplier_id",
                table: "supplier_contacts",
                column: "supplier_id");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_good_prices_supplier_good_id_kind",
                table: "supplier_good_prices",
                columns: new[] { "supplier_good_id", "kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_supplier_goods_public_id",
                table: "supplier_goods",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_supplier_goods_supplier_id",
                table: "supplier_goods",
                column: "supplier_id");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_notes_public_id",
                table: "supplier_notes",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_supplier_notes_supplier_id",
                table: "supplier_notes",
                column: "supplier_id");

            migrationBuilder.CreateIndex(
                name: "IX_supplier_opening_hours_supplier_id_day_of_week",
                table: "supplier_opening_hours",
                columns: new[] { "supplier_id", "day_of_week" });

            migrationBuilder.CreateIndex(
                name: "IX_suppliers_public_id",
                table: "suppliers",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "supplier_contacts");

            migrationBuilder.DropTable(
                name: "supplier_good_prices");

            migrationBuilder.DropTable(
                name: "supplier_notes");

            migrationBuilder.DropTable(
                name: "supplier_opening_hours");

            migrationBuilder.DropTable(
                name: "supplier_goods");

            migrationBuilder.DropTable(
                name: "suppliers");
        }
    }
}
