# GPUChain web app

Next.js 16 + TypeScript + Tailwind 4. The app has the shell, design system and landing page, on top of the data layer: event types, the reducer, derived views, replay, and the adapter that turns real coordinator events into the UI's format. The pages below are all in `main`.

```bash
npm ci
npx tsc --noEmit
npm test                    # events, translation, live source, replay, wallet, pricing, receipts
npm run build
npx next start -p 3100      # the coordinator only accepts this dashboard from ports 3000 and 3100
```

Config: copy `.env.example` to `.env.local`. `NEXT_PUBLIC_*` values are baked in at build time.

## Data sources

Every screen reads one event source, chosen in `src/lib/events/source-context.tsx`:

- **Live** (default): follows the newest job through `GET /jobs` and `WS /ws/jobs/{id}?after=N`. `src/lib/live/translate.ts` turns real events into the UI's format. Event types it doesn't know are ignored.
- **Replay**: plays `replay/recordings/*.json`. Every page shows a RECORDED badge in the shell while a recording plays (SAMPLE for hand-written sample data); live data never shows it (`src/lib/events/truth.ts`). The CPU fallback shows SYNTHETIC. `real-run.json` is a recording of a real run. Pick it on **Data source** (`/replay`), or open `/dashboard?at=0&play=4` to start it from the beginning at 4x with no backend.

`npm run mock` (port 8787) serves hand-written sample data for local work. It isn't used in the demo.

## Layout

| Path | What |
|---|---|
| `src/lib/events/` | Event types, reducer, derived views, journey and moments |
| `src/lib/replay/player.ts` | Replay with timing, speed, seek |
| `src/lib/live/` | Real coordinator source and event translation |
| `src/lib/config.ts` | `NEXT_PUBLIC_*` runtime config |
| `src/lib/wallet/` | Wallet session and escrow calls (viem) |
| `src/lib/chain/`, `src/lib/receipt/`, `src/lib/pricing.ts` | Chain reads, receipts, pricing |
| `src/components/ui/` | UI kit: buttons, panels, stats, states, status, timeline |
| `src/components/shell/` | App shell, navigation, theme toggle, replay bar, toasts |
| `src/components/landing/`, `src/components/nexora/` | Landing page sections |
| `src/components/mission/` | Mission control: providers, loss chart, recovery timeline, payout, kill control |
| `src/app/` | Layout, landing page, `/dashboard`, `/replay`, error and not-found pages |
| `replay/` | Recordings, sample generator, mock coordinator |

## Pages

| Route | What |
|---|---|
| `/` | Landing page |
| `/dashboard` | Mission control: the running job, providers, recovery and payout |
| `/recovery` | Recovery detail |
| `/quality` | Quality result |
| `/settlement` | Settlement and the itemised receipt |
| `/earnings` | Earnings |
| `/verify` | Re-check a payout in the browser |
| `/jobs/new` | New job: create and fund a signed job on Base Sepolia |
| `/provide` | Provider onboarding and kit download |
| `/account` | Your account: sign in with a wallet |
| `/chain` | On-chain ledger |
| `/replay` | Data source: live or a recorded run |
| `/status` | Status checks run from the browser |
| `/admin` | Owner console |
| `/help`, `/privacy`, `/security`, `/terms` | Help and policy pages |
| `/kit` | Component gallery |

## Design

Light and dark themes come from CSS tokens in `src/app/globals.css`, switched by the theme toggle. Animations are turned off when the system asks for reduced motion (`prefers-reduced-motion` in `globals.css` and the motion components). Status is never shown by color alone: each tone has its own icon and label (`src/components/ui/status.tsx`).

## Verify

`/verify` reads a settlement transaction from the chain and re-checks it in the browser: it recovers the verifier signers, recomputes the lineage root and each payout, and shows pass or fail with a plain explanation. It does not prove that training ran or that the verifiers were honest; the page lists what it doesn't prove.

## Accessibility and mobile

Checked on every page at 360 px wide, in light and dark, with a headless browser:

- No sideways scroll (`.app-backdrop` clips horizontal overflow in `src/app/globals.css`).
- Body and muted text meet WCAG AA (4.5:1) against the page and panel backgrounds. The muted text colour and the light-theme danger button colour were adjusted for this.
- Tab reaches every control and each one shows a focus ring (checked over the first 45 tab stops of each page).
- Reduced motion: with `prefers-reduced-motion` on, no animation keeps running on `/`, `/dashboard` or `/provide`.

Not covered: text on gradient backgrounds, disabled controls (exempt from the contrast rule), pages with live data (the checks ran without a coordinator), and a screen reader.
