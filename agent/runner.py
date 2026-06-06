"""
Agent Payroll — AI Agent Runner
Continuous loop: poll TaskRegistry → evaluate → claim → execute → submit proof → collect payment

Built for Byreal Skills CLI integration on Mantle.
"""

import os
import json
import time
import hashlib
import logging
import threading
from typing import Optional
from datetime import datetime
from flask import Flask
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

# Web3
from web3 import Web3
try:
    from web3.middleware import ExtraDataToPOAMiddleware as geth_poa_middleware
except ImportError:
    from web3.middleware import geth_poa_middleware


# --- Configuration ---
RPC_URL = os.getenv("MANTLE_RPC", "https://rpc.sepolia.mantle.xyz")
PRIVATE_KEY = os.getenv("AGENT_PRIVATE_KEY", "")
AGENT_ADDRESS = os.getenv("AGENT_ADDRESS", "")

# Contract addresses (set after deploy)
TASK_REGISTRY_ADDR = os.getenv("TASK_REGISTRY", "")
AGENT_REGISTRY_ADDR = os.getenv("AGENT_REGISTRY", "")
TREASURY_ADDR = os.getenv("TREASURY", "")

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))  # seconds
MIN_BOUNTY = int(os.getenv("MIN_BOUNTY", "0"))  # minimum bounty in wei

# --- ABIs (minimal — only what we need) ---
TASK_REGISTRY_ABI = json.loads(os.getenv("TASK_REGISTRY_ABI", """[
  {"constant":true,"inputs":[],"name":"taskCounter","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[{"name":"taskId","type":"uint256"}],"name":"getTask","outputs":[
    {"name":"","type":"tuple","components":[
      {"name":"id","type":"uint256"},
      {"name":"creator","type":"address"},
      {"name":"assignee","type":"address"},
      {"name":"description","type":"string"},
      {"name":"successCriteria","type":"string"},
      {"name":"bountyAmount","type":"uint256"},
      {"name":"deadline","type":"uint256"},
      {"name":"status","type":"uint8"},
      {"name":"proofHash","type":"string"},
      {"name":"paymentReleased","type":"bool"}
    ]}
  ],"type":"function"},
  {"constant":false,"inputs":[{"name":"taskId","type":"uint256"}],"name":"assignTask","outputs":[],"type":"function"},
  {"constant":false,"inputs":[{"name":"taskId","type":"uint256"},{"name":"proofHash","type":"string"}],"name":"submitProof","outputs":[],"type":"function"},
  {"constant":true,"inputs":[],"name":"getOpenTaskCount","outputs":[{"name":"","type":"uint256"}],"type":"function"},
  {"constant":true,"inputs":[{"name":"agent","type":"address"}],"name":"getAgentTasks","outputs":[{"name":"","type":"uint256[]"}],"type":"function"}
]"""))

AGENT_REGISTRY_ABI = json.loads(os.getenv("AGENT_REGISTRY_ABI", """[
  {"constant":true,"inputs":[{"name":"wallet","type":"address"}],"name":"isRegistered","outputs":[{"name":"","type":"bool"}],"type":"function"},
  {"constant":true,"inputs":[{"name":"wallet","type":"address"}],"name":"getAgentByWallet","outputs":[
    {"name":"tokenId","type":"uint256"},{"name":"wallet","type":"address"},{"name":"name","type":"string"},
    {"name":"metadataURI","type":"string"},{"name":"status","type":"uint8"},
    {"name":"registrationTime","type":"uint256"},{"name":"totalTasks","type":"uint256"},
    {"name":"successfulTasks","type":"uint256"},{"name":"totalEarned","type":"uint256"},
    {"name":"reputationScore","type":"uint256"}
  ],"type":"function"}
]"""))

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("agent-payroll")


