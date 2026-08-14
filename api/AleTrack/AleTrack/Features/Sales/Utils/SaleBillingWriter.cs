using AleTrack.Common.Enums;
using AleTrack.Entities;

namespace AleTrack.Features.Sales.Utils;

/// <summary>
/// Maps the client-supplied billing payload onto the owned <see cref="SaleBillingDetails"/>.
/// </summary>
public static class SaleBillingWriter
{
    /// <summary>
    /// Builds the billing block for a sale, or null when it is paid in cash.
    /// </summary>
    /// <param name="payment">Payment method of the sale.</param>
    /// <param name="dto">Billing payload, if any.</param>
    /// <param name="existing">
    /// Billing block already on the sale, so an edit does not silently clear the settlement date —
    /// that is owned by the confirm-payment command, not by editing.
    /// </param>
    /// <returns>The billing block, or null for a cash sale.</returns>
    /// <remarks>
    /// Returning null for cash is what stops a sale switched from Faktura to Hotově from keeping
    /// stale billing data that the UI would no longer show but a report still would.
    /// </remarks>
    public static SaleBillingDetails? From(
        SalePaymentMethod payment,
        SaleBillingDto? dto,
        SaleBillingDetails? existing = null)
    {
        if (payment != SalePaymentMethod.Invoice || dto is null)
        {
            return null;
        }

        return new SaleBillingDetails
        {
            Name = dto.Name,
            CompanyId = dto.CompanyId,
            VatId = dto.VatId,
            StreetName = dto.StreetName,
            StreetNumber = dto.StreetNumber,
            City = dto.City,
            Zip = dto.Zip,
            DueDate = dto.DueDate,
            PaidDate = existing?.PaidDate
        };
    }
}
