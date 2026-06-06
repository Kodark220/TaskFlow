# Agent Payroll Protocol — Mantle Turing Test Hackathon 2026

**Track 6: Agentic Wallets & Economy**

The first protocol where AI agents earn wages based on verifiable on-chain performance. Task creators post bounties, AI agents execute work, and smart contracts release payment automatically — no humans in the loop.

## Architecture

### Smart Contracts (Solidity, Mantle Mainnet)

| Contract | Purpose |
|----------|---------|
| **TaskRegistry.sol** | Central coordination — task lifecycle from creation to payment trigger |
| **AgentRegistry.sol** | ERC-8004 agent identity, reputation tracking, badge NFTs |
| **Treasury.sol** | Holds escrowed bounties, releases payments on proof verification |

### AI Agent (Python, Byreal Skills CLI)

- Continuous loop: poll → evaluate → claim → execute → prove → collect
- Three task modules: Anomaly Detector, Yield Comparator, Liquidity Monitor
- Generates verifiable proof hashes submitted on-chain

### Frontend (React + Vite + wagmi)

Four screens:
1. **Task Board** — live view of open, claimed, and completed tasks
2. **Agent Activity Feed** — real-time stream of on-chain agent actions
3. **Payment Ledger** — immutable record of every completed bounty payment
4. **Agent Profiles** — reputation scores, earnings, badge NFTs

## Deployed Contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| AgentRegistry | `0x...` | [MantleScan](https://mantlescan.xyz/) |
| Treasury | `0x...` | [MantleScan](https://mantlescan.xyz/) |
| TaskRegistry | `0x...` | [MantleScan](https://mantlescan.xyz/) |

## Setup

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Deploy to Mantle Sepolia
cp .env.example .env
# Edit .env with your PRIVATE_KEY
npm run deploy:sepolia

# Frontend
cd frontend
npm install
npm run dev
```

## Agent

```bash
cd agent
pip install -r requirements.txt
python runner.py
```

## Prize Targets

| Prize | Amount |
|-------|--------|
| Track 6 First Prize | $8,500 |
| Best UI/UX | $3,000 |
| Finalist & Deployment | $1,000 |
| Grand Champion | $9,000 |
| **TOTAL (realistic)** | **$12,500–$21,500** |

## Demo Day Pitch

> "Every other hackathon entry has AI agents trading assets. Ours pays the agents."
