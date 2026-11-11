"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import realRun from "../../../replay/recordings/real-run.json";
import { config } from "../config";
import type { Connection } from "../live/live-source";
import { RealLiveSource, type RealSnapshot } from "../live/real-source";
import { recordingFromRealRun, type RealRecording } from "../live/translate";
import { ReplayPlayer, type PlayerSnapshot } from "../replay/player";
import type { DashboardState } from "./reduce";

/** Every job start_demo_job.py runs has this budget unless told otherwise, including the recorded one. */
const RECORDED_BUDGET_USDC = "5";

export type SourceMode = "replay" | "live";

/** Where the numbers on screen come from. Drives the header truth badge. */
export type Provenance = "sample" | "recorded" | "live";

export interface SourceView {
  mode: SourceMode;
  state: DashboardState;
  provenance: Provenance;
  /** Live mode only. */
  connection: Connection | null;
  live: RealSnapshot;
}

interface Ctx {
  player: ReplayPlayer;
  live: RealLiveSource;
  mode: SourceMode;
  setMode: (m: SourceMode) => void;
  /** Point the live stream at a specific job (after creating one). */
  followJob: (jobId: string) => void;
  /** Switch to the recorded run and play it from the start (the offline fallback). */
  watchRecording: (speed?: number) => void;
}

const SourceContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "gpuchain.source";

function readStoredMode(): SourceMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "live" || v === "replay" ? v : null;
  } catch {
    return null;
  }
}

/**
 * All screens read data through this provider. Two sources share one shape:
 * the replay player (recorded events) and the live coordinator stream.
 */
export function EventSourceProvider({ children }: { children: React.ReactNode }) {
  const [player] = useState(() => new ReplayPlayer(recordingFromRealRun(realRun as unknown as RealRecording, RECORDED_BUDGET_USDC)));
  const [live] = useState(() => new RealLiveSource(config.coordinatorUrl));
  const [mode, setModeState] = useState<SourceMode>(config.defaultSource);
  const autoplaySpeed = useRef(0);

  // Restore the viewer's last choice after hydration (per-browser convenience only).
  // `?at=<seconds>` opens the replay at that moment: for rehearsals and screenshots.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const job = query.get("job");
    if (job && /^[a-f0-9-]{36}$/.test(job)) live.selectJob(job);
    if (query.get("source") === "live") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- honor an explicit URL after hydration
      setModeState("live");
      return;
    }
    const at = query.get("at");
    if (at !== null && Number.isFinite(Number(at))) {
      setModeState("replay");
      player.seek(Number(at) * 1000);
      // `&play=4` starts it straight away at that speed, for showing the recording to someone.
      autoplaySpeed.current = Number(query.get("play")) || 0;
      return;
    }
    const stored = readStoredMode();
    if (stored) setModeState(stored);
  }, [player, live]);

  useEffect(() => {
    if (mode !== "live") {
      // Waits for the switch to replay, because the effect below pauses the player while still live.
      if (autoplaySpeed.current > 0) {
        player.setSpeed(autoplaySpeed.current);
        player.play();
        autoplaySpeed.current = 0;
      }
      return;
    }
    player.pause();
    live.start();
    return () => live.stop();
  }, [mode, live, player]);

  useEffect(() => () => player.pause(), [player]);

  const setMode = useCallback((m: SourceMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* storage blocked: the choice just won't persist */
    }
  }, []);

  const followJob = useCallback(
    (jobId: string) => {
      live.selectJob(jobId);
      setMode("live");
    },
    [live, setMode],
  );

  const watchRecording = useCallback(
    (speed = 2) => {
      setMode("replay");
      player.seek(0);
      player.setSpeed(speed);
      player.play();
    },
    [player, setMode],
  );

  const value = useMemo(
    () => ({ player, live, mode, setMode, followJob, watchRecording }),
    [player, live, mode, setMode, followJob, watchRecording],
  );
  return <SourceContext.Provider value={value}>{children}</SourceContext.Provider>;
}

function useCtx(): Ctx {
  const c = useContext(SourceContext);
  if (!c) throw new Error("Must be used inside <EventSourceProvider>");
  return c;
}

export function usePlayer(): ReplayPlayer {
  return useCtx().player;
}

export function usePlayerSnapshot(): PlayerSnapshot {
  const p = usePlayer();
  return useSyncExternalStore(p.subscribe, p.getSnapshot, p.getSnapshot);
}

export function useSourceControl() {
  const { mode, setMode, followJob, watchRecording, live } = useCtx();
  /** Ask the coordinator again right now instead of waiting for the next poll. */
  const retryLive = useCallback(() => live.reset(), [live]);
  return { mode, setMode, followJob, watchRecording, retryLive };
}

/** The one hook screens use for data. */
export function useDashboard(): SourceView {
  const { player, live, mode } = useCtx();
  const p = useSyncExternalStore(player.subscribe, player.getSnapshot, player.getSnapshot);
  const l = useSyncExternalStore(live.subscribe, live.getSnapshot, live.getSnapshot);
  if (mode === "live") {
    return {
      mode,
      state: l.state,
      provenance: "live",
      connection: l.connection,
      live: l,
    };
  }
  return { mode, state: p.state, provenance: player.recording.provenance, connection: null, live: l };
}
