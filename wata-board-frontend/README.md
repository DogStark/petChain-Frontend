# Wata-Board Frontend

Frontend UI for **Wata-Board** — a decentralized utility payment platform on **Stellar / Soroban**.

This is a **React + TypeScript + Vite** app styled with **Tailwind** and wired to **Freighter Wallet** for signing transactions.

## Prerequisites

- **Node.js** (v18+ LTS recommended)
- **Freighter Wallet** browser extension
- Stellar testnet account with XLM

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:5173
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | Create production build with type checking |
| `npm run lint` | Run ESLint on all files |
| `npm run preview` | Preview production build locally |

## Project Structure

```
src/
├── App.tsx           # Main payment interface
├── contracts/        # Soroban contract bindings
│   ├── src/index.ts  # Generated client code
│   ├── package.json
│   └── tsconfig.json
├── main.tsx          # React entry point
├── index.css         # Global styles
└── assets/           # Static assets
```

## Smart Contract Integration

- **Contract ID**: `CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA`
- **Network**: Stellar Testnet
- **RPC**: `https://soroban-testnet.stellar.org`

## Features

- **Meter Payment**: Enter meter ID and amount to pay utility bills
- **Freighter Integration**: Sign transactions with browser wallet
- **Real-time Status**: Track transaction progress and results
- **Testnet Ready**: Pre-configured for Stellar testnet

## Environment Variables

Create `.env` in the project root:

```env
VITE_CONTRACT_ID=CDRRJ7IPYDL36YSK5ZQLBG3LICULETIBXX327AGJQNTWXNKY2UMDO4DA
VITE_RPC_URL=https://soroban-testnet.stellar.org
```

## Freighter Setup

1. Install [Freighter Wallet](https://www.freighter.app/) extension
2. Create or import an account
3. Switch to **Testnet** in settings
4. Fund account with testnet XLM from [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Freighter not found" | Install extension and refresh page |
| "Transaction failed" | Check testnet XLM balance |
| "Build errors" | Run `npm install` to update deps |

## Notes

- The app is currently configured for **Stellar Testnet** only
- Contract bindings in `src/contracts/` are auto-generated from Soroban CLI
- Amount must be a positive whole number

## Dependencies

- **React** 19.2.0
- **Stellar SDK** 14.5.0
- **Freighter API** 6.0.1
- **Tailwind CSS** 4.1.18
- **Vite** 8.0.0-beta.13

## License

ISC
