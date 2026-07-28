using AleTrack.Common.Enums;
using AleTrack.Features.OutgoingShipments.Utils;
using FluentAssertions;

namespace AleTrack.Tests.Features.OutgoingShipments;

public sealed class ShipmentMutabilityTests
{
    [Theory]
    [InlineData(OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Delivered, false)]
    [InlineData(OutgoingShipmentState.Cancelled, false)]
    public void IsContentEditable_OnlyWhilePlanning(OutgoingShipmentState state, bool expected) =>
        ShipmentMutability.IsContentEditable(state).Should().Be(expected);

    [Theory]
    // Same state is always a no-op: every content save re-sends the current state.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.Loaded, true)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Delivered, true)]
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Cancelled, true)]
    // Single forward steps.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Loaded, true)]
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.InTransit, true)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Delivered, true)]
    // Single backward steps between the active states.
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.Created, true)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Loaded, true)]
    // Cancel from any active state.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Cancelled, true)]
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.Cancelled, true)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Cancelled, true)]
    // Restore a cancelled run — the shipped restore button.
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Created, true)]
    // Delivered is terminal. This is the transition that unwound invoiced history.
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Created, false)]
    [InlineData(OutgoingShipmentState.Delivered, OutgoingShipmentState.Cancelled, false)]
    // Skipping steps is not allowed.
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Created, OutgoingShipmentState.Delivered, false)]
    [InlineData(OutgoingShipmentState.Loaded, OutgoingShipmentState.Delivered, false)]
    [InlineData(OutgoingShipmentState.InTransit, OutgoingShipmentState.Created, false)]
    // A cancelled run restores to Created only.
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Loaded, false)]
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.InTransit, false)]
    [InlineData(OutgoingShipmentState.Cancelled, OutgoingShipmentState.Delivered, false)]
    public void IsTransitionAllowed_MatchesTheMatrix(
        OutgoingShipmentState from, OutgoingShipmentState to, bool expected) =>
        ShipmentMutability.IsTransitionAllowed(from, to).Should().Be(expected);
}
