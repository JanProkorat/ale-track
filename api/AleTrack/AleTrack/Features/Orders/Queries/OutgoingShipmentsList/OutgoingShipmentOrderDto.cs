using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Features.ClientDeliveryPlaces;

namespace AleTrack.Features.Orders.Queries.OutgoingShipmentsList;

public record OutgoingShipmentOrderDto
{
    /// <summary>
    /// Public ID of the order
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// Latest date when order needs to be delivered to the client
    /// </summary>
    public DateOnly? RequiredDeliveryDate { get; set; }
    
    /// <summary>
    /// Name of the related client
    /// </summary>
    public string ClientName { get; set; } = null!;

    /// <summary>
    /// Business name of the related client, when it has one distinct from <see cref="ClientName"/>.
    /// </summary>
    public string? ClientBusinessName { get; set; }

    /// <summary>
    /// Official address of the client
    /// </summary>
    public AddressDto? ClientOfficialAddress { get; set; }
    
    /// <summary>
    /// Contact address of the client
    /// </summary>
    public AddressDto? ClientContactAddress { get; set; }

    /// <summary>
    /// The client's saved delivery places, offered as extra destinations for
    /// this order's stop. Soft-deleted places are excluded.
    /// </summary>
    public List<ClientDeliveryPlaceDto> ClientDeliveryPlaces { get; set; } = [];

    /// <summary>
    /// The delivery address the order itself asks for. A stop added for this
    /// order inherits it rather than defaulting to the billing address.
    /// </summary>
    public DeliveryAddressKind DeliveryAddressKind { get; set; }

    /// <summary>
    /// The order's chosen delivery place, when its kind is
    /// <see cref="DeliveryAddressKind.DeliveryPlace"/>
    /// </summary>
    public Guid? ClientDeliveryPlaceId { get; set; }

    /// <summary>
    /// List of order items
    /// </summary>
    public List<UnassignedOrderItemDto> Items { get; set; } = [];

    /// <summary>
    /// Supplier goods this order asks for, with the split that decides where each is collected.
    /// </summary>
    /// <remarks>
    /// Carried so the shipment editor can show which pickup stops adding this order will create,
    /// before the save that actually creates them. The server remains the only thing that creates
    /// them — see <c>SupplierPickupStopReconciler</c>.
    /// </remarks>
    public List<UnassignedSupplierGoodDto> SupplierGoods { get; set; } = [];
}

/// <summary>
/// One supplier-good line of an order not yet on a run, and where its pieces come from.
/// </summary>
public record UnassignedSupplierGoodDto
{
    /// <summary>Public ID of the order line.</summary>
    public Guid Id { get; set; }

    /// <summary>Name of the good.</summary>
    public string Name { get; set; } = null!;

    /// <summary>Quantity ordered.</summary>
    public int Quantity { get; set; }

    /// <summary>
    /// How many of them come from our own garage. The rest is collected at the supplier, which is
    /// what decides whether adding this order puts that supplier on the route.
    /// </summary>
    public int QuantityFromGarage { get; set; }

    /// <summary>Public ID of the supplier whose price list it is on.</summary>
    public Guid SupplierId { get; set; }

    /// <summary>Name of that supplier — the label a pickup stop would carry.</summary>
    public string SupplierName { get; set; } = null!;

    /// <summary>That supplier's registered seat — where the pickup stop would be.</summary>
    public AddressDto? SupplierAddress { get; set; }
}

public record UnassignedOrderItemDto
{
    /// <summary>
    /// ID of the order item
    /// </summary>
    public Guid OrderItemId { get; set; }
    
    /// <summary>
    /// ID of related product
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Name of related product
    /// </summary>
    public string ProductName { get; set; } = null!;

    /// <summary>
    /// Represents the quantity of the product in the order item.
    /// </summary>
    public int Quantity { get; set; }
    
    /// <summary>
    /// Kind of the product
    /// </summary>
    public ProductKind Kind { get; set; }
    
    /// <summary>
    /// Type of the product
    /// </summary>
    public ProductType Type { get; set; }
    
    /// <summary>
    /// How much alcohol product contains
    /// </summary>
    public float? AlcoholPercentage { get; set; }
    
    /// <summary>
    /// Degree of the beer - 10, 11, 12 etc.
    /// </summary>
    public float? PlatoDegree { get; set; }
    
    /// <summary>
    /// Size of the whole package
    /// </summary>
    public double? PackageSize { get; set; }
    
    /// <summary>
    /// Weight of the product in kilograms
    /// </summary>
    public double? Weight { get; set; }
    
    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    public bool IsShipmentLoadingConfirmed { get; set; }

    /// <summary>
    /// Display order based on brewery.
    /// </summary>
    public int BreweryDisplayOrder { get; set; }
    
    /// <summary>
    /// Display order of the product based on the Product kind
    /// </summary>
    public int DisplayOrder { get; set; }
}