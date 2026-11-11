import {
  BaseError,
  UserRejectedRequestError,
  createPublicClient,
  createWalletClient,
  custom,
  erc20Abi,
  http,
  isHex,
  isAddressEqual,
  parseAbi,
  size,
  type EIP1193Provider,
} from "viem";
import { anvil, baseSepolia } from "viem/chains";
import { config } from "../config";
import { toMicros } from "../receipt/receipt";
import { checkFundingContext, type PreparedSignedRequest } from "../jobs/signed-request";

/**
 * Client-side funding flow (plan.md section F): approve the exact budget, then
 * GPUChainEscrow.createJob. The wallet signs; this code never sees a private key.
 */

export const escrowAbi = parseAbi([
  "function createJob(bytes32 jobId, bytes32 specHash, bytes32 policyHash, uint256 budget, uint64 deadline, uint64 disputeWindow)",
  "function token() view returns (address)",
  "struct Job { address client; uint64 deadline; uint8 state; uint32 verifierSet; uint64 disputeWindow; uint64 disputeEnd; uint64 disputedAt; bool passed; uint256 budget; uint256 bond; uint256 refund; bytes32 specHash; bytes32 policyHash; bytes32 finalCheckpoint; address[] payees; uint256[] amounts; address arbiter; }",
  "function getJob(bytes32 jobId) view returns (Job)",
]);

export const chain = config.localChain ? anvil : baseSepolia;

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function injectedProvider(): EIP1193Provider | null {
  return typeof window !== "undefined" && window.ethereum ? window.ethereum : null;
}

function clients(eth: EIP1193Provider) {
  return {
    wallet: createWalletClient({ chain, transport: custom(eth) }),
    pub: createPublicClient({ chain, transport: http(config.rpcUrl) }),
  };
}

export async function connect(eth: EIP1193Provider): Promise<`0x${string}`> {
  const [account] = await clients(eth).wallet.requestAddresses();
  if (!account) throw new Error("The wallet returned no account");
  return account;
}

/** Switch to the job's chain, adding it to the wallet first if it doesn't know it. */
export async function ensureChain(eth: EIP1193Provider): Promise<void> {
  const { wallet } = clients(eth);
  if ((await wallet.getChainId()) === chain.id) return;
  try {
    await wallet.switchChain({ id: chain.id });
  } catch (e) {
    const code = (e as { code?: number; cause?: { code?: number } }).code ?? (e as { cause?: { code?: number } }).cause?.code;
    if (code !== 4902) throw e;
    await wallet.addChain({ chain });
    await wallet.switchChain({ id: chain.id });
  }
}

export function budgetUnits(usdc: string): bigint {
  const amount = toMicros(usdc);
  if (amount <= BigInt(0)) throw new Error("The budget must be positive.");
  return amount;
}

export async function inspectFunding(eth: EIP1193Provider, prepared: PreparedSignedRequest) {
  const escrow = config.escrowAddress;
  if (!escrow || config.chainId !== chain.id || !validDisputeWindow(config.disputeWindowS, config.localChain)) {
    throw new Error("The escrow network or dispute window is not configured.");
  }
  const { wallet, pub } = clients(eth);
  const [accounts, walletChain, rpcChain] = await Promise.all([wallet.getAddresses(), wallet.getChainId(), pub.getChainId()]);
  const [account] = accounts;
  if (!account) throw new Error("Connect the client wallet first.");
  checkFundingContext(prepared, account, walletChain, escrow);
  if (rpcChain !== config.chainId) throw new Error("The escrow RPC is on a different chain.");
  const [token, job] = await Promise.all([
    pub.readContract({ address: escrow, abi: escrowAbi, functionName: "token" }),
    pub.readContract({ address: escrow, abi: escrowAbi, functionName: "getJob", args: [prepared.onchainId] }),
  ]);
  if (!isAddressEqual(token, config.usdcAddress)) throw new Error("The escrow uses a different token.");
  const amount = budgetUnits(prepared.body.budget_usdc);
  if (job.state === 0) return { account, escrow, amount, funded: false };
  if (!isAddressEqual(job.client, account) || job.specHash !== prepared.specHash ||
      job.policyHash !== prepared.policyHash || job.budget !== amount ||
      !validDisputeWindow(Number(job.disputeWindow), config.localChain)) {
    throw new Error("The existing on-chain job differs from the signed request.");
  }
  if (job.state !== 1 && job.state !== 2) throw new Error("This job has already left the funding stage. Open it in the dashboard.");
  if (job.deadline <= BigInt(Math.floor(Date.now() / 1000))) throw new Error("The existing escrow deadline has passed.");
  return { account, escrow, amount, funded: true };
}

/** Approve exactly the budget (plan.md: "Exact approve per job"). Returns null if already enough. */
export async function approveIfNeeded(
  eth: EIP1193Provider,
  account: `0x${string}`,
  escrow: `0x${string}`,
  amount: bigint,
): Promise<`0x${string}` | null> {
  const { wallet, pub } = clients(eth);
  const allowance = await pub.readContract({
    address: config.usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, escrow],
  });
  if (allowance >= amount) return null;
  return wallet.writeContract({
    account,
    chain,
    address: config.usdcAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [escrow, amount],
  });
}

export async function usdcBalance(account: `0x${string}`): Promise<bigint> {
  const pub = createPublicClient({ chain, transport: http(config.rpcUrl) });
  return pub.readContract({ address: config.usdcAddress, abi: erc20Abi, functionName: "balanceOf", args: [account] });
}

export interface CreateJobArgs {
  onchainId: `0x${string}`;
  specHash: `0x${string}`;
  policyHash: `0x${string}`;
  amount: bigint;
  deadlineSeconds: number;
}

export function checkBytes32(x: string): x is `0x${string}` {
  return isHex(x) && size(x as `0x${string}`) === 32;
}

export function validDisputeWindow(window: number, localChain: boolean): boolean {
  return Number.isSafeInteger(window) && window >= (localChain ? 1 : 3600) && window <= 7 * 24 * 3600;
}

export async function createJobTx(
  eth: EIP1193Provider,
  account: `0x${string}`,
  escrow: `0x${string}`,
  a: CreateJobArgs,
): Promise<`0x${string}`> {
  const window = config.disputeWindowS;
  if (!validDisputeWindow(window, config.localChain)) {
    throw new Error(config.localChain ? "The dispute window must be between 1 second and 7 days." : "The dispute window must be between 1 hour and 7 days.");
  }
  const { wallet } = clients(eth);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + a.deadlineSeconds);
  return wallet.writeContract({
    account,
    chain,
    address: escrow,
    abi: escrowAbi,
    functionName: "createJob",
    args: [a.onchainId, a.specHash, a.policyHash, a.amount, deadline, BigInt(window)],
  });
}

export async function waitForTx(hash: `0x${string}`): Promise<"success" | "reverted"> {
  const pub = createPublicClient({ chain, transport: http(config.rpcUrl) });
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return r.status;
}

export const explorerTx = (hash: string) => (config.explorer ? `${config.explorer}/tx/${hash}` : null);

/** Wallet and RPC errors, in words a person can act on. */
export function friendlyError(e: unknown): string {
  if (e instanceof UserRejectedRequestError || (e as { code?: number })?.code === 4001) return "You declined in your wallet. Nothing was sent.";
  if (e instanceof BaseError) {
    if (/insufficient funds/i.test(e.message)) return "Not enough test ETH for gas on this account.";
    if (/exceeds balance|transfer amount exceeds/i.test(e.message)) return "Not enough test USDC for this budget.";
    return e.shortMessage || e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong";
}
