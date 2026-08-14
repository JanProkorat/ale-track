using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAwaitingPaymentState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Order matters. Unpaid-ness used to live in billing_is_paid and now lives in the state,
            // so the rows have to be moved while the column still exists — dropping first would
            // silently promote every unpaid invoice to "Dokončený" with no way to tell which.
            //
            // state 1 = Completed, 2 = AwaitingPayment; payment 1 = Invoice (SaleState /
            // SalePaymentMethod are persisted as int).
            migrationBuilder.Sql(
                """
                UPDATE sales
                SET state = 2
                WHERE state = 1
                  AND payment = 1
                  AND billing_is_paid IS NOT TRUE;
                """);

            migrationBuilder.DropColumn(
                name: "billing_is_paid",
                table: "sales");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "billing_is_paid",
                table: "sales",
                type: "boolean",
                nullable: true);

            // Rebuild the flag from the state, then fold AwaitingPayment back into Completed so the
            // old two-state world is consistent again.
            migrationBuilder.Sql(
                """
                UPDATE sales
                SET billing_is_paid = (state = 1)
                WHERE payment = 1;

                UPDATE sales SET state = 1 WHERE state = 2;
                """);
        }
    }
}
