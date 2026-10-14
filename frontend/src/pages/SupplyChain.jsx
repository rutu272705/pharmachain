import React, { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import {
  getAllMedicines, getMedicineHistory, getAllParticipants,
  transferMedicine, receiveMedicine, dispenseMedicine, getPendingTransfer,
  parseContractError, BATCH_STATUS, BATCH_STATUS_BADGE
} from '../services/contractService'

export default function SupplyChain() {
  const { provider, signer, account, role, isCorrectNetwork, contractError } = useWallet()
  const [medicines, setMedicines] = useState([])
  const [participants, setParticipants] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [actionError, setActionError]   = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // For transfer modal
  const [transferModal, setTransferModal] = useState(null) // { batchId }
  const [transferTo, setTransferTo] = useState('')

  // For history modal
  const [historyModal, setHistoryModal] = useState(null) // { batchId, history[] }
  const [historyLoading, setHistoryLoading] = useState(false)

  async function loadData() {
    if (!provider) return
    if (!isCorrectNetwork) {
      setMedicines([])
      setParticipants([])
      setError('Switch MetaMask to the configured Hardhat Local network before loading supply-chain data.')
      return
    }
    if (contractError) {
      setMedicines([])
      setParticipants([])
      setError(contractError)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [meds, parts] = await Promise.all([
        getAllMedicines(provider),
        getAllParticipants(provider),
      ])
      setMedicines(meds)
      setParticipants(parts)
    } catch (e) {
      setError('Failed to load: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [provider, isCorrectNetwork, contractError])

  async function handleTransfer(e) {
    e.preventDefault()
    if (!isCorrectNetwork) { setActionError('Switch MetaMask to the configured Hardhat Local network before transferring a batch.'); return }
    if (!signer) { setActionError('Connect a MetaMask wallet before transferring a batch.'); return }
    if (!transferModal || !transferTo) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const receipt = await transferMedicine(signer, transferModal.batchId, transferTo)
      setActionSuccess(`Transfer initiated! Tx: ${receipt.hash.slice(0, 20)}…`)
      setTransferModal(null)
      setTransferTo('')
      await loadData()
    } catch (err) {
      setActionError(parseContractError(err))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReceive(batchId) {
    if (!isCorrectNetwork) { setActionError('Switch MetaMask to the configured Hardhat Local network before receiving a batch.'); return }
    if (!signer) { setActionError('Connect a MetaMask wallet before receiving a batch.'); return }
    if (!window.confirm(`Acknowledge receipt of batch ${batchId}? This will submit a blockchain transaction.`)) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const receipt = await receiveMedicine(signer, batchId)
      setActionSuccess(`Receipt confirmed! Block #${receipt.blockNumber}`)
      await loadData()
    } catch (err) {
      setActionError(parseContractError(err))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDispense(batchId) {
    if (!isCorrectNetwork) { setActionError('Switch MetaMask to the configured Hardhat Local network before dispensing a batch.'); return }
    if (!signer) { setActionError('Connect a MetaMask wallet before dispensing a batch.'); return }
    if (!window.confirm(`Mark batch ${batchId} as dispensed? This action is permanent.`)) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const receipt = await dispenseMedicine(signer, batchId)
      setActionSuccess(`Medicine dispensed! Block #${receipt.blockNumber}`)
      await loadData()
    } catch (err) {
      setActionError(parseContractError(err))
    } finally {
      setActionLoading(false)
    }
  }

  async function openHistory(batchId) {
    setHistoryLoading(true)
    setHistoryModal({ batchId, history: [] })
    try {
      const hist = await getMedicineHistory(provider, batchId)
      setHistoryModal({ batchId, history: hist })
    } catch (e) {
      setHistoryModal({ batchId, history: [], error: e.message })
    } finally {
      setHistoryLoading(false)
    }
  }

  // Filter participants eligible as transfer recipients based on current role
  function eligibleRecipients(med) {
    if (role === 'MANUFACTURER' && med.status === 0) {
      return participants.filter(p => p.authorized && p.role === 3) // DISTRIBUTOR
    }
    if (role === 'DISTRIBUTOR' && med.status === 2) {
      return participants.filter(p => p.authorized && p.role === 4) // PHARMACY
    }
    return []
  }

  function canTransfer(med) {
    if (!account) return false
    if (med.isExpired) return false
    if (role === 'MANUFACTURER' && med.status === 0 && med.currentOwner.toLowerCase() === account.toLowerCase()) return true
    if (role === 'DISTRIBUTOR' && med.status === 2 && med.currentOwner.toLowerCase() === account.toLowerCase()) return true
    return false
  }

  function canReceive(med) {
    if (!account) return false
    if (med.isExpired) return false
    // Pending transfer target — checked off-chain; contract enforces on-chain
    if (role === 'DISTRIBUTOR' && med.status === 1) return true
    if (role === 'PHARMACY' && med.status === 3) return true
    return false
  }

  function canDispense(med) {
    if (!account) return false
    if (role === 'PHARMACY' && med.status === 4 && med.currentOwner.toLowerCase() === account.toLowerCase()) return true
    return false
  }

  function formatDate(ts) {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString('en-IN')
  }

  function shortAddr(addr) {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
    return addr.slice(0, 6) + '…' + addr.slice(-4)
  }

  const ACTION_STATUS_LABELS = {
    0: 'Registered', 1: 'In Transit→Dist', 2: 'At Distributor',
    3: 'In Transit→Pharm', 4: 'At Pharmacy', 5: 'Dispensed',
  }

  return (
    <div>
      <div className="page-header">
        <h1>🚚 Supply Chain Management</h1>
        <p>View all medicine batches and perform authorized supply-chain operations through the smart contract.</p>
      </div>

      {!account && (
        <div className="alert alert-warning"><span>⚠</span><span>Connect your wallet to perform supply-chain operations.</span></div>
      )}

      {actionSuccess && (
        <div className="alert alert-success">
          <span>✅</span>
          <div>{actionSuccess} <button className="btn btn-secondary btn-sm" onClick={() => setActionSuccess(null)}>✕</button></div>
        </div>
      )}
      {actionError && (
        <div className="alert alert-error">
          <span>⚠</span>
          <div>{actionError} <button className="btn btn-secondary btn-sm" onClick={() => setActionError(null)}>✕</button></div>
        </div>
      )}
      {error && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Medicine Batches</span>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            {loading ? '…' : '🔄 Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="loading-overlay"><span className="spinner spinner-dark" /> Loading from blockchain…</div>
        ) : medicines.length === 0 ? (
          <div className="empty-state"><p>No medicine batches found. Register one first.</p></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Medicine</th>
                  <th>Manufacturer</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map(med => (
                  <tr key={med.batchId}>
                    <td className="monospace">{med.batchId}</td>
                    <td>{med.name}</td>
                    <td style={{ fontSize: 12 }}>{med.manufacturerName}</td>
                    <td style={{ fontSize: 12 }}>{formatDate(med.expiryDate)}</td>
                    <td>
                      {med.isExpired
                        ? <span className="badge badge-error">Expired</span>
                        : <span className={`badge ${BATCH_STATUS_BADGE[med.status]}`}>{med.statusName}</span>
                      }
                    </td>
                    <td className="monospace" style={{ fontSize: 12 }}>{shortAddr(med.currentOwner)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openHistory(med.batchId)}>
                          History
                        </button>
                        {canTransfer(med) && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setTransferModal({ batchId: med.batchId, med })}
                            disabled={actionLoading}
                          >
                            Transfer
                          </button>
                        )}
                        {canReceive(med) && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleReceive(med.batchId)}
                            disabled={actionLoading}
                          >
                            {actionLoading ? '…' : 'Receive'}
                          </button>
                        )}
                        {canDispense(med) && (
                          <button
                            className="btn btn-accent btn-sm"
                            onClick={() => handleDispense(med.batchId)}
                            disabled={actionLoading}
                          >
                            {actionLoading ? '…' : 'Dispense'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {transferModal && (
        <Modal title={`Transfer Batch: ${transferModal.batchId}`} onClose={() => { setTransferModal(null); setActionError(null) }}>
          <p style={{ marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
            Select an authorized recipient for this batch. Only valid next-step participants are shown.
          </p>

          {actionError && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>
              <span>⚠</span><span>{actionError}</span>
            </div>
          )}

          <form onSubmit={handleTransfer}>
            <div className="form-group">
              <label>Recipient Address</label>
              <select value={transferTo} onChange={e => setTransferTo(e.target.value)} required>
                <option value="">— Select recipient —</option>
                {eligibleRecipients(transferModal.med).map(p => (
                  <option key={p.wallet} value={p.wallet}>
                    {p.name} ({p.roleName}) — {p.wallet.slice(0, 10)}…
                  </option>
                ))}
              </select>
              {eligibleRecipients(transferModal.med).length === 0 && (
                <div className="alert alert-warning" style={{ marginTop: 8 }}>
                  <span>⚠</span>
                  <span>No authorized recipients found. Admin must authorize a participant with the correct role first.</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Or enter an address manually:
            </div>
            <div className="form-group">
              <input
                placeholder="0x... (manual entry)"
                value={transferTo}
                onChange={e => setTransferTo(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={actionLoading || !transferTo}>
                {actionLoading ? <><span className="spinner" /> Submitting…</> : '🔗 Initiate Transfer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setTransferModal(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* History Modal */}
      {historyModal && (
        <Modal title={`Supply Chain History: ${historyModal.batchId}`} onClose={() => setHistoryModal(null)} wide>
          {historyLoading ? (
            <div className="loading-overlay"><span className="spinner spinner-dark" /> Loading history…</div>
          ) : historyModal.error ? (
            <div className="alert alert-error"><span>⚠</span><span>{historyModal.error}</span></div>
          ) : (
            <div className="timeline">
              {historyModal.history.map((h, i) => (
                <div className="timeline-item" key={i}>
                  <div className={`timeline-dot ${i === historyModal.history.length - 1 ? 'active' : 'completed'}`}>
                    {statusEmoji(h.action)}
                  </div>
                  <div className="timeline-content">
                    <h4>{ACTION_STATUS_LABELS[h.action] || h.actionName}</h4>
                    <p>{h.note}</p>
                    <p>
                      {h.from && h.from !== '0x0000000000000000000000000000000000000000' && `From: ${h.from.slice(0, 10)}…  `}
                      {h.to && h.to !== '0x0000000000000000000000000000000000000000' && `To: ${h.to.slice(0, 10)}…  `}
                      {new Date(h.timestamp * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {historyModal.history.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No history entries found.</p>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

const ACTION_STATUS_LABELS = {
  0: 'Registered', 1: 'In Transit→Distributor', 2: 'At Distributor',
  3: 'In Transit→Pharmacy', 4: 'At Pharmacy', 5: 'Dispensed',
}

function statusEmoji(action) {
  const e = ['📝', '🚚', '🏭', '🚚', '💊', '✅']
  return e[action] || '•'
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: 28,
        width: '100%', maxWidth: wide ? 700 : 480,
        maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700 }}>{title}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
