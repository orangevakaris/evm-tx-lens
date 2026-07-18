import test from "node:test";
import assert from "node:assert/strict";
import { decodeTransaction, UINT256_MAX } from "../src/index.js";

const spender = "0000000000000000000000001111111111111111111111111111111111111111";
const recipient = "0000000000000000000000002222222222222222222222222222222222222222";

test("detects an unlimited ERC-20 approval", () => {
  const result = decodeTransaction({
    to: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    data: `0x095ea7b3${spender}${UINT256_MAX.toString(16).padStart(64, "0")}`
  });
  assert.equal(result.action, "erc20-approve");
  assert.equal(result.parameters.unlimited, true);
  assert.equal(result.risk.level, "high");
});

test("detects an NFT operator approval", () => {
  const result = decodeTransaction({
    to: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    data: `0xa22cb465${spender}${"1".padStart(64, "0")}`
  });
  assert.equal(result.action, "nft-set-approval-for-all");
  assert.equal(result.parameters.approved, true);
  assert.equal(result.risk.score, 75);
});

test("decodes a standard ERC-20 transfer", () => {
  const result = decodeTransaction({
    to: "0xcccccccccccccccccccccccccccccccccccccccc",
    data: `0xa9059cbb${recipient}${"42".padStart(64, "0")}`
  });
  assert.equal(result.action, "erc20-transfer");
  assert.equal(result.parameters.amount, "66");
});

test("keeps unknown calls conservative", () => {
  const result = decodeTransaction({
    to: "0xdddddddddddddddddddddddddddddddddddddddd",
    data: "0xdeadbeef"
  });
  assert.equal(result.action, "unknown-contract-call");
  assert.equal(result.risk.level, "medium");
});
