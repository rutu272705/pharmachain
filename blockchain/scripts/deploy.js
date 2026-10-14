const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  // ── Network metadata lookup ──────────────────────────────────────
  const NETWORK_META = {
    1337:     { name: "Hardhat Local",      rpcUrl: "http://127.0.0.1:8545",          explorer: null },
    11155111: { name: "Ethereum Sepolia",   rpcUrl: process.env.SEPOLIA_RPC_URL || "",explorer: "https://sepolia.etherscan.io" },
  };

  const meta = NETWORK_META[chainId] || {
    name: hre.network.name,
    rpcUrl: "",
    explorer: null,
  };

  console.log("==============================================");
  console.log("  PharmaChain Deployment");
  console.log("==============================================");
  console.log("Network:         ", meta.name, `(chain ${chainId})`);
  console.log("Deploying with:  ", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance: ", hre.ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("\n❌ Deployer account has zero balance. Cannot pay for gas.");
    console.error("   Fund this account with test ETH before deploying.");
    process.exit(1);
  }

  // ── Deploy ────────────────────────────────────────────────────────
  const PharmaChain = await hre.ethers.getContractFactory("PharmaChain");
  console.log("\nDeploying PharmaChain...");

  const pharmaChain = await PharmaChain.deploy();
  const deployTx = pharmaChain.deploymentTransaction();
  console.log("Transaction hash:", deployTx.hash);
  console.log("Waiting for confirmation...");

  await pharmaChain.waitForDeployment();

  const contractAddress = await pharmaChain.getAddress();

  console.log("\n✅ PharmaChain deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("Admin address:   ", deployer.address);

  if (meta.explorer) {
    console.log("Explorer:        ", `${meta.explorer}/address/${contractAddress}`);
    console.log("Deploy tx:       ", `${meta.explorer}/tx/${deployTx.hash}`);
  }

  // ── Write frontend config ─────────────────────────────────────────
  const fs = require("fs");
  const path = require("path");

  const artifact = await hre.artifacts.readArtifact("PharmaChain");

  const receipt = await deployTx.wait();
  const deploymentBlock = receipt ? receipt.blockNumber : await hre.ethers.provider.getBlockNumber();

  const config = {
    contractAddress,
    chainId,
    networkName: meta.name,
    rpcUrl: meta.rpcUrl,
    blockExplorerUrl: meta.explorer || "",
    adminAddress: deployer.address,
    deploymentBlock: Number(deploymentBlock),
    deployedAt: new Date().toISOString(),
  };

  const frontendConfigDir = path.join(__dirname, "../../frontend/src/config");
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(frontendConfigDir, "contract.json"),
    JSON.stringify(config, null, 2)
  );

  fs.writeFileSync(
    path.join(frontendConfigDir, "PharmaChainABI.json"),
    JSON.stringify(artifact.abi, null, 2)
  );

  console.log("\n📁 Frontend config written to:");
  console.log("   frontend/src/config/contract.json");
  console.log("   frontend/src/config/PharmaChainABI.json");

  // ── Post-deploy instructions ──────────────────────────────────────
  console.log("\n==============================================");
  console.log("  MetaMask Setup");
  console.log("==============================================");

  if (chainId === 11155111) {
    console.log("Sepolia is a built-in MetaMask network.");
    console.log("1. Open MetaMask → top-left network selector → Show test networks → Sepolia");
    console.log("2. Your deployer account is already the contract admin.");
    console.log("3. Use the Participants page to authorize other wallets.");
    console.log("");
    console.log("⚠  All previous local Hardhat data does NOT exist on Sepolia.");
    console.log("   You must re-register participants and medicine batches.");
  } else {
    console.log("1. Open MetaMask → Add a Network → Add manually:");
    console.log("   Network Name: ", meta.name);
    console.log("   RPC URL:      ", meta.rpcUrl);
    console.log("   Chain ID:     ", chainId);
    console.log("   Currency:      ETH");
  }

  console.log("==============================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
