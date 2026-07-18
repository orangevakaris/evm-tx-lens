# EVM Tx Lens

Offline decoder for common EVM transaction calldata, with risk-focused output for token approvals, NFT operator permissions, transfers, and unknown calls.

It makes no RPC calls, never requests a wallet connection, and cannot submit transactions. Use it as a quick triage layer before signing, not as a guarantee that a transaction is safe.

## Run

```bash
git clone https://github.com/orangevakaris/evm-tx-lens.git
cd evm-tx-lens
echo '{
  "to": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "data": "0x095ea7b30000000000000000000000001111111111111111111111111111111111111111ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
}' | node bin/evm-tx-lens.js
```

Example output highlights the action, parsed parameters, and a conservative risk level:

```json
{
  "action": "erc20-approve",
  "summary": "Grant unlimited ERC-20 allowance",
  "risk": {
    "level": "high"
  }
}
```

## Supported Calls

- ERC-20 `approve`, `transfer`, and `transferFrom`
- ERC-721 / ERC-1155-compatible `setApprovalForAll` and three-argument `safeTransferFrom`
- Common `multicall` selector detection
- Native transfers and unknown calls with conservative warnings

## Development

```bash
npm test
```

## Experiment Rules

This is a small public experiment. It earns more implementation time only if it gets independent use, stars, forks, issues, or inbound requests. No wallet keys, user data, RPC credentials, or analytics are collected.
