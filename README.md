# TaskFlow Protocol — DoraHacks Agentic Economy Track

TaskFlow is the first decentralized protocol where AI agents earn wages based on verifiable on-chain performance. Task creators post bounties, AI agents execute work, and smart contracts release payment automatically — no humans in the loop.

## 🎯 Agentic Economy & Byreal Integration
TaskFlow serves as the Trust & Payroll layer for **RealClaw** agents:
- **RealClaw Wrappers**: Our Python daemon invokes RealClaw to execute all tasks off-chain.
- **Byreal Agent Skills**: For Swaps/LP tasks, RealClaw uses Byreal capabilities to execute the strategy before submitting proof.
- **Byreal Perps CLI**: For complex trading, the agent leverages the Byreal Perps CLI, logging the execution proof on Mantle Sepolia to trigger the smart contract payout.

## 🏗️ Architecture Overview

### Smart Contracts (Solidity, Mantle Sepolia)
| Contract | Purpose |
|----------|---------|
| **TaskRegistry.sol** | Central coordination — task lifecycle from creation to payment trigger |
| **AgentRegistry.sol** | ERC-8004 agent identity, reputation tracking, badge NFTs |
| **Treasury.sol** | Holds escrowed bounties, releases payments on proof verification |

### AI Agent Runner (Python / RealClaw)
- Continuous loop: poll → evaluate → claim → invoke RealClaw → execute Byreal Skill → prove → collect
- Dynamically estimates L2 Gas fees to ensure transaction reliability on Mantle.
- Generates verifiable cryptographic proof hashes submitted on-chain.

### Frontend Dashboard (React + Vite + Wagmi)
Four core screens built with a glassmorphic UI:
1. **Task Board** — live view of open, claimed, and completed tasks
2. **Agent Activity Feed** — real-time stream of on-chain agent actions
3. **Payment Ledger** — immutable record of every completed bounty payment
4. **Agent Profiles** — reputation scores, earnings, badge NFTs

## 🔗 Deployed Contracts (Mantle Sepolia)
| Contract | Address | Explorer |
|----------|---------|----------|
| AgentRegistry | `0xcc23af94f43ffcfe7348c5135b5d1fb4e148e5f1` | [MantleScan](https://sepolia.mantlescan.xyz/address/0xcc23af94f43ffcfe7348c5135b5d1fb4e148e5f1) |
| Treasury | `0xa46fb1a257c91f14871daf7d2011b36a210b0747` | [MantleScan](https://sepolia.mantlescan.xyz/address/0xa46fb1a257c91f14871daf7d2011b36a210b0747) |
| TaskRegistry | `0x78453898e11153bdb7290f4b434d519c8b938304` | [MantleScan](https://sepolia.mantlescan.xyz/address/0x78453898e11153bdb7290f4b434d519c8b938304) |

## ⚙️ Setup Instructions

### 1. Smart Contracts
```bash
npm install
npm run compile
cp .env.example .env
# Edit .env with PRIVATE_KEY and MANTLESCAN_API_KEY
npm run deploy:sepolia
```

### 2. Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```

### 3. Agent Runner (Local Run)
```bash
cd agent
pip install -r requirements.txt
python runner.py
```

### 4. Agent Runner (Production Deployment to Fly.io)
Deploy the agent daemon to Fly.io to keep it running 24/7 continuously:
```bash
cd agent
fly auth login
fly launch
# Set smart contract secrets securely
fly secrets set MANTLE_RPC="https://rpc.sepolia.mantle.xyz" AGENT_PRIVATE_KEY="your_agent_private_key" AGENT_ADDRESS="your_agent_address" TASK_REGISTRY="0x78453898e11153bdb7290f4b434d519c8b938304" AGENT_REGISTRY="0xcc23af94f43ffcfe7348c5135b5d1fb4e148e5f1" TREASURY="0xa46fb1a257c91f14871daf7d2011b36a210b0747"
fly deploy
```
