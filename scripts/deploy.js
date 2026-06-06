import hre from "hardhat";
import fs from "fs";
import { createWalletClient, http, publicActions, getContract } from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const PK = process.env.PRIVATE_KEY;
  if (!PK) throw new Error("PRIVATE_KEY not set in .env");

  const account = privateKeyToAccount(PK);
  const rpcUrl = process.env.MANTLE_RPC || "https://rpc.sepolia.mantle.xyz";

  const client = createWalletClient({
    account,
    chain: {
      id: 5003,
      name: "Mantle Sepolia",
      network: "mantle-sepolia",
      rpcUrls: { default: { http: [rpcUrl] } },
      nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
    },
    transport: http(rpcUrl),
  }).extend(publicActions);

  const chainId = await client.getChainId();
  const balance = await client.getBalance({ address: account.address });
  console.log("🚀 Deploying Agent Payroll Protocol");
  console.log("   Chain ID:", chainId);
  console.log("   Deployer:", account.address);
  console.log("   Balance:", (Number(balance) / 1e18).toFixed(4), "MNT\n");

  if (balance === 0n) {
    console.error("❌ Account has 0 MNT. Get testnet MNT from Mantle faucet first.");
    console.error("   Faucet: https://faucet.sepolia.mantle.xyz/");
    process.exit(1);
  }

  // Read compiled artifacts
  const artifactsDir = new URL("../artifacts/contracts", import.meta.url).pathname;

  const getArtifact = (name) => {
    const p = `${artifactsDir}/${name}.sol/${name}.json`;
    if (!fs.existsSync(p)) {
      throw new Error(`Artifact not found: ${p}. Run 'npx hardhat compile' first.`);
    }
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    return { abi: data.abi, bytecode: data.bytecode };
  };

  async function deployContract(name, args = []) {
    const { abi, bytecode } = getArtifact(name);
    console.log(`📦 Deploying ${name}...`);

    const hash = await client.deployContract({
      abi,
      bytecode,
      args,
    });
    const receipt = await client.waitForTransactionReceipt({ hash });
    const addr = receipt.contractAddress;
    console.log(`   ✅ ${name} deployed to: ${addr}`);
    return { address: addr, abi };
  }

  // Step 1: AgentRegistry
  const agentReg = await deployContract("AgentRegistry");

  // Step 2: Treasury
  const treasury = await deployContract("Treasury");

  // Step 3: TaskRegistry (needs AgentRegistry + Treasury addresses)
  const taskReg = await deployContract("TaskRegistry", [agentReg.address, treasury.address]);

  // Step 4: Grant REGISTRY_ROLE to TaskRegistry in Treasury
  console.log("\n🔐 Granting REGISTRY_ROLE to TaskRegistry in Treasury...");
  const REGISTRY_ROLE = await getContract({
    address: treasury.address,
    abi: treasury.abi,
    client,
  }).read.REGISTRY_ROLE();
  const grantHash = await client.writeContract({
    address: treasury.address,
    abi: treasury.abi,
    functionName: "grantRole",
    args: [REGISTRY_ROLE, taskReg.address],
  });
  await client.waitForTransactionReceipt({ hash: grantHash });
  console.log("   ✅ REGISTRY_ROLE granted");

  // Step 5: Grant OPERATOR_ROLE to TaskRegistry in AgentRegistry
  console.log("🔐 Granting OPERATOR_ROLE to TaskRegistry in AgentRegistry...");
  const OPERATOR_ROLE = await getContract({
    address: agentReg.address,
    abi: agentReg.abi,
    client,
  }).read.OPERATOR_ROLE();
  const grantOpHash = await client.writeContract({
    address: agentReg.address,
    abi: agentReg.abi,
    functionName: "grantRole",
    args: [OPERATOR_ROLE, taskReg.address],
  });
  await client.waitForTransactionReceipt({ hash: grantOpHash });
  console.log("   ✅ OPERATOR_ROLE granted");

  console.log("\n✅ Deployment complete!");
  console.log("==========================================");
  console.log("AgentRegistry:", agentReg.address);
  console.log("Treasury:",     treasury.address);
  console.log("TaskRegistry:", taskReg.address);
  console.log("==========================================");

  // Write addresses
  const envPath = new URL("../.env", import.meta.url).pathname;
  let envContent = "";
  try { envContent = fs.readFileSync(envPath, "utf8"); } catch (e) {}
  envContent += `\n# Deployed ${new Date().toISOString()}\nAGENT_REGISTRY=${agentReg.address}\nTREASURY=${treasury.address}\nTASK_REGISTRY=${taskReg.address}\n`;
  fs.writeFileSync(envPath, envContent);
  console.log("\n📝 Addresses written to .env");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌", error);
    process.exit(1);
  });
