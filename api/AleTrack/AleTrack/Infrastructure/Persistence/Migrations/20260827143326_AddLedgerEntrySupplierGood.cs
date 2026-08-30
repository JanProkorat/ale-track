using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLedgerEntrySupplierGood : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_client_ledger_entries_open_line",
                table: "client_ledger_entries");

            migrationBuilder.AddColumn<string>(
                name: "good_name",
                table: "client_ledger_entries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "supplier_good_id",
                table: "client_ledger_entries",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_open_line",
                table: "client_ledger_entries",
                columns: new[] { "client_id", "order_id", "target", "order_item_id", "product_id", "supplier_good_item_id", "supplier_good_id", "custom_extra_item_id", "order_return_id", "line_name" },
                unique: true,
                filter: "\"resolved_at\" IS NULL\nAND \"target\" NOT IN (5, 6)")
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_supplier_good_id",
                table: "client_ledger_entries",
                column: "supplier_good_id");

            migrationBuilder.AddForeignKey(
                name: "FK_client_ledger_entries_supplier_goods_supplier_good_id",
                table: "client_ledger_entries",
                column: "supplier_good_id",
                principalTable: "supplier_goods",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_client_ledger_entries_supplier_goods_supplier_good_id",
                table: "client_ledger_entries");

            migrationBuilder.DropIndex(
                name: "IX_client_ledger_entries_open_line",
                table: "client_ledger_entries");

            migrationBuilder.DropIndex(
                name: "IX_client_ledger_entries_supplier_good_id",
                table: "client_ledger_entries");

            migrationBuilder.DropColumn(
                name: "good_name",
                table: "client_ledger_entries");

            migrationBuilder.DropColumn(
                name: "supplier_good_id",
                table: "client_ledger_entries");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_open_line",
                table: "client_ledger_entries",
                columns: new[] { "client_id", "order_id", "target", "order_item_id", "product_id", "supplier_good_item_id", "custom_extra_item_id", "order_return_id", "line_name" },
                unique: true,
                filter: "\"resolved_at\" IS NULL\nAND \"target\" NOT IN (5, 6)")
                .Annotation("Npgsql:NullsDistinct", false);
        }
    }
}
