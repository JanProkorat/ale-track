using AleTrack.Common.Enums;

namespace AleTrack.Features.OutgoingShipments.Queries.Export;

/// <summary>
/// Narrows a loaded export model to the scope the caller asked for.
/// </summary>
/// <remarks>
/// One place, so the two writers cannot drift apart on what a scope means — and so neither of them
/// has to know a scope exists. The query always loads the plan and its deviations; this decides
/// which of the two the writers get to see, and the writers render whatever is in front of them.
///
/// That is what keeps <see cref="ShipmentExportScope.Plan"/> honest: it hands the writers a model
/// with no deviation on it anywhere, which is the model they were written against, so the paper
/// printed before the run is byte-for-byte the file it always was.
///
/// The run's own summary and route survive every scope. They are the page that says which run this
/// is, and a correction with no run on it is not filed anywhere.
/// </remarks>
internal static class ShipmentExportScopeFilter
{
    /// <summary>
    /// Returns the model as the chosen scope sees it. The input is never mutated — every level is
    /// rebuilt with <c>with</c>, so the caller's model stays whole.
    /// </summary>
    internal static ShipmentExportModel Apply(ShipmentExportModel model, ShipmentExportScope scope) =>
        scope switch
        {
            ShipmentExportScope.Plan => WithoutDeviations(model),
            ShipmentExportScope.Changed => OnlyDeviations(model),
            _ => model
        };

    /// <summary>
    /// The plan as it was ordered: every deviation taken off, and the rows that exist only because
    /// of one taken out altogether.
    /// </summary>
    private static ShipmentExportModel WithoutDeviations(ShipmentExportModel model) =>
        model with
        {
            Invoices = model.Invoices
                .Select(invoice => invoice with
                {
                    Parties = invoice.Parties
                        .Select(party => party with
                        {
                            Products = party.Products
                                .Where(product => !product.IsFromDeviation)
                                .Select(product => product with { Deviation = null })
                                .ToList(),
                            Returns = party.Returns
                                .Select(giveBack => giveBack with { Deviation = null })
                                .ToList(),
                            Deviations = []
                        })
                        .ToList()
                })
                .ToList()
        };

    /// <summary>
    /// Only what diverged: the clients that changed, and within each of them only the rows a
    /// deviation touched.
    /// </summary>
    /// <remarks>
    /// The order's own notes go with the rest of the unchanged content — restating them is what this
    /// scope exists to avoid. The delivery address stays, because a correction has to say whose
    /// delivery it corrects.
    ///
    /// An invoice all of whose parties went to plan drops out entirely rather than printing as an
    /// empty block, and so does the whole invoice part when nothing on the run diverged: an empty
    /// file is the honest answer to "send me what changed" when the answer is nothing.
    /// </remarks>
    private static ShipmentExportModel OnlyDeviations(ShipmentExportModel model) =>
        model with
        {
            Invoices = model.Invoices
                .Select(invoice => invoice with
                {
                    Parties = invoice.Parties
                        .Where(party => party.HasDeviations)
                        .Select(party => party with
                        {
                            Products = party.Products
                                .Where(product => product.Deviation is not null)
                                .ToList(),
                            Returns = party.Returns
                                .Where(giveBack => giveBack.Deviation is not null)
                                .ToList(),
                            Notes = []
                        })
                        .ToList()
                })
                .Where(invoice => invoice.Parties.Count > 0)
                .ToList()
        };
}
