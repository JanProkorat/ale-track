using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Features.ClientDeliveryPlaces;
using AleTrack.Features.Orders.Utils;
using AleTrack.Features.OutgoingShipments.Commands.Update;
using AleTrack.Features.OutgoingShipments.Utils;

namespace AleTrack.Features.OutgoingShipments.Queries.Detail;

/// <summary>
/// Data transfer object representing detailed information about an outgoing shipment
/// </summary>
public sealed record OutgoingShipmentDetailDto
{
    /// <summary>
    /// Public ID of the outgoing shipment
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Current state of the outgoing shipment
    /// </summary>
    public OutgoingShipmentState State { get; set; }

    /// <summary>
    /// Whether the run's invoicing has been filed — the one-way door after which its orders are
    /// closed to editing and the Vykládka begins offering to record deviations instead.
    /// </summary>
    /// <remarks>
    /// On the run rather than on each stop: filing is one act for the whole run, and a copy per
    /// stop would invite the copies to disagree.
    /// </remarks>
    public bool IsInvoicingFiled { get; set; }

    /// <summary>
    /// Name of the outgoing shipment
    /// </summary>
    public string Name { get; set; } = null!;
    
    /// <summary>
    /// Date when the shipment is scheduled for delivery
    /// </summary>
    public DateTime? DeliveryDate { get; set; }

    /// <summary>Which kind of place the run is loaded at.</summary>
    public ShipmentStartPointKind StartPointKind { get; set; }

    /// <summary>Public ID of the start brewery; null when the run starts at the company.</summary>
    public Guid? StartBreweryId { get; set; }

    /// <summary>
    /// Which of the start brewery's addresses the run is loaded at. Meaningless when
    /// <see cref="StartPointKind"/> is <see cref="ShipmentStartPointKind.Company"/>.
    /// </summary>
    public DeliveryAddressKind StartBreweryAddressKind { get; set; }

    /// <summary>Resolved display name of the start point.</summary>
    public string StartPointName { get; set; } = null!;

    /// <summary>Resolved one-line address of the start point.</summary>
    public string StartPointAddress { get; set; } = null!;

    /// <summary>Latitude of the start point, when known.</summary>
    public decimal? StartPointLatitude { get; set; }

    /// <summary>Longitude of the start point, when known.</summary>
    public decimal? StartPointLongitude { get; set; }

    /// <summary>
    /// ID of the vehicle assigned to the shipment
    /// </summary>
    public Guid? VehicleId { get; set; }

    /// <summary>
    /// List of driver IDs assigned to the shipment
    /// </summary>
    public List<Guid> DriverIds { get; set; } = [];

    /// <summary>
    /// Resolved vehicle assigned to the shipment, so a caller with no Vehicles module
    /// permission (e.g. a driver) does not have to look it up separately. Null when no
    /// vehicle is assigned.
    /// </summary>
    public ShipmentVehicleDto? Vehicle { get; set; }

    /// <summary>
    /// Resolved drivers assigned to the shipment, so a caller with a driver-scoped account
    /// sees every driver on the run — not just themselves — without a second, permission-gated
    /// request. Empty when no driver is assigned.
    /// </summary>
    public List<ShipmentDriverDto> Drivers { get; set; } = [];

    /// <summary>
    /// List of stops during the shipment
    /// </summary>
    public List<OutgoingShipmentStopDto> Stops { get; set; } = [];

    /// <summary>
    /// Via points that shape the road route (not visited stops)
    /// </summary>
    public List<RoutePointDto> RouteViaPoints { get; set; } = [];

    /// <summary>
    /// Goods bought from the brewery on this run for our own warehouse ("Zboží na sklad")
    /// </summary>
    public List<OutgoingShipmentStockPurchaseItemDto> StockPurchases { get; set; } = [];

    /// <summary>
    /// Supplier goods the run's orders ask for — gas, packaging, sanitation — with where each
    /// is collected from. Aggregated across every stop, because the card that shows them is a
    /// picking list for the whole run rather than a per-stop breakdown.
    /// </summary>
    /// <remarks>
    /// Deliberately not folded into <see cref="OutgoingShipmentStopDto.Products"/>: those are
    /// brewery products the nakládka sections by brewery, and these have no brewery. Keeping
    /// them apart is also what keeps them off the loading list.
    /// </remarks>
    public List<OutgoingShipmentSupplierGoodDto> SupplierGoods { get; set; } = [];

