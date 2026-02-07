using AleTrack.Common.Enums;

namespace AleTrack.Common.Utils;

public static class PlanningStateExtensions
{
    public static PlanningState? GetPlanningState(this Dictionary<string, string> parameters)
    {
        var planningStateFilter = parameters.FirstOrDefault(p => p.Key.ToLower() == nameof(PlanningState).ToLower());
        if (planningStateFilter.Value is null)
            return null;
        
        var planningStateString = planningStateFilter.Value.Split(":").Last();
        if (!Enum.TryParse(planningStateString, out PlanningState planningState))
            return null;
        
        parameters.Remove(planningStateFilter.Key);
        
        return planningState;
    }
}