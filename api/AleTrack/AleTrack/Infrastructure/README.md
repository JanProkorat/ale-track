## Migrations
**Add migration:** In folder Infrastructure run command `dotnet ef migrations add {migrationName} --startup-project ../AleTrack.csproj --context AleTrackDbContext`
**Apply migration:** In folder Infrastructure run command `dotnet ef database update --startup-project ../AleTrack.csproj --context AleTrackDbContext`