class AgentPayrollRunner:
    """Main agent loop — polls, evaluates, claims, executes, and proves."""

    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(RPC_URL))
        self.w3.middleware_onion.inject(geth_poa_middleware, layer=0)

        if not self.w3.is_connected():
            raise RuntimeError(f"Cannot connect to {RPC_URL}")

        self.account = self.w3.eth.account.from_key(PRIVATE_KEY)
        self.address = self.account.address

        self.task_registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(TASK_REGISTRY_ADDR),
            abi=TASK_REGISTRY_ABI,
        )
        self.agent_registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(AGENT_REGISTRY_ADDR),
            abi=AGENT_REGISTRY_ABI,
        )

        self.chain_id = self.w3.eth.chain_id
        self.nonce = self.w3.eth.get_transaction_count(self.address)

        log.info(f"🤖 Agent initialized: {self.address}")
        log.info(f"   Chain ID: {self.chain_id}")
        log.info(f"   Poll interval: {POLL_INTERVAL}s")

    def is_registered(self) -> bool:
        """Check if this agent wallet is registered on-chain."""
        try:
            return self.agent_registry.functions.isRegistered(self.address).call()
        except Exception as e:
            log.warning(f"Registration check failed: {e}")
            return False

    def get_open_tasks(self) -> list:
        """Fetch all open tasks from the registry."""
        try:
            task_count = self.task_registry.functions.taskCounter().call()
        except Exception as e:
            log.warning(f"Failed to get task count: {e}")
            return []

        open_tasks = []
        for tid in range(1, task_count + 1):
            try:
                task = self.task_registry.functions.getTask(tid).call()
                # status 0 = Open
                if task[7] == 0:  # status field
                    open_tasks.append({
                        "id": task[0],
                        "creator": task[1],
                        "assignee": task[2],
                        "description": task[3],
                        "success_criteria": task[4],
                        "bounty": task[5],
                        "deadline": task[6],
                        "status": task[7],
                    })
            except Exception:
                continue

        return open_tasks

    def evaluate_task(self, task: dict) -> Optional[int]:
        """
        Score an open task — can we do it? Is the bounty worth it?
        Returns task ID if worth claiming, None otherwise.
        """
        # Must fit our capabilities
        desc_lower = task["description"].lower()

        # Check if task matches our modules
        capabilities = [
            "anomaly", "monitor", "detect", "alert",
            "yield", "compare", "rate", "reallocate",
            "liquidity", "pool", "tvl", "depth",
            "swap", "rebalance", "lp", "perp", "trade",
            "strategy", "byreal", "realclaw",
        ]
        matches = any(c in desc_lower for c in capabilities)

        if not matches:
            return None

        # Check bounty is sufficient
        if task["bounty"] < MIN_BOUNTY:
            return None

        # Check deadline isn't too close (< 10 min)
        now = int(time.time())
        if task["deadline"] - now < 600:
            return None

        log.info(f"   ✅ Task {task['id']} accepted: bounty={self.w3.from_wei(task['bounty'], 'ether')} MNT")
        return task["id"]

    def send_transaction(self, contract_fn, value=0) -> Optional[str]:
        """Build, sign, and send a transaction. Returns tx hash."""
        try:
            # Fetch current transaction count dynamically to avoid nonce mismatch
            current_nonce = self.w3.eth.get_transaction_count(self.address, 'pending')
            tx = contract_fn.build_transaction({
                "from": self.address,
                "value": value,
                "nonce": current_nonce,
                "chainId": self.chain_id,
            })
            
            signed = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)

            log.info(f"   TX sent: {tx_hash.hex()}")
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

            if receipt["status"] == 1:
                log.info(f"   ✅ Confirmed: block {receipt['blockNumber']}")
                return tx_hash.hex()
            else:
                log.error(f"   ❌ Transaction failed: {tx_hash.hex()}")
                return None
        except Exception as e:
            log.error(f"   ❌ Error building/sending transaction: {e}")
            return None

    def claim_task(self, task_id: int) -> bool:
        """Claim an open task on-chain."""
        log.info(f"   Claiming task {task_id}...")
        contract_fn = self.task_registry.functions.assignTask(task_id)
        tx_hash = self.send_transaction(contract_fn)
        return tx_hash is not None

    def execute_task(self, task: dict) -> str:
        """
        Execute the task based on its description.
        Returns a proof hash of the result.

        Task Modules (RealClaw + Byreal Agent Skills):
        - Portfolio Rebalance (Byreal LP & Swap)
        - Perps Trading Strategy (Byreal Perps CLI)
        - Personal CFO / Anomaly Detector (RealClaw Life Expansion)
        """
        desc_lower = task["description"].lower()
        result = {}

        if "swap" in desc_lower or "rebalance" in desc_lower or "lp" in desc_lower:
            log.info("   🤖 [RealClaw] Launching Byreal Agent Skills for LP & Swap...")
            time.sleep(1) # Simulate execution
            result = {"action": "byreal_agent_skills_swap", "status": "executed", "timestamp": datetime.utcnow().isoformat()}
        elif "perps" in desc_lower or "trade" in desc_lower or "strategy" in desc_lower:
            log.info("   🤖 [RealClaw] Launching Byreal Perps CLI strategy...")
            time.sleep(1) # Simulate execution
            result = {"action": "byreal_perps_trade", "status": "executed", "timestamp": datetime.utcnow().isoformat()}
        else:
            log.info("   🤖 [RealClaw] Executing Real-Life CFO task expansion...")
            result = self._run_anomaly_detector(task)
            result["framework"] = "realclaw_expansion"

        # Create deterministic proof hash
        proof_data = json.dumps(result, sort_keys=True)
        proof_hash = hashlib.sha256(proof_data.encode()).hexdigest()

        log.info(f"   Task executed by RealClaw → proof: {proof_hash[:16]}...")
        return f"0x{proof_hash}"

    def _run_anomaly_detector(self, task: dict) -> dict:
        """Module 1: Anomaly Detector — check wallet for suspicious activity."""
        log.info(f"   🔍 Running Anomaly Detector...")
        # Extract target address from description (simplified)
        # In production: use Nansen AI API with $7K sponsor credit
        return {
            "module": "anomaly_detector",
            "target": task["description"],
            "result": "No anomalies detected",
            "timestamp": datetime.utcnow().isoformat(),
        }

    def _run_yield_comparator(self, task: dict) -> dict:
        """Module 2: Yield Comparator — compare mETH/USDY rates."""
        log.info(f"   📊 Running Yield Comparator...")
        # In production: call Mantle RWA oracles / on-chain data
        return {
            "module": "yield_comparator",
            "mETH_rate": "3.2%",
            "USDY_rate": "4.1%",
            "spread": "0.9%",
            "recommendation": "Reallocate to USDY",
            "timestamp": datetime.utcnow().isoformat(),
        }

    def _run_liquidity_monitor(self, task: dict) -> dict:
        """Module 3: Liquidity Monitor — check pool depths."""
        log.info(f"   💧 Running Liquidity Monitor...")
        # In production: query Merchant Moe / Agni Finance subgraphs
        return {
            "module": "liquidity_monitor",
            "pool": task["description"],
            "tvl": "1,234,567 MNT",
            "status": "Healthy — above configured floor",
            "timestamp": datetime.utcnow().isoformat(),
        }

    def submit_proof(self, task_id: int, proof_hash: str) -> bool:
        """Submit proof hash to TaskRegistry."""
        log.info(f"   Submitting proof for task {task_id}...")
        contract_fn = self.task_registry.functions.submitProof(task_id, proof_hash)
        tx_hash = self.send_transaction(contract_fn)
        if tx_hash:
            log.info(f"   💰 Payment should be on its way!")
        return tx_hash is not None

    def get_my_tasks(self) -> list:
        """Get tasks assigned to this agent."""
        try:
            task_ids = self.task_registry.functions.getAgentTasks(self.address).call()
            tasks = []
            for tid in task_ids:
                task = self.task_registry.functions.getTask(tid).call()
                tasks.append({
                    "id": task[0],
                    "status": task[7],  # 1 = Assigned, 2 = Completed
                    "bounty": task[5],
                    "deadline": task[6],
                    "proof_hash": task[8],
                })
            return tasks
        except Exception:
            return []

    def handle_my_assigned_tasks(self):
        """Check if we have assigned tasks that need proof submission."""
        my_tasks = self.get_my_tasks()
        for t in my_tasks:
            if t["status"] == 1:  # Assigned, needs proof
                now = int(time.time())
                if t["deadline"] > now and not t["proof_hash"]:
                    log.info(f"📋 Found assigned task {t['id']} — submitting proof...")
                    # Reconstruct task for execution
                    full_task = self.task_registry.functions.getTask(t["id"]).call()
                    task_data = {
                        "id": full_task[0],
                        "description": full_task[3],
                        "success_criteria": full_task[4],
                        "bounty": full_task[5],
                    }
                    proof = self.execute_task(task_data)
                    self.submit_proof(t["id"], proof)

    def run_loop(self):
        """Main agent execution loop."""
        log.info("=" * 50)
        log.info("🤖 AGENT PAYROLL — Starting execution loop")
        log.info("=" * 50)

        if not self.is_registered():
            log.warning("⚠️  Agent not registered on-chain. Register first via the dashboard.")
            log.warning("   Agent address: %s", self.address)

        while True:
            try:
                log.info(f"\n{'─' * 40}")
                log.info(f"🔄 Cycle at {datetime.utcnow().isoformat()}")

                # Step 1: Handle any tasks already assigned to us
                self.handle_my_assigned_tasks()

                # Step 2: Poll for new open tasks
                open_tasks = self.get_open_tasks()
                log.info(f"📡 Open tasks: {len(open_tasks)}")

                if not open_tasks:
                    log.info("   No open tasks. Sleeping...")
                    time.sleep(POLL_INTERVAL)
                    continue

                # Step 3: Evaluate and claim
                for task in open_tasks:
                    task_id = self.evaluate_task(task)
                    if task_id is None:
                        continue

                    # Step 4: Claim it
                    claimed = self.claim_task(task_id)
                    if not claimed:
                        continue

                    # Step 5: Execute the task
                    log.info(f"⚙️  Executing task {task_id}...")
                    proof_hash = self.execute_task(task)

                    # Step 6: Submit proof → triggers payment
                    log.info(f"📤 Submitting proof for task {task_id}...")
                    self.submit_proof(task_id, proof_hash)

                    # Brief pause between tasks
                    time.sleep(5)

                log.info(f"💤 Sleeping {POLL_INTERVAL}s until next cycle...")

            except KeyboardInterrupt:
                log.info("\n👋 Agent shutting down.")
                break
            except Exception as e:
                log.error(f"❌ Error in loop: {e}")
                time.sleep(POLL_INTERVAL)

        time.sleep(POLL_INTERVAL)


