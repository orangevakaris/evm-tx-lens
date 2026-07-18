#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { decodeTransaction } from "../src/index.js";

function usage() {
  return "Usage: evm-tx-lens [transaction.json] | echo '{\"to\":\"0x...\",\"data\":\"0x...\"}' | evm-tx-lens";
}

function readInput() {
  const file = process.argv[2];
  if (file && !file.startsWith("-")) return readFileSync(file, "utf8");
  if (process.stdin.isTTY) throw new Error(usage());
  return readFileSync(0, "utf8");
}

try {
  const input = JSON.parse(readInput());
  console.log(JSON.stringify(decodeTransaction(input), null, 2));
} catch (error) {
  console.error(`evm-tx-lens: ${error.message}`);
  process.exitCode = 1;
}
