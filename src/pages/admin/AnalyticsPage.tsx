import { useEffect } from "react";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { useAnalyticsStore } from "@/stores/analyticsStore";

export default function AnalyticsPage() {
  const { summary, loading, error, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold">Analytics Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          QoQ trends, goal distribution, team completion, and manager effectiveness —
          powered by the <code>analytics_summary</code> view.
        </p>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Could not load analytics: {error}
        </div>
      )}

      <AnalyticsDashboard rows={summary} loading={loading} />
    </div>
  );
}
