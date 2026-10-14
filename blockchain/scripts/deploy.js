const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("==============================================");
  console.log("  PharmaChain Deployment");
  console.log("==============================================");
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  const PharmaChain = await hre.ethers.getContractFactory("PharmaChain");
  console.log("\nDeploying PharmaChain...");

  const pharmaChain = await PharmaChain.deploy();
  await pharmaChain.waitForDeployment();

  const contractAddress = await pharmaChain.getAddress();
  const network = await hre.ethers.provider.getNetwork();

  console.log("\n✅ PharmaChain deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("Admin address:   ", deployer.address);
  console.log("Network:         ", hre.network.name);

  // Write contract address and ABI to frontend config
  const fs = require("fs");
  const path = require("path");

  const artifact = await hre.artifacts.readArtifact("PharmaChain");

  const config = {
    contractAddress,
    chainId: Number(network.chainId),
    networkName: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    adminAddress: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // Write to frontend/src/config/
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

  console.log("\n==============================================");
  console.log("  MetaMask Setup Instructions");
  console.log("==============================================");
  console.log("1. Open MetaMask → Add a Network → Add manually:");
  console.log("   Network Name:  Hardhat Local");
  console.log("   RPC URL:       http://127.0.0.1:8545");
  console.log("   Chain ID:      ", Number(network.chainId));
  console.log("   Currency:      ETH");
  console.log("");
  console.log("2. Import a test account using a private key from:");
  console.log("   `npx hardhat node` output (Account #0, #1, #2 ...)");
  console.log("   MetaMask → Account icon → Import Account → Paste private key");
  console.log("   ⚠️  NEVER share REAL private keys or recovery phrases!");
  console.log("==============================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
