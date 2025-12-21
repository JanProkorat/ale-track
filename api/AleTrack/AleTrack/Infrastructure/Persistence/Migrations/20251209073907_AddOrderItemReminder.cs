using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AleTrack.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderItemReminder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Type",
                table: "client_reminders",
                newName: "type");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "client_reminders",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "client_reminders",
                newName: "description");

            migrationBuilder.RenameColumn(
                name: "ResolvedDate",
                table: "client_reminders",
                newName: "resolved_date");

            migrationBuilder.RenameColumn(
                name: "RecurrenceType",
                table: "client_reminders",
                newName: "recurrence_type");

            migrationBuilder.RenameColumn(
                name: "OccurrenceDate",
                table: "client_reminders",
                newName: "occurrence_date");

            migrationBuilder.RenameColumn(
                name: "NumberOfDaysToRemindBefore",
                table: "client_reminders",
                newName: "number_of_days_to_remind_before");

            migrationBuilder.RenameColumn(
                name: "DaysOfWeek",
                table: "client_reminders",
                newName: "days_of_week");

            migrationBuilder.RenameColumn(
                name: "DaysOfMonth",
                table: "client_reminders",
                newName: "days_of_month");

            migrationBuilder.RenameColumn(
                name: "ActiveUntil",
                table: "client_reminders",
                newName: "active_until");

            migrationBuilder.RenameColumn(
                name: "Text",
                table: "client_notes",
                newName: "text");

            migrationBuilder.RenameColumn(
                name: "Type",
                table: "brewery_reminders",
                newName: "type");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "brewery_reminders",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Description",
                table: "brewery_reminders",
                newName: "description");

            migrationBuilder.RenameColumn(
                name: "ResolvedDate",
                table: "brewery_reminders",
                newName: "resolved_date");

            migrationBuilder.RenameColumn(
                name: "RecurrenceType",
                table: "brewery_reminders",
                newName: "recurrence_type");

            migrationBuilder.RenameColumn(
                name: "OccurrenceDate",
                table: "brewery_reminders",
                newName: "occurrence_date");

            migrationBuilder.RenameColumn(
                name: "NumberOfDaysToRemindBefore",
                table: "brewery_reminders",
                newName: "number_of_days_to_remind_before");

            migrationBuilder.RenameColumn(
                name: "DaysOfWeek",
                table: "brewery_reminders",
                newName: "days_of_week");

            migrationBuilder.RenameColumn(
                name: "DaysOfMonth",
                table: "brewery_reminders",
                newName: "days_of_month");

            migrationBuilder.RenameColumn(
                name: "ActiveUntil",
                table: "brewery_reminders",
                newName: "active_until");

            migrationBuilder.AddColumn<int>(
                name: "reminder_state",
                table: "order_items",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "reminder_state",
                table: "order_items");

            migrationBuilder.RenameColumn(
                name: "type",
                table: "client_reminders",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "client_reminders",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "description",
                table: "client_reminders",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "resolved_date",
                table: "client_reminders",
                newName: "ResolvedDate");

            migrationBuilder.RenameColumn(
                name: "recurrence_type",
                table: "client_reminders",
                newName: "RecurrenceType");

            migrationBuilder.RenameColumn(
                name: "occurrence_date",
                table: "client_reminders",
                newName: "OccurrenceDate");

            migrationBuilder.RenameColumn(
                name: "number_of_days_to_remind_before",
                table: "client_reminders",
                newName: "NumberOfDaysToRemindBefore");

            migrationBuilder.RenameColumn(
                name: "days_of_week",
                table: "client_reminders",
                newName: "DaysOfWeek");

            migrationBuilder.RenameColumn(
                name: "days_of_month",
                table: "client_reminders",
                newName: "DaysOfMonth");

            migrationBuilder.RenameColumn(
                name: "active_until",
                table: "client_reminders",
                newName: "ActiveUntil");

            migrationBuilder.RenameColumn(
                name: "text",
                table: "client_notes",
                newName: "Text");

            migrationBuilder.RenameColumn(
                name: "type",
                table: "brewery_reminders",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "brewery_reminders",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "description",
                table: "brewery_reminders",
                newName: "Description");

            migrationBuilder.RenameColumn(
                name: "resolved_date",
                table: "brewery_reminders",
                newName: "ResolvedDate");

            migrationBuilder.RenameColumn(
                name: "recurrence_type",
                table: "brewery_reminders",
                newName: "RecurrenceType");

            migrationBuilder.RenameColumn(
                name: "occurrence_date",
                table: "brewery_reminders",
                newName: "OccurrenceDate");

            migrationBuilder.RenameColumn(
                name: "number_of_days_to_remind_before",
                table: "brewery_reminders",
                newName: "NumberOfDaysToRemindBefore");

            migrationBuilder.RenameColumn(
                name: "days_of_week",
                table: "brewery_reminders",
                newName: "DaysOfWeek");

            migrationBuilder.RenameColumn(
                name: "days_of_month",
                table: "brewery_reminders",
                newName: "DaysOfMonth");

            migrationBuilder.RenameColumn(
                name: "active_until",
                table: "brewery_reminders",
                newName: "ActiveUntil");
        }
    }
}
