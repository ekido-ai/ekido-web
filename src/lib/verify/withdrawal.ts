import { BaseError, createPublicClient, decodeEventLog, http, isAddress, isHex, parseAbi, size, TransactionReceiptNotFoundError, type Address, type Hex } from "viem";

const withdrawalAbi = parseAbi(["event Withdrawal(address indexed account, uint256 amount)"]);

export interface WithdrawalProof {
  wallet: Address;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

/**
 * Plain words for a failure while reading the chain. viem's own messages name the library and its version
 * ("Version: viem@2.57.19") and can run to several lines (ekido-ai/ekido-core#127).
 */
export function chainReadError(error: unknown): Error {
  if (error instanceof TransactionReceiptNotFoundError) {
    return new Error("No transaction with this hash on this chain. Check the hash, or try again in a minute if it was only just sent.");
  }
  if (error instanceof BaseError) {
    return new Error(`Couldn't read the chain: ${error.shortMessage.replace(/\s+/g, " ").slice(0, 160)}`);
  }
  return error instanceof Error ? error : new Error("Couldn't read the chain.");
}

/** Verify a specific receipt against a separately configured escrow and chain.
 * A withdrawal aggregates all credits for a wallet, so it cannot prove which job was withdrawn.
 */
export async function verifyWithdrawal(transactionHash: string, wallet: string, escrow: string | null, rpcUrl: string, chainId: number): Promise<WithdrawalProof> {
  if (!isHex(transactionHash) || size(transactionHash) !== 32) throw new Error("Enter a 32-byte transaction hash.");
  if (!isAddress(wallet)) throw new Error("Enter a valid wallet address.");
  if (!escrow || !isAddress(escrow)) throw new Error("Configure a trusted escrow address first.");
  const client = createPublicClient({ transport: http(rpcUrl) });
  const read = <T>(call: Promise<T>) => call.catch((error: unknown) => { throw chainReadError(error); });
  if (await read(client.getChainId()) !== chainId) throw new Error("The RPC is connected to a different chain.");
  const receipt = await read(client.getTransactionReceipt({ hash: transactionHash as Hex }));
  if (receipt.status !== "success") throw new Error("The withdrawal transaction did not succeed.");
  let amount = BigInt(0);
  let found = false;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== escrow.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: withdrawalAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === "Withdrawal" && decoded.args.account.toLowerCase() === wallet.toLowerCase()) {
        amount += decoded.args.amount;
        found = true;
      }
    } catch {
      // Other events from the same escrow are not withdrawal evidence.
    }
  }
  if (!found) throw new Error("No withdrawal for this wallet was emitted by the configured escrow in that transaction.");
  return { wallet: wallet as Address, amount, blockNumber: receipt.blockNumber, transactionHash: transactionHash as Hex };
}
