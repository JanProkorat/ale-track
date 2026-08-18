using AleTrack.Common.Models;
using AleTrack.Common.Enums;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Suppliers.Commands.Create;
using AleTrack.Features.Suppliers.Commands.Delete;
using AleTrack.Features.Suppliers.Commands.Update;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Moq;

namespace AleTrack.Tests.Features.Suppliers;

public sealed class CreateSupplierTests
{
    [Fact]
    public async Task ProcessAsync_CreateSupplier_Success()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateSupplierRequest
        {
            Data = SupplierBuilder.BuildCreateDto(
                name: "Linde Gas — plnírna Liberec",
                businessName: "Linde Gas a.s.",
                note: "Plnírna je za vrátnicí vpravo.",
                officialAddress: AddressBuilder.BuildDto(city: "Praha"),
                contactAddress: AddressBuilder.BuildDto(city: "Liberec"),
                contacts:
                [
                    new SupplierContactUpsertDto
                    {
                        Type = ContactType.Phone,
                        Description = "Plnírna",
                        Value = "+420 485 100 240"
                    },
                    new SupplierContactUpsertDto
                    {
                        Type = ContactType.Email,
                        Description = "Objednávky",
                        Value = "liberec@linde-gas.cz"
                    }
                ])
        };

        var endpoint = EndpointBuilder<CreateSupplierRequest, CreateSupplierEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Suppliers.Add(It.Is<Supplier>(s =>
            s.Name == command.Data.Name &&
            s.BusinessName == command.Data.BusinessName &&
            s.Note == command.Data.Note &&
            s.OfficialAddress.City == command.Data.OfficialAddress.City &&
            s.ContactAddress != null &&
            s.ContactAddress.City == command.Data.ContactAddress!.City &&
            s.Contacts.Count == 2 &&
            s.Contacts.All(c => command.Data.Contacts.Any(rc =>
                c.Type == rc.Type && c.Description == rc.Description && c.Value == rc.Value))
        )), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_CreateSupplier_WithoutContactAddress_LeavesItNull()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new CreateSupplierRequest { Data = SupplierBuilder.BuildCreateDto(contactAddress: null) };

        var endpoint = EndpointBuilder<CreateSupplierRequest, CreateSupplierEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Suppliers.Add(It.Is<Supplier>(s => s.ContactAddress == null)), Times.Once);
    }
}

public sealed class UpdateSupplierTests
{
    [Fact]
    public async Task ProcessAsync_UpdateSupplier_Success()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(
            publicId: supplierId,
            name: "Old Name",
            businessName: "Old Business",
            note: "Old note",
            contacts: [new SupplierContact { Type = ContactType.Phone, Value = "+420 000 000 000" }]);

        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var command = new UpdateSupplierRequest
        {
            Id = supplierId,
            Data = SupplierBuilder.BuildUpdateDto(
                name: "Gastro Plyn Žitava",
                businessName: "Gastro Gas Zittau GmbH",
                note: "Platba jen kartou.",
                officialAddress: AddressBuilder.BuildDto(city: "Žitava", zip: "02763"),
                contacts:
                [
                    new SupplierContactUpsertDto
                    {
                        Type = ContactType.Email,
                        Description = "Info",
                        Value = "info@gastrogas-zittau.de"
                    }
                ])
        };

        var endpoint = EndpointBuilder<UpdateSupplierRequest, UpdateSupplierEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        supplier.Name.Should().Be("Gastro Plyn Žitava");
        supplier.BusinessName.Should().Be("Gastro Gas Zittau GmbH");
        supplier.Note.Should().Be("Platba jen kartou.");
        supplier.OfficialAddress.City.Should().Be("Žitava");
        supplier.Contacts.Should().HaveCount(1);
        supplier.Contacts.Single().Value.Should().Be("info@gastrogas-zittau.de");
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// The branch address has to be clearable — unticking "provozovna je na jiné adrese" must
    /// actually unset it. <c>UpdateClientEndpoint</c> only ever assigns a non-null contact
    /// address, so this is the behaviour that differs and therefore the one worth pinning.
    /// </summary>
    [Fact]
    public async Task ProcessAsync_UpdateSupplier_NullContactAddress_ClearsIt()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(
            publicId: supplierId,
            contactAddress: AddressBuilder.BuildEntity(city: "Liberec"));

        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var command = new UpdateSupplierRequest
        {
            Id = supplierId,
            Data = SupplierBuilder.BuildUpdateDto(contactAddress: null)
        };

        var endpoint = EndpointBuilder<UpdateSupplierRequest, UpdateSupplierEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        supplier.ContactAddress.Should().BeNull();
    }

    [Fact]
    public async Task ProcessAsync_UpdateSupplier_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new UpdateSupplierRequest
        {
            Id = Guid.NewGuid(),
            Data = SupplierBuilder.BuildUpdateDto()
        };

        var endpoint = EndpointBuilder<UpdateSupplierRequest, UpdateSupplierEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}

public sealed class DeleteSupplierTests
{
    [Fact]
    public async Task ProcessAsync_DeleteSupplier_Success()
    {
        var supplierId = Guid.NewGuid();
        var supplier = SupplierBuilder.BuildEntity(publicId: supplierId);
        var dbContext = AleTrackDbContextMockFactory.CreateMock(suppliers: [supplier]);

        var command = new DeleteSupplierRequest { Id = supplierId };

        var endpoint = EndpointBuilder<DeleteSupplierRequest, DeleteSupplierEndpoint>.Create(dbContext.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        dbContext.Verify(e => e.Suppliers.Remove(supplier), Times.Once);
        dbContext.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessAsync_DeleteSupplier_NotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();

        var command = new DeleteSupplierRequest { Id = Guid.NewGuid() };

        var endpoint = EndpointBuilder<DeleteSupplierRequest, DeleteSupplierEndpoint>.Create(dbContext.Object);

        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);

        await act.Should().ThrowAsync<AleTrackException>().Where(e => e.ErrorCode == ErrorCodes.NotfoundError);
    }
}