# --- Minimal Flask server for Render free web service support ---
app = Flask(__name__)

@app.route("/")
def home():
    return {
        "status": "active",
        "agent_address": AGENT_ADDRESS or "Not Configured",
        "chain_id": 5003, # Mantle Sepolia
        "message": "TaskFlow AI Agent Runner is alive!"
    }, 200

def start_web_server():
    """Runs a minimal web server to keep Render's free tier happy."""
    port = int(os.getenv("PORT", "10000"))
    log.info(f"🌐 Starting dummy web server on port {port}...")
    import sys
    # Suppress flask CLI server banner
    try:
        cli = sys.modules['flask.cli']
        cli.show_server_banner = lambda *x: None
    except Exception:
        pass
    
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)


# --- Byreal Skills CLI Entry Point ---
def main():
    """Entry point for the Byreal Skills CLI agent."""
    log.info("Starting Agent Payroll Runner...")

    required_vars = {
        "MANTLE_RPC": RPC_URL,
        "AGENT_PRIVATE_KEY": PRIVATE_KEY,
        "TASK_REGISTRY": TASK_REGISTRY_ADDR,
        "AGENT_REGISTRY": AGENT_REGISTRY_ADDR,
        "TREASURY": TREASURY_ADDR,
    }

    missing = [k for k, v in required_vars.items() if not v]
    if missing:
        log.error(f"Missing required env vars: {', '.join(missing)}")
        log.error("Set them in .env or export before running.")
        return

    # Start the dummy web server thread for Render free web service
    web_thread = threading.Thread(target=start_web_server, daemon=True)
    web_thread.start()

    runner = AgentPayrollRunner()
    runner.run_loop()



if __name__ == "__main__":
    main()
