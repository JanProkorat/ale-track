using AleTrack.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AleTrack.Infrastructure.Persistence.Configurations;

public static class ModelBuilderExtensions
{
    public static OwnedNavigationBuilder<TEntity, Address> OwnsAddressWithPrefix<TEntity>(
        this OwnedNavigationBuilder<TEntity, Address> ownedNavigationBuilder,
        string prefix)
        where TEntity : class
    {
        ownedNavigationBuilder.Property(a => a.StreetName).HasColumnName($"{prefix}_{ToSnakeCase(nameof(Address.StreetName))}");
        ownedNavigationBuilder.Property(a => a.StreetNumber).HasColumnName($"{prefix}_{ToSnakeCase(nameof(Address.StreetNumber))}");
        ownedNavigationBuilder.Property(a => a.City).HasColumnName($"{prefix}_{ToSnakeCase(nameof(Address.City))}");
        ownedNavigationBuilder.Property(a => a.Zip).HasColumnName($"{prefix}_{ToSnakeCase(nameof(Address.Zip))}");
        ownedNavigationBuilder.Property(a => a.Country).HasColumnName($"{prefix}_{ToSnakeCase(nameof(Address.Country))}");

        return ownedNavigationBuilder;
    }

    private static string ToSnakeCase(string input)
    {
        if (string.IsNullOrEmpty(input))
            return input;

        var builder = new System.Text.StringBuilder();
        for (int i = 0; i < input.Length; i++)
        {
            var c = input[i];
            if (char.IsUpper(c))
            {
                if (i > 0)
                    builder.Append('_');
                builder.Append(char.ToLowerInvariant(c));
            }
            else
            {
                builder.Append(c);
            }
        }

        return builder.ToString();
    }
}