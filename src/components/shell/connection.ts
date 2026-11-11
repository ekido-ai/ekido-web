import type { Tone } from "@/components/ui/status";
import type { Connection } from "@/lib/live/live-source";

export const connectionView: Record<Connection, { tone: Tone; label: string }> = {
  idle: { tone: "idle", label: "Not connected" },
  connecting: { tone: "active", label: "Connecting" },
  live: { tone: "good", label: "Connected" },
  reconnecting: { tone: "warning", label: "Reconnecting" },
  offline: { tone: "critical", label: "Offline, still retrying" },
};
