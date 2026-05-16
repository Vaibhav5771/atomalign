import { supabase } from "@/lib/supabase";

export type NotifyEvent = "submitted" | "approved" | "returned" | "checkin_saved";

interface NotifyArgs {
  event: NotifyEvent;
  sheetId: string;
  actorId: string;
  remark?: string;
  quarter?: string;
}

// Fire-and-forget wrapper around the `notify` Supabase Edge Function.
// Failures (function not deployed, Resend/Teams down, network error) are
// logged to the console but never thrown — notifications are best-effort
// and must NOT block the user's primary action.
export function notify(args: NotifyArgs): void {
  void (async () => {
    try {
      const { error } = await supabase.functions.invoke("notify", {
        body: {
          event: args.event,
          sheet_id: args.sheetId,
          actor_id: args.actorId,
          remark: args.remark,
          quarter: args.quarter,
        },
      });
      if (error) console.warn("[notify] edge function error", error);
    } catch (e) {
      console.warn("[notify] invoke failed", e);
    }
  })();
}
