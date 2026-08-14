using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleItemKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "kind",
                table: "sale_items",
                type: "integer",
                nullable: true);

            // Best-effort backfill so lines sold before this column existed still show their
            // packaging. It copies the product's *current* kind, which is not strictly the snapshot
            // the column is for — but for rows written before the snapshot existed there is no better
            // source, and a slightly stale kind beats a blank one. Only rows whose product link
            // survives are touched; the rest stay null and simply render without a badge.
            migrationBuilder.Sql(
                """
                UPDATE sale_items
                SET kind = p.kind
                FROM products p
                WHERE sale_items.product_id = p.id
                  AND sale_items.kind IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "kind",
                table: "sale_items");
        }
    }
}
