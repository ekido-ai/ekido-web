import { createWalletClient, custom, getAddress, isAddress, verifyMessage, type Address, type EIP1193Provider, type Hex } from "viem";
import { baseSepolia } from "viem/chains";

/*
 * Sign in with your wallet (EIP-4361, "Sign-In with Ethereum").
 *
 * There are no passwords or emails to leak. The wallet signs a plain message naming this site, a one-time
 * nonce and an expiry; the browser checks the signature recovers to the address, and keeps the proof in this
 * tab only (sessionStorage). Reading your account needs nothing more, because the chain is public. Anything
 * that moves money is signed by your wallet again, at that moment, so a stolen session can't spend.
 */

export const SESSION_KEY = "gpuchain.session";
export const SESSION_HOURS = 8;
const STATEMENT = "Sign in to GPUChain. This only proves you control this wallet. It costs nothing and allows no transaction.";

export interface Session {
  address: Address;
  message: string;
  signature: Hex;
  expiresAt: number;
  /** A read-only "view as" for demos: no wallet, no signature, and nothing that moves money. */
  demo?: "client" | "provider" | "owner";
}

/** Real Base Sepolia addresses from the one settled job, public on Basescan, used for read-only demo views. */
export const DEMO_ADDRESSES = {
  client: "0x1c4d04718d0FE1FCb23052cCEE2Fe5d2d8FC337f",
  provider: "0xB68bD411876C45469ea19CDa2a7A0adfAF8C8C46",
  owner: "0x915f91f109980C5E810507feD50d5D364d15E074",
} as const;

export function buildMessage(p: { domain: string; uri: string; address: Address; chainId: number; nonce: string; issuedAt: Date; expiresAt: Date }): string {
  return [
    `${p.domain} wants you to sign in with your Ethereum account:`,
    getAddress(p.address),
    "",
    STATEMENT,
    "",
    `URI: ${p.uri}`,
    "Version: 1",
    `Chain ID: ${p.chainId}`,
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt.toISOString()}`,
    `Expiration Time: ${p.expiresAt.toISOString()}`,
  ].join("\n");
}

/** The fields this site relies on, read back from a signed message. */
export function readMessage(message: string): { domain: string; address: string; chainId: number; nonce: string; expiresAt: number } | null {
  const lines = message.split("\n");
  const domain = /^(.+) wants you to sign in with your Ethereum account:$/.exec(lines[0] ?? "")?.[1];
  const field = (name: string) => lines.find((l) => l.startsWith(`${name}: `))?.slice(name.length + 2);
  const address = lines[1];
  const chainId = Number(field("Chain ID"));
  const nonce = field("Nonce");
  const expiresAt = Date.parse(field("Expiration Time") ?? "");
  if (!domain || !address || !isAddress(address) || !nonce || !Number.isFinite(chainId) || !Number.isFinite(expiresAt)) return null;
  return { domain, address, chainId, nonce, expiresAt };
}

/** A session is good only if its signature recovers to its address, for this site and chain, and hasn't expired. */
export async function checkSession(s: Session, domain: string, now = Date.now()): Promise<boolean> {
  const m = readMessage(s.message);
  if (!m || m.domain !== domain || m.chainId !== baseSepolia.id || m.expiresAt <= now || s.expiresAt !== m.expiresAt) return false;
  if (getAddress(m.address) !== getAddress(s.address)) return false;
  try {
    return await verifyMessage({ address: s.address, message: s.message, signature: s.signature });
  } catch {
    return false;
  }
}

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── A tiny store, so the header and every page agree on who is signed in. ── */

let current: Session | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const sessionStore = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
  get: () => current,
  getServer: () => null as Session | null,
};

function save(s: Session | null) {
  current = s;
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the session lasts until the page reloads.
  }
  emit();
}

/** Restores this tab's session after a reload, only if it still checks out. */
export async function restoreSession(): Promise<void> {
  let saved: Session | null = null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    saved = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    saved = null;
  }
  if (saved?.demo && saved.expiresAt > Date.now() && DEMO_ADDRESSES[saved.demo] && getAddress(saved.address) === getAddress(DEMO_ADDRESSES[saved.demo])) {
    current = saved;
    emit();
  } else if (saved && (await checkSession(saved, location.host))) {
    current = saved;
    emit();
  } else if (saved) save(null);
}

/** Starts a read-only demo view as one of the public demo addresses. Signs nothing. */
export function viewAs(role: keyof typeof DEMO_ADDRESSES) {
  save({ address: getAddress(DEMO_ADDRESSES[role]), message: "", signature: "0x", expiresAt: Date.now() + 2 * 3600_000, demo: role });
}

export function signOut() {
  save(null);
}

export class NoWalletError extends Error {}

export async function signIn(eth: EIP1193Provider | null): Promise<Session> {
  if (!eth) throw new NoWalletError("No browser wallet found. Install one such as MetaMask or Coinbase Wallet, then try again.");
  const wallet = createWalletClient({ chain: baseSepolia, transport: custom(eth) });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("The wallet returned no account.");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_HOURS * 3600_000);
  const message = buildMessage({ domain: location.host, uri: location.origin, address: account, chainId: baseSepolia.id, nonce: nonce(), issuedAt, expiresAt });
  const signature = await wallet.signMessage({ account, message });
  const session: Session = { address: getAddress(account), message, signature, expiresAt: expiresAt.getTime() };
  // Never trust the wallet's word for which account signed: recover it.
  if (!(await checkSession(session, location.host))) throw new Error("The signature didn't match the account. Nothing was saved.");
  save(session);
  // Switching accounts in the wallet ends this session, so the page never shows one wallet as another.
  eth.on?.("accountsChanged", (accounts: string[]) => {
    if (!accounts[0] || getAddress(accounts[0]) !== session.address) save(null);
  });
  return session;
}
