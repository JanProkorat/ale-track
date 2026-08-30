using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClientLedgerEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "client_ledger_entries",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    client_id = table.Column<long>(type: "bigint", nullable: false),
                    order_id = table.Column<long>(type: "bigint", nullable: true),
                    stop_id = table.Column<long>(type: "bigint", nullable: true),
                    target = table.Column<int>(type: "integer", nullable: false),
                    order_item_id = table.Column<long>(type: "bigint", nullable: true),
                    product_id = table.Column<long>(type: "bigint", nullable: true),
                    product_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    supplier_good_item_id = table.Column<long>(type: "bigint", nullable: true),
                    custom_extra_item_id = table.Column<long>(type: "bigint", nullable: true),
                    order_return_id = table.Column<long>(type: "bigint", nullable: true),
                    line_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    planned_quantity = table.Column<int>(type: "integer", nullable: true),
                    actual_quantity = table.Column<int>(type: "integer", nullable: true),
                    planned_text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    actual_text = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    amount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    requires_follow_up = table.Column<bool>(type: "boolean", nullable: false),
                    resolved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    resolved_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    resolution_note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    resolved_by_order_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    public_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_client_ledger_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_order_custom_extra_items_custom_extra~",
                        column: x => x.custom_extra_item_id,
                        principalTable: "order_custom_extra_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_order_items_order_item_id",
                        column: x => x.order_item_id,
                        principalTable: "order_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_order_returns_order_return_id",
                        column: x => x.order_return_id,
                        principalTable: "order_returns",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_order_supplier_good_items_supplier_go~",
                        column: x => x.supplier_good_item_id,
                        principalTable: "order_supplier_good_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_orders_resolved_by_order_id",
                        column: x => x.resolved_by_order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_outgoing_shipment_stops_stop_id",
                        column: x => x.stop_id,
                        principalTable: "outgoing_shipment_stops",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_client_ledger_entries_users_resolved_by_user_id",
                        column: x => x.resolved_by_user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_client_id_resolved_at",
                table: "client_ledger_entries",
                columns: new[] { "client_id", "resolved_at" });

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_created_by_user_id",
                table: "client_ledger_entries",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_custom_extra_item_id",
                table: "client_ledger_entries",
                column: "custom_extra_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_open_line",
                table: "client_ledger_entries",
                columns: new[] { "client_id", "order_id", "target", "order_item_id", "product_id", "supplier_good_item_id", "custom_extra_item_id", "order_return_id", "line_name" },
                unique: true,
                filter: "\"resolved_at\" IS NULL\nAND \"target\" NOT IN (5, 6)")
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_order_id",
                table: "client_ledger_entries",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_order_item_id",
                table: "client_ledger_entries",
                column: "order_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_order_return_id",
                table: "client_ledger_entries",
                column: "order_return_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_product_id",
                table: "client_ledger_entries",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_public_id",
                table: "client_ledger_entries",
                column: "public_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_resolved_by_order_id",
                table: "client_ledger_entries",
                column: "resolved_by_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_resolved_by_user_id",
                table: "client_ledger_entries",
                column: "resolved_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_stop_id",
                table: "client_ledger_entries",
                column: "stop_id");

            migrationBuilder.CreateIndex(
                name: "IX_client_ledger_entries_supplier_good_item_id",
                table: "client_ledger_entries",
                column: "supplier_good_item_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "client_ledger_entries");
        }
    }
}
