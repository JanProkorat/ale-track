using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRoleCapabilities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "role_capabilities",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    role = table.Column<int>(type: "integer", nullable: false),
                    capability_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    is_visible = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_capabilities", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_role_capabilities_role_capability_key",
                table: "role_capabilities",
                columns: new[] { "role", "capability_key" },
                unique: true);

            // Driver's phase-1 denials, so this migration is behaviour-neutral.
            // role = 2 is UserRoleType.Driver; keys match Capability enum names.
            migrationBuilder.Sql(
                """
                INSERT INTO role_capabilities (role, capability_key, is_visible)
                VALUES (2, 'Invoicing', false),
                       (2, 'LoadingBreakdown', false),
                       (2, 'Money', false);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM role_capabilities WHERE role = 2;");

            migrationBuilder.DropTable(
                name: "role_capabilities");
        }
    }
}
