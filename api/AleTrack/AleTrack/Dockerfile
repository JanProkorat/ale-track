# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy all csproj files to restore dependencies
COPY AleTrack/*.csproj ./AleTrack/

# Restore dependencies
RUN dotnet restore AleTrack/AleTrack.csproj

# Copy everything and build
COPY . ./
WORKDIR /src/AleTrack
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .

# DEBUG - vypište co je v kontejneru
RUN ls -la /app/*.json

# Expose port (Render will set the PORT environment variable)
EXPOSE $PORT

ENTRYPOINT ["dotnet", "AleTrack.dll"]