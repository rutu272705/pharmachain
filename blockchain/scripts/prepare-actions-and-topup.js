const { ethers } = require("ethers");
require("dotenv").config();
const contractConfig = require("../../frontend/src/config/contract.json");
const pharmaChainArtifact = require("../artifacts/contracts/PharmaChain.sol/PharmaChain.json");

const DAY = 24 * 60 * 60;

async function main() {
  console.log("Topping up ETH and setting up active actions for every user...");

  const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
  const admin = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  const distributorAddr = ethers.getAddress("0xbC45d67DE06E7D8484c52833e86B9DbD2A303C94");
  const pharmacyAddr = ethers.getAddress("0x0e153B9dA5F433226fD0e1Ed1c76770Ef451C993");

  // 1. Top up Distributor & Pharmacy
  console.log("\n1. Topping up Distributor with 0.002 Sepolia ETH...");
  const tx1 = await admin.sendTransaction({
    to: distributorAddr,
    value: ethers.parseEther("0.002"),
  });
  await tx1.wait();
  console.log(`Distributor topped up! Tx: ${tx1.hash}`);

  console.log("\n2. Topping up Pharmacy with 0.0015 Sepolia ETH...");
  const tx2 = await admin.sendTransaction({
    to: pharmacyAddr,
    value: ethers.parseEther("0.0015"),
  });
  await tx2.wait();
  console.log(`Pharmacy topped up! Tx: ${tx2.hash}`);

  // 2. Setup batch for Pharmacy: MFR registers -> Transfers to a temp Distributor -> Temp Distributor transfers to Pharmacy (IN_TRANSIT_TO_P)
  console.log("\n3. Setting up a batch in transit to Pharmacy (0x0e15...)...");
  const contractAdmin = new ethers.Contract(contractConfig.contractAddress, pharmaChainArtifact.abi, admin);

  const tempMfr = ethers.Wallet.createRandom().connect(provider);
  const tempDist = ethers.Wallet.createRandom().connect(provider);

  // Fund temp actors
  const f1 = await admin.sendTransaction({ to: tempMfr.address, value: ethers.parseEther("0.0015") });
  await f1.wait();
  const f2 = await admin.sendTransaction({ to: tempDist.address, value: ethers.parseEther("0.0015") });
  await f2.wait();

  // Authorize temp actors
  const a1 = await contractAdmin.authorizeParticipant(tempMfr.address, 2, "Sun Pharma Labs");
  await a1.wait();
  const a2 = await contractAdmin.authorizeParticipant(tempDist.address, 3, "Express ColdChain");
  await a2.wait();

  const cMfr = new ethers.Contract(contractConfig.contractAddress, pharmaChainArtifact.abi, tempMfr);
  const cDist = new ethers.Contract(contractConfig.contractAddress, pharmaChainArtifact.abi, tempDist);

  const block = await provider.getBlock("latest");
  const now = block.timestamp;
  const batchPharm = "APOLLO-CET-2026-008";

  console.log(`Registering ${batchPharm}...`);
  const rTx = await cMfr.registerMedicine(
    batchPharm,
    "Cetirizine 10mg Allergy Relief",
    "Sun Pharma Labs",
    now - 10 * DAY,
    now + 730 * DAY
  );
  await rTx.wait();

  console.log(`Transferring ${batchPharm} to Express ColdChain...`);
  const t1 = await cMfr.transferMedicine(batchPharm, tempDist.address);
  await t1.wait();

  console.log(`Express ColdChain receiving ${batchPharm}...`);
  const rec1 = await cDist.receiveMedicine(batchPharm);
  await rec1.wait();

  console.log(`Express ColdChain transferring ${batchPharm} to user Pharmacy (${pharmacyAddr})...`);
  const t2 = await cDist.transferMedicine(batchPharm, pharmacyAddr);
  await t2.wait();
  console.log(`Batch ${batchPharm} is now IN TRANSIT to your Pharmacy!`);

  // Sweep leftover funds from temp wallets back to Admin
  for (const w of [tempMfr, tempDist]) {
    try {
      const bal = await provider.getBalance(w.address);
      if (bal > ethers.parseEther("0.0003")) {
        const sw = await w.sendTransaction({ to: admin.address, value: bal - ethers.parseEther("0.0003") });
        await sw.wait();
      }
    } catch (_) {}
  }

  console.log("\n=======================================================");
  console.log("All users topped up and ready with active actions!");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exitCode = 1;
});