    /// <summary>
    /// Invoices the brewery issues to us for this run, ordered by sequence. Empty when the run
    /// is covered by a single invoice — the normal case, which needs no split on screen.
    /// </summary>
    public List<OutgoingShipmentPurchaseInvoiceDto> PurchaseInvoices { get; set; } = [];

    /// <summary>
    /// How far each product has got through loading, per invoice column. Only states past
    /// "not loaded" appear.
    /// </summary>
    public List<OutgoingShipmentLoadingStateDto> LoadingStates { get; set; } = [];

    /// <summary>
    /// Checklist of what has to be done while preparing this run, in display order.
    /// </summary>
    public List<OutgoingShipmentPreparationStepDto> PreparationSteps { get; set; } = [];
}

/// <summary>
/// One step of a shipment's preparation checklist.
/// </summary>
public sealed record OutgoingShipmentPreparationStepDto
{
    /// <summary>
    /// Public ID of the step
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Position of the step within the list
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// What has to be done
    /// </summary>
    public string Label { get; set; } = null!;

    /// <summary>
    /// Whether it has been done
    /// </summary>
    public bool IsDone { get; set; }
}

/// <summary>
/// Resolved vehicle assigned to a shipment.
/// </summary>
public sealed record ShipmentVehicleDto
{
    /// <summary>
    /// Public ID of the vehicle
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the vehicle
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Max weight the vehicle can carry, in kilograms
    /// </summary>
    public double MaxWeight { get; set; }
}

/// <summary>
/// Resolved driver assigned to a shipment.
/// </summary>
public sealed record ShipmentDriverDto
{
    /// <summary>
    /// Public ID of the driver
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// First name of the driver
    /// </summary>
    public string FirstName { get; set; } = null!;

    /// <summary>
    /// Last name of the driver
    /// </summary>
    public string LastName { get; set; } = null!;

    /// <summary>
    /// Phone number of the driver
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Color of the driver, used for the left-border marker
    /// </summary>
    public string Color { get; set; } = null!;
}

/// <summary>
/// How far one product has got through loading in one invoice column.
/// </summary>
public sealed record OutgoingShipmentLoadingStateDto
{
    /// <summary>
    /// Public ID of the product
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Which invoice column, by position within the shipment
    /// </summary>
    public int Sequence { get; set; }

    /// <summary>
    /// How far it has got
    /// </summary>
    public ShipmentLoadingState State { get; set; }
}

/// <summary>
/// One invoice the brewery issues to us for an outgoing shipment.
/// </summary>
public sealed record OutgoingShipmentPurchaseInvoiceDto
{
    /// <summary>
    /// Public ID of the invoice
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Position within the shipment, starting at 1. Ordering only — not an invoice number.
    /// </summary>
    public int Sequence { get; set; }

    /// <summary>
    /// Pieces claimed by this invoice, by product. Always empty for sequence 1: that invoice is
    /// the remainder and holds whatever the others leave.
    /// </summary>
    public List<OutgoingShipmentPurchaseInvoiceLineDto> Lines { get; set; } = [];
}

/// <summary>
/// A number of pieces of one product on a brewery invoice.
/// </summary>
public sealed record OutgoingShipmentPurchaseInvoiceLineDto
{
    /// <summary>
    /// Public ID of the product
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Number of pieces of that product on the invoice
    /// </summary>
    public int Quantity { get; set; }
}

/// <summary>
/// Data transfer object representing a stop in an outgoing shipment route
/// </summary>
public sealed record OutgoingShipmentStopDto
{
    /// <summary>
    /// Public ID of the stop (needed to round-trip custom stops on update).
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Kind of the stop — order-based or a custom waypoint.
    /// </summary>
    public OutgoingShipmentStopKind Kind { get; set; }

    /// <summary>
    /// Order of the stop in the shipment route
    /// </summary>
    public int Order {get; set; }

    /// <summary>
    /// Public ID of the related client (order stops only)
    /// </summary>
    public Guid? ClientId { get; set; }

    /// <summary>
    /// Name of the related client (order stops only)
    /// </summary>
    public string? ClientName { get; set; }

    /// <summary>
    /// Official address of the client (order stops only)
    /// </summary>
    public AddressDto? OfficialAddress { get; set; }

    /// <summary>
    /// Contact address of the client
    /// </summary>
    public AddressDto? ContactAddress { get; set; }

    /// <summary>
    /// ID of the order associated with this stop (order stops only)
    /// </summary>
    public Guid? OrderId { get; set; }

    /// <summary>
    /// Public ID of the supplier this stop collects from (supplier stops only).
    /// </summary>
    public Guid? SupplierId { get; set; }

