"use client";

import { useEffect, useState } from "react";
import { config } from "@/lib/config";
import { watchProviders, type ProviderState, type ProviderStatus, type WatchOptions } from "./providers";

/** The coordinator's provider list, refreshed every 10 s while the tab is visible. null until the first answer. */
export function useProviders<T extends ProviderStatus>(options: Pick<WatchOptions, "intervalMs" | "timeoutMs"> = {}): ProviderState<T> {
  const [state, setState] = useState<ProviderState<T>>(null);
  const { intervalMs, timeoutMs } = options;
  useEffect(() => watchProviders<T>(config.coordinatorUrl, setState, { intervalMs, timeoutMs }), [intervalMs, timeoutMs]);
  return state;
}
