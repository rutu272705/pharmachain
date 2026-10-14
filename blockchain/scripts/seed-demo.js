const hre = require("hardhat");
const contractConfig = require("../../frontend/src/config/contract.json");

const DAY = 24 * 60 * 60;
const DEMO_MANUFACTURER = "Demo Pharma Labs";
const DEMO_BATCHES = [
  { batchId: "DEMO-PARA-001", name: "Demo Paracetamol 500 mg Tablets", manufacturedDaysAgo: 60 },
  { batchId: "DEMO-CET-002", name: "Demo Cetirizine 10 mg Tablets", manufacturedDaysAgo: 45 },
  { batchId: "DEMO-ORS-003", name: "Demo ORS Sachets", manufacturedDaysAgo: 30 },
];

async function main() {
  if (hre.network.name !== "localhost") {
    throw new Error("Demo data can only be seeded on the localhost network.");
  }

  if (!contractConfig.contractAddress || contractConfig.contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Contract address is missing. Deploy PharmaChain before seeding demo data.");
  }

  const [admin, manufacturer] = await hre.ethers.getSigners();
  const pharmaChain = await hre.ethers.getContractAt("PharmaChain", contractConfig.contractAddress);
  const participant = await pharmaChain.getParticipant(manufacturer.address);

  if (!participant.authorized || Number(participant.role) !== 2) {
    const authorization = await pharmaChain.connect(admin).authorizeParticipant(
      manufacturer.address,
      2,
      DEMO_MANUFACTURER
    );
    await authorization.wait();
    console.log(`Authorized demo manufacturer: ${manufacturer.address}`);
  }

  const latestBlock = await hre.ethers.provider.getBlock("latest");
  const now = latestBlock.timestamp;
  const existingBatchIds = new Set(await pharmaChain.getAllBatchIds());
  let added = 0;

  for (const batch of DEMO_BATCHES) {
    if (existingBatchIds.has(batch.batchId)) {
      console.log(`Skipped existing batch: ${batch.batchId}`);
      continue;
    }

    const manufacturingDate = now - batch.manufacturedDaysAgo * DAY;
    const expiryDate = now + 365 * DAY;
    const tx = await pharmaChain.connect(manufacturer).registerMedicine(
      batch.batchId,
      batch.name,
      DEMO_MANUFACTURER,
      manufacturingDate,
      expiryDate
    );
    await tx.wait();
    console.log(`Registered ${batch.batchId}: ${batch.name}`);
    added += 1;
  }

  console.log(`Demo seeding complete. Added ${added} batch(es) on ${hre.network.name}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
