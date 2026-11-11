# GPUChain dashboard

Prateek's UI joined to the real coordinator. Next.js 16 + TypeScript + Tailwind 4. Design rules: [`docs/design-direction.md`](../../docs/design-direction.md).

```bash
npm install
npm run build
npx next start -p 3100      # the coordinator only accepts this dashboard from ports 3000 and 3100
npm test                    # events, translation, live source, payout checks, job form
```

Start a stack first (`docs/demo-runbook.md`), then open http://127.0.0.1:3100. With the CPU stack, **Start demo job** appears on the main screen.

Config: copy `.env.example` to `.env.local`. `NEXT_PUBLIC_*` values are baked in at build time.

## Data sources

Every screen reads `useDashboard()`. Pick the source on **Data source** (`/replay`):

- **Live** (default): follows the newest job through `GET /jobs` and `WS /ws/jobs/{id}?after=N`. `src/lib/live/translate.ts` turns real events into the UI's format.
- **Replay**: plays `replay/recordings/*.json`, labelled on screen. `real-run.json` is a recording of a real run. `/?at=0&play=4` starts it from the beginning at 4x.

The older mock (`npm run mock`, port 8787) serves hand-written sample data, and isn't used in the demo.

## Layout

| Path | What |
|---|---|
| `src/lib/events/` | Draft event types, reducer, derived views |
| `src/lib/replay/player.ts` | Replay with timing, speed, seek |
| `src/lib/live/` | Real coordinator source and event translation |
| `src/lib/verify/` | Re-checks a settled payout from chain data, in the browser |
| `src/lib/jobs/spec.ts` | New-job form rules and request body |
| `src/lib/wallet/escrow.ts` | Wallet flow: connect, network, exact approve, createJob (viem) |
| `src/components/` | UI kit, shell, mission control, job flow |
| `replay/` | Recordings, sample generator, mock coordinator |

## Pages

`/` mission control · `/recovery` compile decisions · `/quality` Quality Guard · `/settlement` payout · `/verify` re-check a payout ·
`/jobs/new` form + wallet · `/replay` data source · `/kit` component gallery.