    /// <summary>
    /// Registered seat of that supplier, which is where the stop is (supplier stops only).
    /// </summary>
    /// <remarks>
    /// The stop stores its own label and coordinates too, so it keeps rendering if the
    /// supplier is later removed; this carries the full address for the stop list.
    /// </remarks>
    public AddressDto? SupplierAddress { get; set; }

    /// <summary>
    /// Kind of the selected address for the shipment (order stops only)
    /// </summary>
    public DeliveryAddressKind SelectedAddressKind { get; set; }

    /// <summary>
    /// The delivery place this stop delivers to, when
    /// <see cref="SelectedAddressKind"/> is DeliveryPlace. Deliberately still
    /// populated for soft-deleted places so historical shipments render.
    /// </summary>
    public ClientDeliveryPlaceDto? DeliveryPlace { get; set; }

    /// <summary>
    /// True when the planner routed this stop somewhere other than what its
    /// order asks for. An order edit will not rewrite such a stop.
    /// </summary>
    public bool IsAddressOverridden { get; set; }

    /// <summary>
    /// Whether the Fakturace row covering this stop's order is marked finished — which is what
    /// opens recording a deviation against it. See <see cref="Utils.InvoiceReadiness"/>.
    /// </summary>
    /// <remarks>
    /// Carried on the stop rather than read from the invoicing endpoint so the unload list needs
    /// no second query, and so a caller denied the Fakturace capability still gets the flag: what
    /// it gates is a client record, not an invoice.
    /// </remarks>
    public bool IsInvoiceReady { get; set; }

    /// <summary>
    /// Set when an order edit changed the delivery address under this shipment
    /// and nobody has acknowledged it yet. Drives the banner.
    /// </summary>
    public DateTime? AddressChangedAt { get; set; }

    /// <summary>
    /// What the order currently asks for, so the banner can name the
    /// difference rather than merely assert one
    /// </summary>
    public OrderDeliveryAddressDto? OrderDeliveryAddress { get; set; }

    /// <summary>
    /// Label of a custom stop.
    /// </summary>
    public string? Label { get; set; }

    /// <summary>
    /// Note of a custom stop.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Latitude of a custom stop.
    /// </summary>
    public decimal? Latitude { get; set; }

    /// <summary>
    /// Longitude of a custom stop.
    /// </summary>
    public decimal? Longitude { get; set; }

    /// <summary>
    /// Products to be delivered at this stop (order stops only)
    /// </summary>
    public List<OutgoingShipmentOrderItemDto> Products { get; set; } = [];

    /// <summary>
    /// Returnable items the client hands back against this stop's order (order
    /// stops only — always empty for custom stops). Read-only here; returns are
    /// owned and edited by the order.
    /// </summary>
    public List<OrderReturnDto> Returns { get; set; } = [];

    /// <summary>
    /// Items the client wants that no brewery supplies (order stops only; always empty
    /// for a custom stop). Read-only here — they are owned and edited by the order.
    /// </summary>
    public List<OrderCustomExtraItemDto> CustomExtraItems { get; set; } = [];

    /// <summary>
    /// Free-form notes on the stop's order, oldest first (order stops only; always
    /// empty for a custom stop, which has its own single <see cref="Note"/>).
    /// Read-only here — they are owned and edited by the order.
    /// </summary>
    public List<OrderNoteDto> Notes { get; set; } = [];
}

public record OutgoingShipmentProductDto
{
    /// <summary>
    /// ID of the product
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Name of the product
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Quantity of the product to be delivered
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Kind of the product
    /// </summary>
    public ProductKind? Kind { get; set; }
    
    /// <summary>
    /// Size of the whole package
    /// </summary>
    public double? PackageSize { get; set; }

    /// <summary>
    /// Degree of the beer — 10, 11, 12. Null for anything that is not brewed to one.
    /// </summary>
    public float? PlatoDegree { get; set; }

    /// <summary>
    /// Type of the product. Carried because the nakládka re-groups the rows by kind
    /// and has to order inside those groups itself: without the type it cannot tell a
    /// limonáda (which belongs last) from a beer with no degree recorded.
    /// </summary>
    public ProductType? Type { get; set; }

    /// <summary>
    /// Weight of the product in kilograms
    /// </summary>
    public double? Weight { get; set; }

    /// <summary>
    /// ID of the brewery supplying the product. The nakládka sections its rows by brewery,
    /// and it aggregates across every stop, so the key has to travel on each line.
    /// </summary>
    public Guid BreweryId { get; set; }

