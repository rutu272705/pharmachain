const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PharmaChain", function () {
  let pharmaChain;
  let admin, manufacturer, distributor, pharmacy, stranger;

  const DAY = 86_400;

  // Role enum values (must match Solidity enum order)
  const Role = { NONE: 0, ADMIN: 1, MANUFACTURER: 2, DISTRIBUTOR: 3, PHARMACY: 4 };
  const Status = {
    REGISTERED: 0,
    IN_TRANSIT_TO_D: 1,
    AT_DISTRIBUTOR: 2,
    IN_TRANSIT_TO_P: 3,
    AT_PHARMACY: 4,
    DISPENSED: 5,
  };

  const BATCH = "BATCH-TEST-001";

  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacy, stranger] = await ethers.getSigners();

    const PharmaChain = await ethers.getContractFactory("PharmaChain");
    pharmaChain = await PharmaChain.deploy();
    await pharmaChain.waitForDeployment();

    // Authorize participants
    await pharmaChain.connect(admin).authorizeParticipant(manufacturer.address, Role.MANUFACTURER, "Cipla Ltd");
    await pharmaChain.connect(admin).authorizeParticipant(distributor.address,  Role.DISTRIBUTOR,  "MedLogistics");
    await pharmaChain.connect(admin).authorizeParticipant(pharmacy.address,     Role.PHARMACY,     "Apollo Pharmacy");
  });

  // Helper: get current block timestamp and compute dates relative to it
  async function getDates() {
    const now = await time.latest();
    return { mfgDate: now - DAY, expiryDate: now + 365 * DAY };
  }

  // ══════════════════════════════════════════════════════════════════
  //  1. ROLE MANAGEMENT
  // ══════════════════════════════════════════════════════════════════
  describe("Role Management", function () {
    it("should set deployer as admin", async function () {
      expect(await pharmaChain.getAdmin()).to.equal(admin.address);
    });

    it("should return the admin and authorized participants", async function () {
      const participants = await pharmaChain.getAllParticipants();
      expect(participants).to.include(admin.address);
      expect(participants).to.include(manufacturer.address);
      expect(participants).to.include(distributor.address);
      expect(participants).to.include(pharmacy.address);
    });

    it("should authorize a manufacturer correctly", async function () {
      const p = await pharmaChain.getParticipant(manufacturer.address);
      expect(p.role).to.equal(Role.MANUFACTURER);
      expect(p.authorized).to.be.true;
      expect(p.name).to.equal("Cipla Ltd");
    });

    it("should emit ParticipantAuthorized event", async function () {
      const newWallet = stranger.address;
      const tx = await pharmaChain.connect(admin).authorizeParticipant(newWallet, Role.DISTRIBUTOR, "NewDist");
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      await expect(tx)
        .to.emit(pharmaChain, "ParticipantAuthorized")
        .withArgs(newWallet, Role.DISTRIBUTOR, "NewDist", block.timestamp);
    });

    it("should reject non-admin authorizing participants", async function () {
      await expect(
        pharmaChain.connect(stranger).authorizeParticipant(stranger.address, Role.MANUFACTURER, "Fake")
      ).to.be.revertedWithCustomError(pharmaChain, "NotAdmin");
    });

    it("should revoke a participant", async function () {
      await pharmaChain.connect(admin).revokeParticipant(manufacturer.address);
      const p = await pharmaChain.getParticipant(manufacturer.address);
      expect(p.authorized).to.be.false;
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  2. MEDICINE REGISTRATION
  // ══════════════════════════════════════════════════════════════════
  describe("Medicine Registration", function () {
    it("should register a medicine batch successfully", async function () {
      const { mfgDate, expiryDate } = await getDates();
      const tx = await pharmaChain.connect(manufacturer).registerMedicine(
        BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(pharmaChain, "MedicineRegistered")
        .withArgs(BATCH, "Paracetamol 500mg", manufacturer.address, expiryDate, block.timestamp);

      const med = await pharmaChain.getMedicine(BATCH);
      expect(med.batchId).to.equal(BATCH);
      expect(med.name).to.equal("Paracetamol 500mg");
      expect(med.currentOwner).to.equal(manufacturer.address);
      expect(med.status).to.equal(Status.REGISTERED);
    });

    it("should reject duplicate batch IDs", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await expect(
        pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Ibuprofen 400mg", "Cipla Ltd", mfgDate, expiryDate)
      ).to.be.revertedWithCustomError(pharmaChain, "BatchAlreadyExists");
    });

    it("should reject registration by unauthorized address", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await expect(
        pharmaChain.connect(stranger).registerMedicine(BATCH, "Aspirin", "Stranger Corp", mfgDate, expiryDate)
      ).to.be.revertedWithCustomError(pharmaChain, "NotAuthorized");
    });

    it("should reject registration by distributor (wrong role)", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await expect(
        pharmaChain.connect(distributor).registerMedicine(BATCH, "Aspirin", "Cipla Ltd", mfgDate, expiryDate)
      ).to.be.revertedWithCustomError(pharmaChain, "NotAuthorized");
    });

    it("should reject invalid dates (expiry before manufacturing)", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await expect(
        pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Aspirin", "Cipla Ltd", expiryDate, mfgDate)
      ).to.be.revertedWithCustomError(pharmaChain, "InvalidDates");
    });

    it("should reject already-expired medicine", async function () {
      const now = await time.latest();
      const pastExpiry = now - 10;   // clearly past
      const pastMfg    = now - 2 * DAY;
      await expect(
        pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Aspirin", "Cipla Ltd", pastMfg, pastExpiry)
      ).to.be.revertedWithCustomError(pharmaChain, "BatchExpired");
    });

    it("should reject empty batch ID", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await expect(
        pharmaChain.connect(manufacturer).registerMedicine("", "Aspirin", "Cipla Ltd", mfgDate, expiryDate)
      ).to.be.revertedWithCustomError(pharmaChain, "EmptyString");
    });

    it("should add batch to getAllBatchIds()", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      const ids = await pharmaChain.getAllBatchIds();
      expect(ids).to.include(BATCH);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  3. TRANSFER: Manufacturer → Distributor
  // ══════════════════════════════════════════════════════════════════
  describe("Transfer: Manufacturer → Distributor", function () {
    beforeEach(async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
    });

    it("should transfer a batch to an authorized distributor", async function () {
      const tx = await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(pharmaChain, "MedicineTransferred")
        .withArgs(BATCH, manufacturer.address, distributor.address, Status.IN_TRANSIT_TO_D, block.timestamp);

      const med = await pharmaChain.getMedicine(BATCH);
      expect(med.status).to.equal(Status.IN_TRANSIT_TO_D);
    });

    it("should reject transfer by non-owner", async function () {
      await expect(
        pharmaChain.connect(stranger).transferMedicine(BATCH, distributor.address)
      ).to.be.revertedWithCustomError(pharmaChain, "NotCurrentOwner");
    });

    it("should reject transfer to unauthorized address", async function () {
      await expect(
        pharmaChain.connect(manufacturer).transferMedicine(BATCH, stranger.address)
      ).to.be.revertedWithCustomError(pharmaChain, "RecipientNotAuthorized");
    });

    it("should reject transfer to pharmacy (must go to distributor first)", async function () {
      await expect(
        pharmaChain.connect(manufacturer).transferMedicine(BATCH, pharmacy.address)
      ).to.be.revertedWithCustomError(pharmaChain, "RecipientNotAuthorized");
    });

    it("should reject transfer of an expired batch", async function () {
      const now = await time.latest();
      const nearExpiry = now + 3;
      await pharmaChain.connect(manufacturer).registerMedicine(
        "BATCH-EXP", "ExpiredMed", "Cipla Ltd", now - DAY, nearExpiry
      );
      await time.increase(10);
      await expect(
        pharmaChain.connect(manufacturer).transferMedicine("BATCH-EXP", distributor.address)
      ).to.be.revertedWithCustomError(pharmaChain, "BatchExpired");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  4. RECEIVE: Distributor acknowledges
  // ══════════════════════════════════════════════════════════════════
  describe("Receive: Distributor acknowledges", function () {
    beforeEach(async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
    });

    it("should let distributor acknowledge receipt", async function () {
      const tx = await pharmaChain.connect(distributor).receiveMedicine(BATCH);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(pharmaChain, "MedicineReceived")
        .withArgs(BATCH, distributor.address, Status.AT_DISTRIBUTOR, block.timestamp);

      const med = await pharmaChain.getMedicine(BATCH);
      expect(med.status).to.equal(Status.AT_DISTRIBUTOR);
      expect(med.currentOwner).to.equal(distributor.address);
    });

    it("should reject receipt by wrong address", async function () {
      await expect(
        pharmaChain.connect(stranger).receiveMedicine(BATCH)
      ).to.be.revertedWithCustomError(pharmaChain, "NotIntendedRecipient");
    });

    it("should reject receipt when no pending transfer", async function () {
      await pharmaChain.connect(distributor).receiveMedicine(BATCH);
      await expect(
        pharmaChain.connect(distributor).receiveMedicine(BATCH)
      ).to.be.revertedWithCustomError(pharmaChain, "NoPendingTransfer");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  5. TRANSFER: Distributor → Pharmacy
  // ══════════════════════════════════════════════════════════════════
  describe("Transfer: Distributor → Pharmacy", function () {
    beforeEach(async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
      await pharmaChain.connect(distributor).receiveMedicine(BATCH);
    });

    it("should transfer from distributor to pharmacy", async function () {
      const tx = await pharmaChain.connect(distributor).transferMedicine(BATCH, pharmacy.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(pharmaChain, "MedicineTransferred")
        .withArgs(BATCH, distributor.address, pharmacy.address, Status.IN_TRANSIT_TO_P, block.timestamp);

      const med = await pharmaChain.getMedicine(BATCH);
      expect(med.status).to.equal(Status.IN_TRANSIT_TO_P);
    });

    it("should reject transfer from distributor directly to another distributor", async function () {
      const [, , , , , dist2] = await ethers.getSigners();
      await pharmaChain.connect(admin).authorizeParticipant(dist2.address, Role.DISTRIBUTOR, "Dist2");
      await expect(
        pharmaChain.connect(distributor).transferMedicine(BATCH, dist2.address)
      ).to.be.revertedWithCustomError(pharmaChain, "RecipientNotAuthorized");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  6. RECEIVE: Pharmacy acknowledges
  // ══════════════════════════════════════════════════════════════════
  describe("Receive: Pharmacy acknowledges", function () {
    beforeEach(async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
      await pharmaChain.connect(distributor).receiveMedicine(BATCH);
      await pharmaChain.connect(distributor).transferMedicine(BATCH, pharmacy.address);
    });

    it("should let pharmacy acknowledge receipt", async function () {
      const tx = await pharmaChain.connect(pharmacy).receiveMedicine(BATCH);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(pharmaChain, "MedicineReceived")
        .withArgs(BATCH, pharmacy.address, Status.AT_PHARMACY, block.timestamp);

      const med = await pharmaChain.getMedicine(BATCH);
      expect(med.status).to.equal(Status.AT_PHARMACY);
      expect(med.currentOwner).to.equal(pharmacy.address);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  7. DISPENSE
  // ══════════════════════════════════════════════════════════════════
  describe("Dispense", function () {
    beforeEach(async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
      await pharmaChain.connect(distributor).receiveMedicine(BATCH);
      await pharmaChain.connect(distributor).transferMedicine(BATCH, pharmacy.address);
      await pharmaChain.connect(pharmacy).receiveMedicine(BATCH);
    });

    it("should dispense a medicine", async function () {
      const tx = await pharmaChain.connect(pharmacy).dispenseMedicine(BATCH);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(pharmaChain, "MedicineDispensed")
        .withArgs(BATCH, pharmacy.address, block.timestamp);

      const med = await pharmaChain.getMedicine(BATCH);
      expect(med.status).to.equal(Status.DISPENSED);
    });

    it("should reject dispense by non-pharmacy", async function () {
      await expect(
        pharmaChain.connect(stranger).dispenseMedicine(BATCH)
      ).to.be.revertedWithCustomError(pharmaChain, "NotAuthorized");
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  8. SUPPLY CHAIN HISTORY
  // ══════════════════════════════════════════════════════════════════
  describe("Supply Chain History", function () {
    it("should record full history correctly", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
      await pharmaChain.connect(distributor).receiveMedicine(BATCH);
      await pharmaChain.connect(distributor).transferMedicine(BATCH, pharmacy.address);
      await pharmaChain.connect(pharmacy).receiveMedicine(BATCH);

      const hist = await pharmaChain.getMedicineHistory(BATCH);
      expect(hist.length).to.equal(5);
      expect(hist[0].action).to.equal(Status.REGISTERED);
      expect(hist[4].action).to.equal(Status.AT_PHARMACY);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  9. MEDICINE VERIFICATION
  // ══════════════════════════════════════════════════════════════════
  describe("Medicine Verification", function () {
    it("should return exists=false for unknown batch", async function () {
      const result = await pharmaChain.verifyMedicine("UNKNOWN-BATCH");
      expect(result.exists_).to.be.false;
    });

    it("should return exists=true and not expired for valid batch", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      const result = await pharmaChain.verifyMedicine(BATCH);
      expect(result.exists_).to.be.true;
      expect(result.isExpired_).to.be.false;
      expect(result.name_).to.equal("Paracetamol 500mg");
    });

    it("should return isExpired=true for expired batch", async function () {
      // Register with a future expiry far enough ahead (not expired at registration)
      // then warp time past it
      const now = await time.latest();
      const nearExpiry = now + 5; // expires in 5 seconds of blockchain time
      await pharmaChain.connect(manufacturer).registerMedicine(
        "BATCH-EXP2", "ExpiredMed", "Cipla Ltd", now - DAY, nearExpiry
      );
      await time.increase(10); // warp 10 seconds
      const result = await pharmaChain.verifyMedicine("BATCH-EXP2");
      expect(result.exists_).to.be.true;
      expect(result.isExpired_).to.be.true;
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  10. INVALID OWNERSHIP TRANSITIONS
  // ══════════════════════════════════════════════════════════════════
  describe("Invalid Ownership Transitions", function () {
    it("should reject manufacturer transferring again while batch is in transit", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
      // Manufacturer is still currentOwner but status is IN_TRANSIT_TO_D.
      // The transition is invalid (can't re-transfer while in transit) → InvalidTransition.
      await expect(
        pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address)
      ).to.be.revertedWithCustomError(pharmaChain, "InvalidTransition");
    });

    it("should reject pharmacy role receiving in transit-to-distributor state", async function () {
      const { mfgDate, expiryDate } = await getDates();
      await pharmaChain.connect(manufacturer).registerMedicine(BATCH, "Paracetamol 500mg", "Cipla Ltd", mfgDate, expiryDate);
      await pharmaChain.connect(manufacturer).transferMedicine(BATCH, distributor.address);
      // Change the pending transfer target to pharmacy in a contrived way is not possible;
      // simply confirm pharmacy cannot call receiveMedicine (wrong intended recipient)
      await expect(
        pharmaChain.connect(pharmacy).receiveMedicine(BATCH)
      ).to.be.revertedWithCustomError(pharmaChain, "NotIntendedRecipient");
    });
  });
});
