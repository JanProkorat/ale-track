using AleTrack.Common.Enums;
using AleTrack.Common.Models;
using AleTrack.Common.Utils;
using AleTrack.Entities;
using AleTrack.Features.Users.Commands.Login;
using AleTrack.Features.Users.Utils;
using AleTrack.Tests.Builders;
using AleTrack.Tests.Mocks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

namespace AleTrack.Tests.Features.Users;

public sealed class LoginTests
{
    [Fact]
    public async Task ProcessAsync_Login_Success()
    {
        var userName = "testuser";
        var password = "testpassword123";
        var hashedPassword = "hashed_password_123";
        var expectedToken = "jwt_token_abc123";
        
        var user = UserBuilder.BuildEntity(
            userName: userName,
            password: hashedPassword,
            userRoles: [new() { Type = UserRoleType.User }]
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [user]);
        var passwordHasher = new Mock<IPasswordHasher>();
        var jwtService = new Mock<IJwtService>();
        
        passwordHasher.Setup(p => p.VerifyPassword(password, hashedPassword)).Returns(true);
        jwtService.Setup(j => j.GenerateToken(user)).Returns(expectedToken);

        var command = new LoginRequest
        {
            Data = UserBuilder.BuildLoginDto(
                userName: userName,
                password: password
            )
        };

        var endpoint = EndpointWithResponseBuilder<LoginRequest, LoginResponse, LoginEndpoint>.Create(dbContext.Object, passwordHasher.Object, jwtService.Object);
        await endpoint.HandleAsync(command, CancellationToken.None);

        // Verify password verification was called with correct parameters
        passwordHasher.Verify(p => p.VerifyPassword(password, hashedPassword), Times.Once);
        
        // Verify JWT token generation was called with correct user
        jwtService.Verify(j => j.GenerateToken(user), Times.Once);
        
        // Note: Since we're using FastEndpoints, the response is handled internally
        // and we can't directly access it in tests. We verify the mocks were called correctly.
    }
    
    [Fact]
    public async Task ProcessAsync_Login_UserNotFound()
    {
        var dbContext = AleTrackDbContextMockFactory.CreateMock();
        var passwordHasher = new Mock<IPasswordHasher>();
        var jwtService = new Mock<IJwtService>();

        var command = new LoginRequest
        {
            Data = UserBuilder.BuildLoginDto(
                userName: "nonexistentuser",
                password: "anypassword"
            )
        };

        var endpoint = EndpointWithResponseBuilder<LoginRequest, LoginResponse, LoginEndpoint>.Create(dbContext.Object, passwordHasher.Object, jwtService.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.StatusCode == StatusCodes.Status401Unauthorized && 
                       e.ErrorCode == UserErrorCodes.UserNotFoundError);
                       
        // Verify that password verification and token generation were not called
        passwordHasher.Verify(p => p.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        jwtService.Verify(j => j.GenerateToken(It.IsAny<Entities.User>()), Times.Never);
    }
    
    [Fact]
    public async Task ProcessAsync_Login_InvalidPassword()
    {
        var userName = "testuser";
        var password = "wrongpassword";
        var hashedPassword = "hashed_password_123";
        
        var user = UserBuilder.BuildEntity(
            userName: userName,
            password: hashedPassword
        );

        var dbContext = AleTrackDbContextMockFactory.CreateMock(users: [user]);
        var passwordHasher = new Mock<IPasswordHasher>();
        var jwtService = new Mock<IJwtService>();
        
        passwordHasher.Setup(p => p.VerifyPassword(password, hashedPassword)).Returns(false);

        var command = new LoginRequest
        {
            Data = UserBuilder.BuildLoginDto(
                userName: userName,
                password: password
            )
        };

        var endpoint = EndpointWithResponseBuilder<LoginRequest, LoginResponse, LoginEndpoint>.Create(dbContext.Object, passwordHasher.Object, jwtService.Object);

        // Act
        var act = async () => await endpoint.HandleAsync(command, CancellationToken.None);
        
        // Assert
        await act.Should().ThrowAsync<AleTrackException>()
            .Where(e => e.StatusCode == StatusCodes.Status401Unauthorized && 
                       e.ErrorCode == UserErrorCodes.InvalidPasswordError);
                       
        // Verify password verification was called but token generation was not
        passwordHasher.Verify(p => p.VerifyPassword(password, hashedPassword), Times.Once);
        jwtService.Verify(j => j.GenerateToken(It.IsAny<User>()), Times.Never);
    }
}
