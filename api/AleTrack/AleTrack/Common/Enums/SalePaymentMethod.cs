namespace AleTrack.Common.Enums;

/// <summary>
/// How a garage sale is paid for.
/// </summary>
public enum SalePaymentMethod
{
    /// <summary>
    /// Paid in cash on the spot. No billing details are recorded.
    /// </summary>
    Cash,

    /// <summary>
    /// Invoiced. Billing details are recorded and the sale is tracked until paid; the invoice
    /// document itself is issued in the accounting software.
    /// </summary>
    Invoice
}
