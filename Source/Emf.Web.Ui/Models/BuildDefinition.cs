using System;
using System.Collections.Generic;
using EqualityComparers;
using Microsoft.TeamFoundation.Build.WebApi;
using Newtonsoft.Json;

namespace Emf.Web.Ui.Models
{
    public class BuildDefinition : IEquatable<BuildDefinition>
    {
        public static readonly IEqualityComparer<BuildDefinition> DefaultComparer = EqualityCompare<BuildDefinition>.EquateBy(b => b.Reference);

        [JsonConstructor]
        public BuildDefinition(BuildDefinitionReference reference, Microsoft.TeamFoundation.Build.WebApi.BuildDefinition definition)
        {
            Reference = reference;
        }

        public BuildDefinition(BuildDefinitionReference reference, XamlBuildDefinition xamlDefinition)
        {
            Reference = reference;
        }

        public BuildDefinitionReference Reference { get; }

        public bool Equals(BuildDefinition other) => DefaultComparer.Equals(this, other);
        public override bool Equals(object other) => Equals(other as BuildDefinition);
        public override int GetHashCode() => DefaultComparer.GetHashCode(this);
    }
}