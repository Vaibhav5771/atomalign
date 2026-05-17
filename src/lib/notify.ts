import { supabase } from "@/lib/supabase";

export type NotifyEvent =
  | "submitted"
  | "approved"
  | "returned"
  | "checkin_saved"
  | "user_created";

interface BaseNotifyArgs {
  actorId: string;
  remark?: string;
  quarter?: string;
}

interface SheetNotifyArgs extends BaseNotifyArgs {
  event: "submitted" | "approved" | "returned" | "checkin_saved";
  sheetId: string;
}

interface UserCreatedArgs extends BaseNotifyArgs {
  event: "user_created";
  recipientId: string;
  password?: string;
}

type NotifyArgs = SheetNotifyArgs | UserCreatedArgs;

// Fire-and-forget wrapper around the `notify` Supabase Edge Function.
// Failures (function not deployed, SMTP/Teams down, network error) are
// logged to the console but never thrown — notifications are best-effort
// and must NOT block the user's primary action.
export function notify(args: NotifyArgs): void {
  void (async () => {
    try {
      const body: Record<string, unknown> = {
        event: args.event,
        actor_id: args.actorId,
        remark: args.remark,
        quarter: args.quarter,
      };
      if (args.event === "user_created") {
        body.recipient_id = args.recipientId;
        if (args.password) body.password = args.password;
      } else {
        body.sheet_id = args.sheetId;
      }
      const { error } = await supabase.functions.invoke("notify", { body });
      if (error) console.warn("[notify] edge function error", error);
    } catch (e) {
      console.warn("[notify] invoke failed", e);
    }
  })();
}
