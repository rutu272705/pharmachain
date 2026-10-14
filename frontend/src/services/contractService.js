/**
 * PharmaChain Contract Service
 * All blockchain interactions go through this service.
 * Uses ethers.js v6.
 */
import { ethers } from 'ethers'
import contractConfig from '../config/contract.json'
import PharmaChainABI from '../config/PharmaChainABI.json'

const CONTRACT_ADDRESS = contractConfig.contractAddress

// ── Status / Role helpers ──────────────────────────────────────────
export const BATCH_STATUS = {
  0: 'Registered',
  1: 'In Transit → Distributor',
  2: 'At Distributor',
  3: 'In Transit → Pharmacy',
  4: 'At Pharmacy',
  5: 'Dispensed',
}

export const BATCH_STATUS_BADGE = {
  0: 'badge-primary',
  1: 'badge-warning',
  2: 'badge-info',
  3: 'badge-warning',
  4: 'badge-success',
  5: 'badge-muted',
}

export const ROLE_NAME = {
  0: 'None',
  1: 'Admin',
  2: 'Manufacturer',
  3: 'Distributor',
  4: 'Pharmacy',
}

export const ROLE_BADGE = {
  0: 'badge-muted',
  1: 'badge-error',
  2: 'badge-primary',
  3: 'badge-info',
  4: 'badge-success',
}

// ── Factory ────────────────────────────────────────────────────────
function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, PharmaChainABI, signerOrProvider)
}

// ── Error parser ───────────────────────────────────────────────────
export function parseContractError(err) {
  // User rejected in MetaMask
  if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
    return 'Transaction was rejected in MetaMask.'
  }
  // Try to extract custom error message from reason
  const msg = err.reason || err.message || ''
  if (msg.includes('BatchAlreadyExists'))      return 'A batch with this ID is already registered.'
  if (msg.includes('BatchNotFound'))           return 'Batch ID not found on the blockchain.'
  if (msg.includes('NotAdmin'))                return 'Only the admin can perform this action.'
  if (msg.includes('NotAuthorized'))           return 'You are not authorized to perform this action.'
  if (msg.includes('BatchExpired'))            return 'This medicine batch has expired.'
  if (msg.includes('NotCurrentOwner'))         return 'You are not the current owner of this batch.'
  if (msg.includes('NoPendingTransfer'))       return 'No pending transfer exists for this batch.'
  if (msg.includes('NotIntendedRecipient'))    return 'You are not the intended recipient of this transfer.'
  if (msg.includes('InvalidTransition'))       return 'This transfer is not allowed in the current batch state.'
  if (msg.includes('RecipientNotAuthorized'))  return 'The recipient is not an authorized participant.'
  if (msg.includes('InvalidDates'))            return 'Expiry date must be after manufacturing date.'
  if (msg.includes('EmptyString'))             return 'All fields are required and cannot be empty.'
  if (msg.includes('insufficient funds'))      return 'Insufficient ETH to pay for gas. Import a test account with ETH.'
  return msg || 'An unknown error occurred.'
}

// ── Admin / Role Management ────────────────────────────────────────

export async function authorizeParticipant(signer, wallet, role, name) {
  const contract = getContract(signer)
  const tx = await contract.authorizeParticipant(wallet, role, name)
  return await tx.wait()
}

export async function revokeParticipant(signer, wallet) {
  const contract = getContract(signer)
  const tx = await contract.revokeParticipant(wallet)
  return await tx.wait()
}

export async function getAllParticipants(provider) {
  const contract = getContract(provider)
  const addresses = await contract.getAllParticipants()
  const participants = await Promise.all(
    addresses.map(addr => contract.getParticipant(addr))
  )
  return participants.map((p, i) => ({
    wallet: addresses[i],
    role: Number(p.role),
    roleName: ROLE_NAME[Number(p.role)],
    name: p.name,
    authorized: p.authorized,
  }))
}

export async function getParticipant(provider, address) {
  const contract = getContract(provider)
  const p = await contract.getParticipant(address)
  return {
    wallet: address,
    role: Number(p.role),
    roleName: ROLE_NAME[Number(p.role)],
    name: p.name,
    authorized: p.authorized,
  }
}

// ── Medicine Registration ─────────────────────────────────────────

export async function registerMedicine(signer, { batchId, name, manufacturerName, manufacturingDate, expiryDate }) {
  const contract = getContract(signer)
  const mfgTs    = Math.floor(new Date(manufacturingDate).getTime() / 1000)
  const expTs    = Math.floor(new Date(expiryDate).getTime() / 1000)
  const tx = await contract.registerMedicine(batchId, name, manufacturerName, mfgTs, expTs)
  return await tx.wait()
}

// ── Medicine Queries ──────────────────────────────────────────────

export async function getAllBatchIds(provider) {
  const contract = getContract(provider)
  return await contract.getAllBatchIds()
}

export async function getMedicine(provider, batchId) {
  const contract = getContract(provider)
  const m = await contract.getMedicine(batchId)
  return formatMedicine(m)
}

