const { ethers } = require("ethers");
require("dotenv").config();
const contractConfig = require("../../frontend/src/config/contract.json");
const pharmaChainArtifact = require("../artifacts/contracts/PharmaChain.sol/PharmaChain.json");

const DAY = 24 * 60 * 60;

async function main() {
  console.log("=======================================================");
  console.log("Seeding Full Supply Chain Lifecycle Data on Sepolia...");
  console.log("=======================================================");

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const admin = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const contractAddress = contractConfig.contractAddress;

  console.log(`Admin Wallet: ${admin.address}`);
  console.log(`Contract: ${contractAddress}`);

  const contractAdmin = new ethers.Contract(contractAddress, pharmaChainArtifact.abi, admin);

  // 1. Create Wallets for Manufacturer, Distributor, Pharmacy
  const mfrWallet = ethers.Wallet.createRandom().connect(provider);
  const distWallet = ethers.Wallet.createRandom().connect(provider);
  const pharmWallet = ethers.Wallet.createRandom().connect(provider);

  console.log(`Manufacturer Actor: ${mfrWallet.address}`);
  console.log(`Distributor Actor:  ${distWallet.address}`);
  console.log(`Pharmacy Actor:     ${pharmWallet.address}`);

  // 2. Fund all three actors from Admin sequentially
  console.log("\nFunding actors with gas sequentially...");
  const fund1 = await admin.sendTransaction({ to: mfrWallet.address, value: ethers.parseEther("0.0025") });
  await fund1.wait();
  console.log("Manufacturer funded.");

  const fund2 = await admin.sendTransaction({ to: distWallet.address, value: ethers.parseEther("0.0015") });
  await fund2.wait();
  console.log("Distributor funded.");

  const fund3 = await admin.sendTransaction({ to: pharmWallet.address, value: ethers.parseEther("0.0015") });
  await fund3.wait();
  console.log("Pharmacy funded.");

  // 3. Authorize participants on PharmaChain
  console.log("\nAuthorizing participants...");
  const auth1 = await contractAdmin.authorizeParticipant(mfrWallet.address, 2, "Sun Pharma Laboratories");
  await auth1.wait();
  console.log("Authorized: Sun Pharma Laboratories (Manufacturer)");

  const auth2 = await contractAdmin.authorizeParticipant(distWallet.address, 3, "DHL Medical Logistics");
  await auth2.wait();
  console.log("Authorized: DHL Medical Logistics (Distributor)");

  const auth3 = await contractAdmin.authorizeParticipant(pharmWallet.address, 4, "Apollo 24|7 Pharmacy Mumbai");
  await auth3.wait();
  console.log("Authorized: Apollo 24|7 Pharmacy Mumbai (Pharmacy)");

  const contractMfr = new ethers.Contract(contractAddress, pharmaChainArtifact.abi, mfrWallet);
  const contractDist = new ethers.Contract(contractAddress, pharmaChainArtifact.abi, distWallet);
  const contractPharm = new ethers.Contract(contractAddress, pharmaChainArtifact.abi, pharmWallet);

  const block = await provider.getBlock("latest");
  const now = block.timestamp;

  // 4. Batch A: Sun Pharma Metformin -> In Transit -> At Distributor
  const batchA = "SUN-MET-2026-004";
  console.log(`\nRegistering & moving ${batchA}...`);
  const regA = await contractMfr.registerMedicine(
    batchA,
    "Metformin 500mg SR Tablets",
    "Sun Pharma Laboratories",
    now - 20 * DAY,
    now + 700 * DAY
  );
  await regA.wait();
  console.log(`Registered ${batchA}`);

  const txTransferA = await contractMfr.transferMedicine(batchA, distWallet.address);
  await txTransferA.wait();
  console.log(`Transferred ${batchA} to DHL Medical Logistics (IN_TRANSIT_TO_D)`);

  const txReceiveA = await contractDist.receiveMedicine(batchA);
  await txReceiveA.wait();
  console.log(`DHL Medical Logistics received ${batchA} (AT_DISTRIBUTOR)`);

  // 5. Batch B: Full Lifecycle to DISPENSED
  const batchB = "DRREDDY-OMEP-2026-005";
  console.log(`\nRegistering & advancing ${batchB} to DISPENSED...`);
  const regB = await contractMfr.registerMedicine(
    batchB,
    "Omeprazole 20mg Capsules",
    "Dr. Reddy's Laboratories",
    now - 40 * DAY,
    now + 600 * DAY
  );
  await regB.wait();
  console.log(`Registered ${batchB}`);

  const txTransferB1 = await contractMfr.transferMedicine(batchB, distWallet.address);
  await txTransferB1.wait();

  const txReceiveB1 = await contractDist.receiveMedicine(batchB);
  await txReceiveB1.wait();

  const txTransferB2 = await contractDist.transferMedicine(batchB, pharmWallet.address);
  await txTransferB2.wait();
  console.log(`Transferred ${batchB} to Apollo 24|7 Pharmacy (IN_TRANSIT_TO_P)`);

  const txReceiveB2 = await contractPharm.receiveMedicine(batchB);
  await txReceiveB2.wait();
  console.log(`Apollo Pharmacy received ${batchB} (AT_PHARMACY)`);

  const txDispense = await contractPharm.dispenseMedicine(batchB);
  await txDispense.wait();
  console.log(`Apollo Pharmacy dispensed ${batchB} to patient (DISPENSED)!`);

  // 6. Batch C: Currently IN TRANSIT
  const batchC = "SERUM-COV-2026-006";
  console.log(`\nRegistering ${batchC} and placing IN TRANSIT...`);
  const regC = await contractMfr.registerMedicine(
    batchC,
    "Covishield Booster Dose 0.5ml",
    "Serum Institute of India",
    now - 10 * DAY,
    now + 365 * DAY
  );
  await regC.wait();

  const txTransferC = await contractMfr.transferMedicine(batchC, distWallet.address);
  await txTransferC.wait();
  console.log(`Placed ${batchC} IN TRANSIT to Distributor!`);

  // 7. Sweep remaining funds back to Admin
  console.log("\nSweeping leftover funds back to Admin...");
  for (const wallet of [mfrWallet, distWallet, pharmWallet]) {
    try {
      const bal = await provider.getBalance(wallet.address);
      if (bal > ethers.parseEther("0.0004")) {
        const sweep = bal - ethers.parseEther("0.0004");
        const swTx = await wallet.sendTransaction({ to: admin.address, value: sweep });
        await swTx.wait();
      }
    } catch (e) {}
  }
  console.log("Sweep complete.");

  console.log("\n=======================================================");
  console.log("All lifecycle stages successfully created on Sepolia!");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Error seeding more data:", err);
  process.exitCode = 1;
});
