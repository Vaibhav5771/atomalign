import { useEffect } from "react";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useAnalyticsStore } from "@/stores/analyticsStore";

export default function AnalyticsPage() {
  const { summary, loading, error, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  useFocusRefresh(() => {
    void fetchAnalytics();
  });

  return (
    <div className="space-y-5 max-w-7xl">
      <BlurFade>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight leading-tight">
            Analytics Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            QoQ trends, goal distribution, team completion, and manager effectiveness —
            powered by the <code>analytics_summary</code> view.
          </p>
        </div>
      </BlurFade>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Could not load analytics: {error}
        </div>
      )}

      <AnalyticsDashboard
        rows={summary}
        loading={loading}
        onRefresh={() => {
          void fetchAnalytics();
        }}
        refreshing={loading}
      />
    </div>
  );
}
