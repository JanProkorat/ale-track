using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPriceListImports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "price_effective_from",
                table: "products",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "price_list_imports",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    brewery_id = table.Column<long>(type: "bigint", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    source_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    source_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    imported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    imported_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    added_count = table.Column<int>(type: "integer", nullable: false),
                    updated_count = table.Column<int>(type: "integer", nullable: false),
                    removed_count = table.Column<int>(type: "integer", nullable: false),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_price_list_imports", x => x.id);
                    table.ForeignKey(
                        name: "FK_price_list_imports_breweries_brewery_id",
                        column: x => x.brewery_id,
                        principalTable: "breweries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_price_list_imports_users_imported_by_user_id",
                        column: x => x.imported_by_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_price_list_imports_brewery_id",
                table: "price_list_imports",
                column: "brewery_id");

            migrationBuilder.CreateIndex(
                name: "IX_price_list_imports_imported_by_user_id",
                table: "price_list_imports",
                column: "imported_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_price_list_imports_public_id",
                table: "price_list_imports",
                column: "public_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "price_list_imports");

            migrationBuilder.DropColumn(
                name: "price_effective_from",
                table: "products");
        }
    }
}
