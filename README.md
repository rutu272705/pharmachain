# PharmaChain 🔗💊

**Blockchain-Based Pharmaceutical Supply Chain Tracking and Medicine Verification System**

*Mumbai University BLC Mini-Project*

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + JavaScript |
| Blockchain | Solidity 0.8.24 + Hardhat 2.x |
| Chain | Ethereum-compatible (Hardhat Local, Chain ID 1337) |
| Wallet | MetaMask |
| Blockchain Library | Ethers.js v6 |
| QR Code | qrcode.react + html5-qrcode |

---

## Project Structure

```
PharmaChain/
├── blockchain/
│   ├── contracts/
│   │   └── PharmaChain.sol          # Main smart contract
│   ├── scripts/
│   │   └── deploy.js                # Deployment script
│   ├── test/
│   │   └── PharmaChain.test.js      # 32 automated tests
│   ├── hardhat.config.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx           # Sidebar + topbar shell
│   │   │   └── WalletStatus.jsx     # Wallet connection indicator
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Overview stats + recent activity
│   │   │   ├── ConnectWallet.jsx    # MetaMask connection + setup guide
│   │   │   ├── RegisterMedicine.jsx # Batch registration form
│   │   │   ├── SupplyChain.jsx      # Transfer / receive / dispense
│   │   │   ├── Verification.jsx     # Public batch search & verify
│   │   │   ├── TransactionHistory.jsx # On-chain event log
│   │   │   ├── ParticipantManagement.jsx # Admin: authorize wallets
│   │   │   └── QRCodePage.jsx       # QR generate + camera scan
│   │   ├── hooks/
│   │   │   └── useWallet.jsx        # MetaMask connection context
│   │   ├── services/
│   │   │   └── contractService.js   # All contract interactions
│   │   ├── styles/
│   │   │   └── global.css           # Healthcare + blockchain theme
│   │   ├── config/
│   │   │   ├── contract.json        # Auto-generated after deploy
│   │   │   └── PharmaChainABI.json  # Auto-generated after deploy
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## Quick Start — Complete Setup (Windows / PowerShell)

### Prerequisites
- Node.js v18+ (you have v22) ✅
- MetaMask browser extension installed

### Step 1 — Install blockchain dependencies

```powershell
cd c:\Users\rutuj\Desktop\blcproj\blockchain
npm install
```

### Step 2 — Compile the smart contract

```powershell
npx hardhat compile
```

Expected output: `Compiled 1 Solidity file successfully`

### Step 3 — Run automated tests

```powershell
npx hardhat test
```

Expected output: **32 passing**

### Step 4 — Start local blockchain (Terminal 1 — keep open)

```powershell
npx hardhat node
```

You will see 20 test accounts with private keys and 10,000 test ETH each.
**⚠ These are development accounts only. Never use on mainnet.**

### Step 5 — Deploy the contract (Terminal 2)

```powershell
npx hardhat run scripts/deploy.js --network localhost
```

This will:
- Deploy PharmaChain to your local chain
- Print the contract address
- Auto-write `frontend/src/config/contract.json` and `PharmaChainABI.json`

This project explicitly configures Hardhat Local to use **Chain ID 1337** (not the usual Hardhat default of 31337). Use the RPC URL and chain ID shown in the generated `frontend/src/config/contract.json` when configuring MetaMask. The deployer (Account #0 on the local Hardhat node) becomes the contract administrator. After restarting the local node, deploy again before using the frontend; deployment regenerates the frontend address and ABI.

### Step 6 — Add demo medicine data (Terminal 2)

With the Hardhat node still running, seed three fictional medicine batches onto the local blockchain:

```powershell
cd c:\Users\rutuj\Desktop\blcproj\blockchain
npm run seed:local
```

The script authorizes a demo manufacturer wallet and registers `DEMO-PARA-001`, `DEMO-CET-002`, and `DEMO-ORS-003`. It is safe to run again; existing demo batches are skipped. This is fictional test data, and the script only runs against the local Hardhat network.

### Step 7 — Install frontend dependencies (Terminal 2)

```powershell
cd c:\Users\rutuj\Desktop\blcproj\frontend
npm install
```

### Step 8 — Start the React frontend (Terminal 2)

```powershell
npm run dev
```

Open: **http://localhost:5173**

---

## MetaMask Setup

### Add Hardhat Local Network

In MetaMask → Settings → Networks → Add a network → Add manually:

| Field | Value |
|-------|-------|
| Network Name | Hardhat Local |
| RPC URL | http://127.0.0.1:8545 |
| Chain ID | 1337 |
| Currency Symbol | ETH |
| Block Explorer | (leave blank) |

### Import Test Accounts

From the `npx hardhat node` output, copy a **Private Key** for Account #0–#9.

MetaMask → Account circle → Import account → Private Key → Paste → Import

> ⚠ **Security Warning**: These private keys are public development keys.
> NEVER use them on mainnet. NEVER share your real MetaMask Secret Recovery Phrase.

**Recommended account assignment for demo:**
- **Account #0** → Admin (the deployer)
- **Account #1** → Import into MetaMask, authorize as Manufacturer
- **Account #2** → Import into MetaMask, authorize as Distributor
- **Account #3** → Import into MetaMask, authorize as Pharmacy

---

## Complete Demo Workflow

### Step 1: Setup (Admin — Account #0)

1. Open http://localhost:5173
2. Connect MetaMask (Account #0 = Admin)
3. Go to **Participants** page
4. Authorize Account #1 as Manufacturer, Account #2 as Distributor, Account #3 as Pharmacy

### Step 2: Register Medicine (Account #1 = Manufacturer)

1. Switch MetaMask to Account #1
2. Go to **Register Medicine**
3. Enter: Batch ID, medicine name, manufacturer name, dates
4. Click **Register on Blockchain** → Approve in MetaMask
5. Note the transaction hash

### Step 3: Transfer to Distributor (Account #1 = Manufacturer)

1. Go to **Supply Chain**
2. Find the batch → Click **Transfer**
3. Select the Distributor address
4. Approve in MetaMask

### Step 4: Receive at Distributor (Account #2 = Distributor)

1. Switch MetaMask to Account #2
2. Go to **Supply Chain**
3. Click **Receive** on the batch in transit → Approve in MetaMask

### Step 5: Transfer to Pharmacy (Account #2 = Distributor)

1. Click **Transfer** → Select Pharmacy address → Approve in MetaMask

### Step 6: Receive at Pharmacy (Account #3 = Pharmacy)

1. Switch MetaMask to Account #3
2. Click **Receive** → Approve in MetaMask

### Step 7: Verify as Public User

1. Go to **Verify Medicine**
2. Enter the batch ID → See full supply-chain history
3. Or go to **QR Code** → Generate QR → Scan to verify

---

## Smart Contract Overview

### Roles
| Role | Value | Permissions |
|------|-------|-------------|
| ADMIN | 1 | Authorize/revoke participants |
| MANUFACTURER | 2 | Register batches, transfer to distributors |
| DISTRIBUTOR | 3 | Receive from manufacturers, transfer to pharmacies |
| PHARMACY | 4 | Receive from distributors, dispense medicines |

### Supply Chain State Machine

```
REGISTERED (0)
    ↓ transferMedicine() by MANUFACTURER
