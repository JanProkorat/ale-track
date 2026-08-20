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

# Npgsql probes the GSSAPI path while opening its first connection; without this
# library the probe fails with "Cannot load library libgssapi_krb5.so.2" and the
# first connection attempt is slow enough to time out health checks after a cold start.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

# DEBUG - list what ended up in the container
RUN ls -la /app/*.json

# Expose port (Render will set the PORT environment variable)
EXPOSE $PORT

ENTRYPOINT ["dotnet", "AleTrack.dll"]