import type { SVGProps } from "react";

/*
 * Ekido's own product icons, one per part of the service. Same grid (24 px), same 1.75 stroke in the current text colour,
 * and one saffron mark in each that says what the part does. They replace the generic icon pack on the product pages.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ACCENT = "#fe5000";

/** A speech bubble with a spark: describe the job in plain words. */
function Assistant(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.4c-.5.4-1.3 0-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" />
      <path d="M12 7.2l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill={ACCENT} stroke="none" />
    </svg>
  );
}

/** Three devices in a relay, the middle one lit: training that carries on. */
function Train(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="5.5" cy="17.5" r="2.2" />
      <circle cx="18.5" cy="6.5" r="2.2" />
      <path d="M7.4 16.4l2.7-2M13.9 10l2.7-2" />
      <circle cx="12" cy="12" r="2.4" fill={ACCENT} stroke={ACCENT} />
    </svg>
  );
}

/** A gate with a tick: the quality check. */
function Verify(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8.4 12.3l2.6 2.6 4.8-5.2" stroke={ACCENT} strokeWidth={2.25} />
    </svg>
  );
}

/** Two server slots, one running: hosting. */
function Host(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4.5" width="16" height="6" rx="2" />
      <rect x="4" y="13.5" width="16" height="6" rx="2" />
      <circle cx="7.6" cy="7.5" r="1.1" fill={ACCENT} stroke="none" />
      <circle cx="7.6" cy="16.5" r="1.1" fill={ACCENT} stroke="none" />
      <path d="M11.5 7.5h5M11.5 16.5h5" />
    </svg>
  );
}

/** A coin with a rupee bar: pay only for accepted work. */
function Pay(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.8 8.2h6.4M8.8 11h6.4" />
      <path d="M9.2 8.2h1.6a2.4 2.4 0 0 1 0 4.8H9.2l5 4" stroke={ACCENT} strokeWidth={2} />
    </svg>
  );
}

/** A laptop and a phone: the devices that do the work. */
function Devices(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="13" height="9" rx="1.8" />
      <path d="M2 17.5h16" />
      <rect x="15.5" y="9" width="5.5" height="10" rx="1.6" fill="var(--surface, #fff)" />
      <path d="M17.4 17h1.7" stroke={ACCENT} strokeWidth={2} />
    </svg>
  );
}

const ICONS = { assistant: Assistant, train: Train, verify: Verify, host: Host, pay: Pay, devices: Devices } as const;

export type ProductIconKey = keyof typeof ICONS;

export function ProductIcon({ name, ...props }: IconProps & { name: string }) {
  const Icon = ICONS[name as ProductIconKey] ?? Train;
  return <Icon aria-hidden {...props} />;
}