IN_TRANSIT_TO_DISTRIBUTOR (1)
    ↓ receiveMedicine() by DISTRIBUTOR
AT_DISTRIBUTOR (2)
    ↓ transferMedicine() by DISTRIBUTOR
IN_TRANSIT_TO_PHARMACY (3)
    ↓ receiveMedicine() by PHARMACY
AT_PHARMACY (4)
    ↓ dispenseMedicine() by PHARMACY
DISPENSED (5)
```

### Key Functions
- `registerMedicine()` — Only MANUFACTURER; rejects duplicates and expired dates
- `transferMedicine()` — Only current owner; validates supply-chain transition
- `receiveMedicine()` — Only intended recipient; validates pending transfer
- `dispenseMedicine()` — Only PHARMACY holding the batch
- `verifyMedicine()` — Public; returns existence, expiry, status
- `getMedicineHistory()` — Public; returns full supply-chain journal
- `authorizeParticipant()` — Only ADMIN; assigns roles

---

## Common Errors and Fixes

### "MetaMask is not installed"
→ Install MetaMask from https://metamask.io/download/

### "Wrong Network (Chain ID mismatch)"
→ Use the network values in `frontend/src/config/contract.json`. This project currently uses Chain ID 1337 at `http://127.0.0.1:8545`; do not use 31337 unless you also change the Hardhat configuration and redeploy.

### `getAllParticipants()` returns `BAD_DATA` / `0x`
→ The configured address has no compatible contract on the selected chain. Switch MetaMask to the configured local network. If the node was restarted, run `npm run deploy:local` from `blockchain` while `npm run node` is running; deployment refreshes the frontend address and ABI.

### Participants says your role is `NONE`
→ Connect the account shown as `Contract Admin` on the Connect Wallet page. On the local Hardhat node, Account #0 is the deployer and becomes admin; use Participants to grant MANUFACTURER, DISTRIBUTOR, or PHARMACY to the corresponding wallet address.

### "Insufficient funds for gas"
→ Make sure you imported a Hardhat test account with 10,000 test ETH

### "Transaction rejected"
→ You clicked Cancel in the MetaMask popup. Try again.

### "Only authorized manufacturers can register"
→ Admin must authorize your wallet on the **Participants** page first

### "Nonce too high" in MetaMask
→ MetaMask → Settings → Advanced → Clear activity tab data (Reset account)

### Contract address is 0x000...
→ Run `npx hardhat run scripts/deploy.js --network localhost` first

### "Cannot read properties of undefined"
→ Ensure `npx hardhat node` is still running in Terminal 1

---

## Important Disclaimer

> **Blockchain Verification Scope**: PharmaChain verifies that a batch with a given ID is
> registered on the blockchain and checks its recorded supply-chain history.
> It **cannot** independently confirm whether the physical medicine in your hand
> matches the registered batch without additional physical authentication mechanisms
> (tamper-evident packaging, holograms, serialized labels, etc.).
> The blockchain provides a tamper-evident record of registered data — it does not
> physically inspect medicine.

---

## Test Results

```
32 passing (3s)

✓ Role Management (5 tests)
✓ Medicine Registration (8 tests)
✓ Transfer: Manufacturer → Distributor (5 tests)
✓ Receive: Distributor acknowledges (3 tests)
✓ Transfer: Distributor → Pharmacy (2 tests)
✓ Receive: Pharmacy acknowledges (1 test)
✓ Dispense (2 tests)
✓ Supply Chain History (1 test)
✓ Medicine Verification (3 tests)
✓ Invalid Ownership Transitions (2 tests)
```

---

*PharmaChain — Mumbai University Blockchain Mini-Project*