export async function getMedicineHistory(provider, batchId) {
  const contract = getContract(provider)
  const hist = await contract.getMedicineHistory(batchId)
  return hist.map(h => ({
    from:      h.from,
    to:        h.to,
    action:    Number(h.action),
    actionName: BATCH_STATUS[Number(h.action)],
    timestamp: Number(h.timestamp),
    note:      h.note,
  }))
}

export async function verifyMedicine(provider, batchId) {
  const contract = getContract(provider)
  const r = await contract.verifyMedicine(batchId)
  return {
    exists:       r.exists_,
    isExpired:    r.isExpired_,
    status:       Number(r.status_),
    statusName:   BATCH_STATUS[Number(r.status_)],
    currentOwner: r.currentOwner_,
    expiryDate:   Number(r.expiryDate_),
    name:         r.name_,
  }
}

export async function getAllMedicines(provider) {
  const ids = await getAllBatchIds(provider)
  const meds = await Promise.all(ids.map(id => getMedicine(provider, id)))
  return meds.filter(Boolean)
}

function formatMedicine(m) {
  const now = Math.floor(Date.now() / 1000)
  return {
    batchId:          m.batchId,
    name:             m.name,
    manufacturerName: m.manufacturerName,
    manufacturerAddr: m.manufacturerAddr,
    manufacturingDate: Number(m.manufacturingDate),
    expiryDate:       Number(m.expiryDate),
    currentOwner:     m.currentOwner,
    registeredAt:     Number(m.registeredAt),
    status:           Number(m.status),
    statusName:       BATCH_STATUS[Number(m.status)],
    isExpired:        now > Number(m.expiryDate),
    exists:           m.exists,
  }
}

// ── Transfer / Receive / Dispense ─────────────────────────────────

export async function transferMedicine(signer, batchId, toAddress) {
  const contract = getContract(signer)
  const tx = await contract.transferMedicine(batchId, toAddress)
  return await tx.wait()
}

export async function receiveMedicine(signer, batchId) {
  const contract = getContract(signer)
  const tx = await contract.receiveMedicine(batchId)
  return await tx.wait()
}

export async function dispenseMedicine(signer, batchId) {
  const contract = getContract(signer)
  const tx = await contract.dispenseMedicine(batchId)
  return await tx.wait()
}

export async function getPendingTransfer(provider, batchId) {
  const contract = getContract(provider)
  return await contract.getPendingTransfer(batchId)
}

// ── Event-based transaction history ──────────────────────────────

export async function getTransactionHistory(provider, fromBlock = 0) {
  const contract = getContract(provider)
  const latest = await provider.getBlockNumber()
  const batchIds = await contract.getAllBatchIds()
  const batchIdByTopic = new Map(
    batchIds.map(batchId => [
      ethers.keccak256(ethers.toUtf8Bytes(batchId)).toLowerCase(),
      batchId,
    ])
  )
  const resolveBatchId = indexedBatchId => {
    const hash = typeof indexedBatchId === 'string'
      ? ethers.keccak256(ethers.toUtf8Bytes(indexedBatchId))
      : indexedBatchId.hash
    const batchId = batchIdByTopic.get(hash.toLowerCase())
    if (!batchId) throw new Error(`Unable to resolve the indexed batch ID in transaction history (${hash}).`)
    return batchId
  }

  const [regFilter, transFilter, recvFilter, dispFilter] = [
    contract.filters.MedicineRegistered(),
    contract.filters.MedicineTransferred(),
    contract.filters.MedicineReceived(),
    contract.filters.MedicineDispensed(),
  ]

  const [regLogs, transLogs, recvLogs, dispLogs] = await Promise.all([
    contract.queryFilter(regFilter, fromBlock, latest),
    contract.queryFilter(transFilter, fromBlock, latest),
    contract.queryFilter(recvFilter, fromBlock, latest),
    contract.queryFilter(dispFilter, fromBlock, latest),
  ])

  const parse = (logs, type, mapFn) =>
    logs.map(log => ({
      type,
      txHash:      log.transactionHash,
      blockNumber: log.blockNumber,
      ...mapFn(log.args, resolveBatchId),
    }))

  const all = [
    ...parse(regLogs, 'Registered', (a, getBatchId) => ({
      batchId: getBatchId(a.batchId), from: a.manufacturer, to: null, timestamp: Number(a.timestamp),
    })),
    ...parse(transLogs, 'Transferred', (a, getBatchId) => ({
      batchId: getBatchId(a.batchId), from: a.from, to: a.to, timestamp: Number(a.timestamp),
    })),
    ...parse(recvLogs, 'Received', (a, getBatchId) => ({
      batchId: getBatchId(a.batchId), from: null, to: a.receiver, timestamp: Number(a.timestamp),
    })),
    ...parse(dispLogs, 'Dispensed', (a, getBatchId) => ({
      batchId: getBatchId(a.batchId), from: a.pharmacy, to: null, timestamp: Number(a.timestamp),
    })),
  ]

  return all.sort((a, b) => b.blockNumber - a.blockNumber)
}
