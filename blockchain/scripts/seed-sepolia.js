const { ethers } = require("ethers");
require("dotenv").config();
const contractConfig = require("../../frontend/src/config/contract.json");
const pharmaChainArtifact = require("../artifacts/contracts/PharmaChain.sol/PharmaChain.json");

const DAY = 24 * 60 * 60;

async function main() {
  console.log("Starting automated Sepolia data seeding...");
  
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const admin = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  console.log(`Admin / Deployer: ${admin.address}`);

  const contractAddress = contractConfig.contractAddress;
  console.log(`Contract: ${contractAddress}`);

  const contractAdmin = new ethers.Contract(contractAddress, pharmaChainArtifact.abi, admin);

  // Create a dedicated manufacturer wallet for this seeding session
  const mfrWallet = ethers.Wallet.createRandom().connect(provider);
  console.log(`Generated Demo Manufacturer: ${mfrWallet.address}`);

  // Fund the demo manufacturer wallet from Admin
  console.log("Funding Demo Manufacturer with 0.003 Sepolia ETH for gas...");
  const fundTx = await admin.sendTransaction({
    to: mfrWallet.address,
    value: ethers.parseEther("0.003"),
  });
  console.log(`Funding tx: ${fundTx.hash}`);
  await fundTx.wait();
  console.log("Demo Manufacturer funded.");

  // Admin authorizes the demo manufacturer on-chain
  console.log("Authorizing Demo Manufacturer on PharmaChain contract...");
  const authTx = await contractAdmin.authorizeParticipant(
    mfrWallet.address,
    2, // Role.MANUFACTURER
    "Cipla Global Laboratories"
  );
  console.log(`Authorization tx: ${authTx.hash}`);
  await authTx.wait();
  console.log("Demo Manufacturer authorized successfully.");

  // Connect contract to the authorized manufacturer
  const contractMfr = new ethers.Contract(contractAddress, pharmaChainArtifact.abi, mfrWallet);

  const batches = [
    {
      batchId: "CIPLA-PARA-2026-001",
      name: "Paracetamol 500mg Tablets",
      manufacturerName: "Cipla Global Laboratories",
      daysAgo: 15,
      validDays: 365,
    },
    {
      batchId: "CIPLA-AMOX-2026-002",
      name: "Amoxicillin 250mg Capsules",
      manufacturerName: "Cipla Global Laboratories",
      daysAgo: 10,
      validDays: 540,
    },
    {
      batchId: "CIPLA-AZI-2026-003",
      name: "Azithromycin 500mg Tablets",
      manufacturerName: "Cipla Global Laboratories",
      daysAgo: 5,
      validDays: 730,
    },
  ];

  const currentBlock = await provider.getBlock("latest");
  const now = currentBlock.timestamp;

  for (const b of batches) {
    console.log(`\nRegistering batch ${b.batchId} (${b.name})...`);
    const mfgDate = now - b.daysAgo * DAY;
    const expDate = now + b.validDays * DAY;

    const tx = await contractMfr.registerMedicine(
      b.batchId,
      b.name,
      b.manufacturerName,
      mfgDate,
      expDate
    );
    console.log(`Tx submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Batch ${b.batchId} registered in block ${receipt.blockNumber}!`);
  }

  // Return remaining gas back to Admin
  const remainingBal = await provider.getBalance(mfrWallet.address);
  if (remainingBal > ethers.parseEther("0.0005")) {
    const sweepAmount = remainingBal - ethers.parseEther("0.0005");
    console.log(`Sweeping remaining ${ethers.formatEther(sweepAmount)} ETH back to Admin...`);
    try {
      const sweepTx = await mfrWallet.sendTransaction({
        to: admin.address,
        value: sweepAmount,
      });
      await sweepTx.wait();
      console.log("Sweep complete.");
    } catch (e) {
      console.log("Sweep skipped:", e.message);
    }
  }

  console.log("\n=======================================================");
  console.log("Seeding on Ethereum Sepolia Testnet Complete!");
  console.log("Registered batches: CIPLA-PARA-2026-001, CIPLA-AMOX-2026-002, CIPLA-AZI-2026-003");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exitCode = 1;
});
