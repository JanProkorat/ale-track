using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace AleTrack.Features.ProductDeliveries.Utils;

/// <summary>
/// A stop as the write endpoints describe it to <see cref="DeliverySourceCatalog"/>, stripped of
/// whichever payload type it came from.
/// </summary>
internal sealed record DeliveryStopSource(
    DeliveryStopKind Kind,
    Guid? BreweryId,
    Guid? SupplierId,
    IReadOnlyList<DeliveryLineSource> Lines);

/// <summary>
/// One line of a stop as the write endpoints describe it.
/// </summary>
internal sealed record DeliveryLineSource(
    Guid? ProductId,
    Guid? SupplierGoodId,
    SupplierChargeKind? ChargeKind,
    int Quantity,
    string? Note);

/// <summary>
/// Everything a delivery's stops point at, resolved from public IDs in one pass and handed back as
/// entities the endpoints can attach.
/// </summary>
/// <remarks>
/// Shared by create and update because the work is identical and the checks are the interesting
/// part: a good has to belong to the supplier whose stop it is on, and it has to have a price for
/// the charge kind asked for, or the cart would show a line the ceník cannot price. Those two live
/// here rather than in each endpoint so neither can be the one that forgets.
///
/// Deliberately not injected — the endpoint test harness constructs endpoints directly and ignores
/// DI, so a new constructor parameter would break every delivery test. It takes the DbContext as an
/// argument instead.
/// </remarks>
internal sealed class DeliverySourceCatalog
{
    private readonly Dictionary<Guid, Brewery> _breweries;
    private readonly Dictionary<Guid, Supplier> _suppliers;
    private readonly Dictionary<Guid, Product> _products;
    private readonly Dictionary<Guid, SupplierGood> _goods;

    private DeliverySourceCatalog(
        Dictionary<Guid, Brewery> breweries,
        Dictionary<Guid, Supplier> suppliers,
        Dictionary<Guid, Product> products,
        Dictionary<Guid, SupplierGood> goods)
    {
        _breweries = breweries;
        _suppliers = suppliers;
        _products = products;
        _goods = goods;
    }

    /// <summary>
    /// Loads every brewery, supplier, product and good the given stops reference, throwing a 404
    /// naming the ones that do not exist.
    /// </summary>
    public static async Task<DeliverySourceCatalog> LoadAsync(
        AleTrackDbContext dbContext,
        IReadOnlyList<DeliveryStopSource> stops,
        CancellationToken ct)
    {
        var breweryIds = stops
            .Where(s => s.Kind == DeliveryStopKind.Brewery && s.BreweryId is not null)
            .Select(s => s.BreweryId!.Value)
            .Distinct()
            .ToList();

        var supplierIds = stops
            .Where(s => s.Kind == DeliveryStopKind.Supplier && s.SupplierId is not null)
            .Select(s => s.SupplierId!.Value)
            .Distinct()
            .ToList();

        var productIds = stops
            .SelectMany(s => s.Lines)
            .Where(l => l.ProductId is not null)
            .Select(l => l.ProductId!.Value)
            .Distinct()
            .ToList();

        var goodIds = stops
            .SelectMany(s => s.Lines)
            .Where(l => l.SupplierGoodId is not null)
            .Select(l => l.SupplierGoodId!.Value)
            .Distinct()
            .ToList();

        var breweries = breweryIds.Count == 0
            ? []
            : await dbContext.Breweries
                .Where(b => breweryIds.Contains(b.PublicId))
                .ToListAsync(ct);

        // Deleted suppliers are excluded, as deleted products already are: a supplier is softly
        // deletable so old purchase records stay resolvable, which is not the same as still being
        // somewhere a van can be sent.
        var suppliers = supplierIds.Count == 0
            ? []
            : await dbContext.Suppliers
                .Where(s => supplierIds.Contains(s.PublicId) && !s.IsDeleted)
                .ToListAsync(ct);

        var products = productIds.Count == 0
            ? []
            : await dbContext.Products
                .Where(p => productIds.Contains(p.PublicId) && !p.IsDeleted)
                .ToListAsync(ct);

        // Prices come along because the charge kind asked for has to be one the good actually has.
        var goods = goodIds.Count == 0
            ? []
            : await dbContext.SupplierGoods
                .Where(g => goodIds.Contains(g.PublicId))
                .Include(g => g.Prices)
                .ToListAsync(ct);

        RejectMissing(nameof(Brewery), breweryIds, breweries.Select(b => b.PublicId));
        RejectMissing(nameof(Supplier), supplierIds, suppliers.Select(s => s.PublicId));
        RejectMissing(nameof(Product), productIds, products.Select(p => p.PublicId));
        RejectMissing(nameof(SupplierGood), goodIds, goods.Select(g => g.PublicId));

        return new DeliverySourceCatalog(
            breweries.ToDictionary(b => b.PublicId),
            suppliers.ToDictionary(s => s.PublicId),
            products.ToDictionary(p => p.PublicId),
            goods.ToDictionary(g => g.PublicId));
    }

    /// <summary>
    /// The brewery a brewery stop calls at.
    /// </summary>
    public Brewery Brewery(Guid publicId) => _breweries[publicId];

    /// <summary>
    /// The supplier a supplier stop calls at.
    /// </summary>
    public Supplier Supplier(Guid publicId) => _suppliers[publicId];

    /// <summary>
    /// Builds the delivery line for <paramref name="line"/>, checked against the stop it sits on.
    /// </summary>
    public DeliveryItem BuildItem(DeliveryStopSource stop, DeliveryLineSource line)
    {
        if (line.ProductId is not null)
        {
            var product = _products[line.ProductId.Value];
            var item = new DeliveryItem
            {
                Product = product,
                Quantity = line.Quantity,
                Note = line.Note
            };
            DeliveryItemSnapshot.Apply(item, product);
            return item;
        }

        var good = _goods[line.SupplierGoodId!.Value];
        var supplier = _suppliers[stop.SupplierId!.Value];

        if (good.SupplierId != supplier.Id)
            ProductDeliveryThrowHelper.SupplierGoodNotFromStopSupplier(good.PublicId, supplier.PublicId);

        var chargeKind = line.ChargeKind!.Value;
        if (good.Prices.All(p => p.Kind != chargeKind))
            ProductDeliveryThrowHelper.SupplierGoodPriceMissing(good.PublicId, chargeKind);

        // No weight snapshot: a good's size is free text, so there are no inputs to record. The
        // check constraint on delivery_items requires them left null here.
        return new DeliveryItem
        {
            SupplierGood = good,
            ChargeKind = chargeKind,
            Quantity = line.Quantity,
            Note = line.Note,
            Kind = null,
            PackageSize = null,
            UnitsPerPackage = null
        };
    }

    private static void RejectMissing(string entityName, List<Guid> requested, IEnumerable<Guid> found)
    {
        if (requested.Count == 0)
            return;

        var missing = requested.Except(found).ToList();
        if (missing.Count > 0)
            ThrowHelper.PublicEntitiesNotFound(entityName, missing);
    }
}
