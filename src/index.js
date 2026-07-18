const UINT256_MAX = (1n << 256n) - 1n;

const SELECTORS = {
  "0x095ea7b3": "approve",
  "0xa9059cbb": "transfer",
  "0x23b872dd": "transferFrom",
  "0xa22cb465": "setApprovalForAll",
  "0x42842e0e": "safeTransferFrom",
  "0xac9650d8": "multicall"
};

function fail(message) {
  throw new Error(message);
}

function normalizeHex(value, label) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) {
    fail(`${label} must be a 0x-prefixed hexadecimal string`);
  }
  return value.toLowerCase();
}

function parseValue(value) {
  if (value === undefined || value === null || value === "") return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) fail("value must be a non-negative integer");
    return BigInt(value);
  }
  if (typeof value === "string") {
    if (/^0x[0-9a-fA-F]+$/.test(value) || /^\d+$/.test(value)) return BigInt(value);
  }
  fail("value must be a non-negative decimal or hexadecimal integer");
}

function word(data, index) {
  const start = 10 + index * 64;
  const value = data.slice(start, start + 64);
  if (value.length !== 64) fail("calldata is too short for this function");
  return value;
}

function addressFromWord(value) {
  return `0x${value.slice(24)}`;
}

function uintFromWord(value) {
  return BigInt(`0x${value}`);
}

function boolFromWord(value) {
  const numeric = uintFromWord(value);
  if (numeric !== 0n && numeric !== 1n) fail("boolean argument must be zero or one");
  return numeric === 1n;
}

function formatWei(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
}

function risk(level, score, warnings) {
  return { level, score, warnings };
}

function approvalResult({ selector, token, spender, amount }) {
  const unlimited = amount === UINT256_MAX;
  const warnings = unlimited
    ? ["This grants an unlimited token allowance. The spender can move this token until the allowance is revoked."]
    : ["This grants a token allowance. Confirm the spender and amount before signing."];
  return {
    selector,
    action: "erc20-approve",
    summary: unlimited ? "Grant unlimited ERC-20 allowance" : "Grant ERC-20 allowance",
    parameters: { token, spender, amount: amount.toString(), unlimited },
    risk: risk(unlimited ? "high" : "medium", unlimited ? 80 : 45, warnings)
  };
}

/**
 * Decode common EVM calldata without RPC calls, keys, or transaction submission.
 * The result is a triage aid; it cannot prove that a target contract is trustworthy.
 */
export function decodeTransaction({ to, data = "0x", value } = {}) {
  const calldata = normalizeHex(data, "data");
  const destination = to ? normalizeHex(to, "to") : null;
  if (destination && !/^0x[0-9a-f]{40}$/.test(destination)) fail("to must be a 20-byte address");
  const nativeValue = parseValue(value);

  if (calldata.length < 10) {
    return {
      selector: null,
      action: nativeValue > 0n ? "native-transfer" : "empty-call",
      summary: nativeValue > 0n ? "Send native currency" : "Call with empty calldata",
      parameters: { to: destination, value: nativeValue.toString(), formattedValue: formatWei(nativeValue) },
      risk: risk(nativeValue > 0n ? "low" : "info", nativeValue > 0n ? 10 : 0, nativeValue > 0n ? ["This transfers native currency to the target address."] : [])
    };
  }

  const selector = calldata.slice(0, 10);
  const functionName = SELECTORS[selector];
  if (functionName === "approve") {
    return approvalResult({
      selector,
      token: destination,
      spender: addressFromWord(word(calldata, 0)),
      amount: uintFromWord(word(calldata, 1))
    });
  }
  if (functionName === "transfer") {
    const recipient = addressFromWord(word(calldata, 0));
    const amount = uintFromWord(word(calldata, 1));
    return {
      selector,
      action: "erc20-transfer",
      summary: "Transfer ERC-20 tokens",
      parameters: { token: destination, recipient, amount: amount.toString() },
      risk: risk("low", 15, ["This transfers ERC-20 tokens. Verify the token contract and recipient."])
    };
  }
  if (functionName === "transferFrom") {
    const from = addressFromWord(word(calldata, 0));
    const recipient = addressFromWord(word(calldata, 1));
    const amount = uintFromWord(word(calldata, 2));
    return {
      selector,
      action: "erc20-transfer-from",
      summary: "Move ERC-20 tokens using an allowance",
      parameters: { token: destination, from, recipient, amount: amount.toString() },
      risk: risk("medium", 35, ["This moves tokens from another address using an existing allowance."])
    };
  }
  if (functionName === "setApprovalForAll") {
    const operator = addressFromWord(word(calldata, 0));
    const approved = boolFromWord(word(calldata, 1));
    return {
      selector,
      action: "nft-set-approval-for-all",
      summary: approved ? "Grant operator control over all NFTs" : "Revoke NFT operator control",
      parameters: { collection: destination, operator, approved },
      risk: approved
        ? risk("high", 75, ["This grants the operator permission to transfer every NFT from this collection."])
        : risk("info", 0, ["This revokes an NFT operator approval."])
    };
  }
  if (functionName === "safeTransferFrom") {
    const from = addressFromWord(word(calldata, 0));
    const recipient = addressFromWord(word(calldata, 1));
    const tokenId = uintFromWord(word(calldata, 2));
    return {
      selector,
      action: "nft-safe-transfer-from",
      summary: "Transfer one NFT",
      parameters: { collection: destination, from, recipient, tokenId: tokenId.toString() },
      risk: risk("medium", 30, ["This transfers an NFT. Verify the collection, token ID, and recipient."])
    };
  }
  if (functionName === "multicall") {
    return {
      selector,
      action: "multicall",
      summary: "Execute a batched contract call",
      parameters: { target: destination, calldataBytes: (calldata.length - 10) / 2 },
      risk: risk("high", 65, ["This contains nested calls that require separate decoding before it is safe to sign."])
    };
  }
  return {
    selector,
    action: "unknown-contract-call",
    summary: "Call an unrecognized contract function",
    parameters: { target: destination, calldataBytes: (calldata.length - 10) / 2 },
    risk: risk("medium", 50, ["The selector is not in the offline decoder. Do not sign until the contract ABI and target are verified."])
  };
}

export { UINT256_MAX };
