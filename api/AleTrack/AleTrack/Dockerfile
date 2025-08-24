# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution file if exists
COPY *.sln ./

# Copy all csproj files to restore dependencies
COPY AleTrack/*.csproj ./AleTrack/
COPY AleTrack.Tests/*.csproj ./AleTrack.Tests/

# Restore dependencies
RUN dotnet restore

# Copy everything and build
COPY . ./
WORKDIR /src/AleTrack
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .

# DEBUG - vypište co je v kontejneru
RUN ls -la /app/*.json

# Expose port (Render will set the PORT environment variable)
EXPOSE 8080

ENTRYPOINT ["dotnet", "AleTrack.dll"]