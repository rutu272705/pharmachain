const { ethers } = require("ethers");
require("dotenv").config();
const contractConfig = require("../../frontend/src/config/contract.json");
const pharmaChainArtifact = require("../artifacts/contracts/PharmaChain.sol/PharmaChain.json");

async function main() {
  console.log("Authorizing user's MetaMask accounts on Ethereum Sepolia...");

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const admin = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  const contract = new ethers.Contract(contractConfig.contractAddress, pharmaChainArtifact.abi, admin);

  const distributorAddr = ethers.getAddress("0xbC45d67DE06E7D8484c52833e86B9DbD2A303C94");
  const pharmacyAddr = ethers.getAddress("0x0e153B9dA5F433226fD0e1Ed1c76770Ef451C993");

  console.log(`Admin Wallet:      ${admin.address}`);
  console.log(`Distributor to set: ${distributorAddr}`);
  console.log(`Pharmacy to set:    ${pharmacyAddr}`);

  // 1. Authorize Distributor (Role 3)
  console.log("\n1. Authorizing Distributor on PharmaChain...");
  const txDist = await contract.authorizeParticipant(distributorAddr, 3, "MedExpress Logistics");
  console.log(`Distributor Auth Tx: ${txDist.hash}`);
  await txDist.wait();
  console.log("Distributor successfully authorized on Sepolia!");

  // 2. Authorize Pharmacy (Role 4)
  console.log("\n2. Authorizing Pharmacy on PharmaChain...");
  const txPharm = await contract.authorizeParticipant(pharmacyAddr, 4, "Apollo Health Pharmacy");
  console.log(`Pharmacy Auth Tx: ${txPharm.hash}`);
  await txPharm.wait();
  console.log("Pharmacy successfully authorized on Sepolia!");

  // 3. Fund each account with 0.003 Sepolia ETH for gas fees
  console.log("\n3. Funding Distributor with 0.003 Sepolia ETH for gas...");
  const fundDist = await admin.sendTransaction({
    to: distributorAddr,
    value: ethers.parseEther("0.003"),
  });
  await fundDist.wait();
  console.log(`Distributor funded: ${fundDist.hash}`);

  console.log("\n4. Funding Pharmacy with 0.003 Sepolia ETH for gas...");
  const fundPharm = await admin.sendTransaction({
    to: pharmacyAddr,
    value: ethers.parseEther("0.003"),
  });
  await fundPharm.wait();
  console.log(`Pharmacy funded: ${fundPharm.hash}`);

  console.log("\n=======================================================");
  console.log("All accounts authorized and gas funded on Sepolia!");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Authorization failed:", err);
  process.exitCode = 1;
});
