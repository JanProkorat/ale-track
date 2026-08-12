using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverUserLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "user_id",
                table: "drivers",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_drivers_user_id",
                table: "drivers",
                column: "user_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_drivers_users_user_id",
                table: "drivers",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_drivers_users_user_id",
                table: "drivers");

            migrationBuilder.DropIndex(
                name: "IX_drivers_user_id",
                table: "drivers");

            migrationBuilder.DropColumn(
                name: "user_id",
                table: "drivers");
        }
    }
}
