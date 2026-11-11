import { createPublicClient, decodeEventLog, http, isAddress, isHex, parseAbi, size, type Address, type Hex } from "viem";

const withdrawalAbi = parseAbi(["event Withdrawal(address indexed account, uint256 amount)"]);

export interface WithdrawalProof {
  wallet: Address;
  amount: bigint;
  blockNumber: bigint;
  transactionHash: Hex;
}

/** Verify a specific receipt against a separately configured escrow and chain.
 * A withdrawal aggregates all credits for a wallet, so it cannot prove which job was withdrawn.
 */
export async function verifyWithdrawal(transactionHash: string, wallet: string, escrow: string | null, rpcUrl: string, chainId: number): Promise<WithdrawalProof> {
  if (!isHex(transactionHash) || size(transactionHash) !== 32) throw new Error("Enter a 32-byte transaction hash.");
  if (!isAddress(wallet)) throw new Error("Enter a valid wallet address.");
  if (!escrow || !isAddress(escrow)) throw new Error("Configure a trusted escrow address first.");
  const client = createPublicClient({ transport: http(rpcUrl) });
  if (await client.getChainId() !== chainId) throw new Error("The RPC is connected to a different chain.");
  const receipt = await client.getTransactionReceipt({ hash: transactionHash as Hex });
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