    /// <summary>
    /// Name of that brewery — the nakládka's section heading.
    /// </summary>
    public string BreweryName { get; set; } = null!;

    /// <summary>
    /// The brewery's own display order, so the sections read in the app-wide brewery order
    /// rather than in whichever order the stops happened to introduce them.
    /// </summary>
    public int BreweryDisplayOrder { get; set; }

    /// <summary>
    /// Flag indicating whether the loading in a related outgoing shipment is confirmed.
    /// </summary>
    public bool IsShipmentLoadingConfirmed { get; set; }
}

/// <summary>
/// Data transfer object representing a product item in an outgoing shipment taken from an order.
/// </summary>
public sealed record OutgoingShipmentOrderItemDto : OutgoingShipmentProductDto
{
    /// <summary>
    /// ID of the related order item
    /// </summary>
    public Guid OrderItemId { get; set; }

    /// <summary>
    /// The order line's own note — an instruction for whoever loads or delivers it.
    /// Read-only here; owned and edited by the order.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// How many of <see cref="OutgoingShipmentProductDto.Quantity"/> pieces come from our
    /// own stock rather than the brewery. Zero when the brewery supplied all of them.
    /// </summary>
    public int QuantityFromInventory { get; set; }

    /// <summary>
    /// Stock entry the sourced pieces come from. Null when nothing is sourced.
    /// </summary>
    public Guid? InventoryItemId { get; set; }

    /// <summary>
    /// Display name of that stock entry, so the nakládka can name the source.
    /// </summary>
    public string? InventoryItemName { get; set; }

    /// <summary>
    /// Pieces currently on hand in that stock entry, for the over-draw warning.
    /// </summary>
    public int? InventoryItemAvailable { get; set; }
}

/// <summary>
/// One supplier good the run has to bring, and where it comes from.
/// </summary>
public sealed record OutgoingShipmentSupplierGoodDto
{
    /// <summary>Public ID of the order line this came from.</summary>
    public Guid Id { get; set; }

    /// <summary>Public ID of the ordered good.</summary>
    public Guid SupplierGoodId { get; set; }

    /// <summary>Name of the good, such as "CO₂ láhev".</summary>
    public string Name { get; set; } = null!;

    /// <summary>Size as the supplier states it — "10 kg", "50 l".</summary>
    public string? Size { get; set; }

    /// <summary>Quantity the order asks for.</summary>
    public int Quantity { get; set; }

    /// <summary>
    /// The good's standing default, which seeded <see cref="QuantityFromGarage"/>. Carried so
    /// the screen can say what the arrangement normally is, not to decide anything.
    /// </summary>
    public SupplierGoodPickupSource PickupSource { get; set; }

    /// <summary>
    /// How many of <see cref="Quantity"/> come off our own shelf; the rest is collected at the
    /// supplier. This — not <see cref="PickupSource"/> — is what the run acts on.
    /// </summary>
    public int QuantityFromGarage { get; set; }

    /// <summary>
    /// Pieces of this good currently in the garage, for the over-draw warning. Null when the
    /// warehouse does not track it at all, which is different from tracking zero.
    /// </summary>
    public int? GarageAvailable { get; set; }

    /// <summary>Public ID of the supplier whose price list it is on.</summary>
    public Guid SupplierId { get; set; }

    /// <summary>Name of that supplier.</summary>
    public string SupplierName { get; set; } = null!;

    /// <summary>
    /// That supplier's registered seat — where a pickup stop for it would be.
    /// </summary>
    /// <remarks>
    /// Carried so the screen can render a pickup stop the moment the split calls for one, rather
    /// than waiting for the run to be re-read to learn where it is. The server remains the
    /// authority on whether the stop exists; this only spares the client a round trip to draw it.
    /// </remarks>
    public AddressDto? SupplierAddress { get; set; }

    /// <summary>Public ID of the client who ordered it, so the card can say who it is for.</summary>
    public Guid? ClientId { get; set; }

    /// <summary>Name of that client.</summary>
    public string? ClientName { get; set; }

    /// <summary>Public ID of the order it sits on.</summary>
    public Guid? OrderId { get; set; }

    /// <summary>The order line's own note, when it carries one.</summary>
    public string? Note { get; set; }
}

/// <summary>
/// Data transfer object representing a product item in an outgoing shipment to be delivered to the inventory
/// </summary>
public sealed record OutgoingShipmentStockPurchaseItemDto : OutgoingShipmentProductDto
{
    /// <summary>
    /// ID of the related product
    /// </summary>
    public Guid ProductId { get; set; }
}


