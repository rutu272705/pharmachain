import React, { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import contractConfig from '../config/contract.json'
import {
  getAllParticipants, authorizeParticipant, revokeParticipant,
  parseContractError, ROLE_NAME, ROLE_BADGE
} from '../services/contractService'

const ROLES = [
  { label: 'Manufacturer', value: 2 },
  { label: 'Distributor',  value: 3 },
  { label: 'Pharmacy',     value: 4 },
]

export default function ParticipantManagement() {
  const { provider, signer, account, role, isCorrectNetwork, contractError } = useWallet()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [actionError, setActionError]   = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState({ wallet: '', role: 2, name: '' })

  const isAdmin = role === 'ADMIN'

  async function loadParticipants() {
    if (!provider) return
    setLoading(true)
    setError(null)
    if (!isCorrectNetwork) {
      setParticipants([])
      setError(`Switch MetaMask to ${contractConfig.networkName} (chain ${contractConfig.chainId}) before loading participants.`)
      setLoading(false)
      return
    }
    if (contractError) {
      setParticipants([])
      setError(contractError)
      setLoading(false)
      return
    }
    try {
      const parts = await getAllParticipants(provider)
      setParticipants(parts)
    } catch (e) {
      setError('Failed to load participants: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadParticipants() }, [provider, isCorrectNetwork, contractError])

  async function handleAuthorize(e) {
    e.preventDefault()
    if (!isCorrectNetwork) { setActionError('Switch MetaMask to the configured Hardhat Local network before authorizing participants.'); return }
    if (!signer) { setActionError('Connect a MetaMask wallet before authorizing participants.'); return }
    if (!isAdmin) { setActionError('Only the admin can authorize participants.'); return }
    if (!form.wallet || !form.name) { setActionError('All fields are required.'); return }
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.wallet)) { setActionError('Invalid Ethereum address.'); return }

    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const receipt = await authorizeParticipant(signer, form.wallet, Number(form.role), form.name)
      setActionSuccess(`Participant authorized! Block #${receipt.blockNumber}`)
      setForm({ wallet: '', role: 2, name: '' })
      await loadParticipants()
    } catch (err) {
      setActionError(parseContractError(err))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRevoke(wallet, name) {
    if (!isCorrectNetwork) { setActionError('Switch MetaMask to the configured Hardhat Local network before revoking participants.'); return }
    if (!signer) { setActionError('Connect a MetaMask wallet before revoking participants.'); return }
    if (!window.confirm(`Revoke authorization for ${name} (${wallet.slice(0, 10)}…)?`)) return
    setActionLoading(true)
    setActionError(null)
    setActionSuccess(null)
    try {
      const receipt = await revokeParticipant(signer, wallet)
      setActionSuccess(`Authorization revoked. Block #${receipt.blockNumber}`)
      await loadParticipants()
    } catch (err) {
      setActionError(parseContractError(err))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>👥 Participant Management</h1>
        <p>Admin-only: authorize wallet addresses to act as manufacturers, distributors, or pharmacies.</p>
      </div>

      {!account && (
        <div className="alert alert-warning"><span>⚠</span><span>Connect your wallet to manage participants.</span></div>
      )}

      {account && isCorrectNetwork && !contractError && role && !isAdmin && (
        <div className="alert alert-error">
          <span>🚫</span>
          <span>Only the contract admin can manage participants. Your role: <strong>{role}</strong></span>
        </div>
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

      <div className="grid-2">
        {/* Authorize Form */}
        {isAdmin && (
          <div className="card">
            <div className="card-title" style={{ marginBottom: 20 }}>➕ Authorize New Participant</div>
            <form onSubmit={handleAuthorize}>
              <div className="form-group">
                <label>Wallet Address *</label>
                <input
                  value={form.wallet}
                  onChange={e => setForm(f => ({ ...f, wallet: e.target.value }))}
                  placeholder="0x..."
                  disabled={actionLoading}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Tip: Copy from <code>npx hardhat node</code> output, or MetaMask account details.
                </span>
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: Number(e.target.value) }))}
                  disabled={actionLoading}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Organization Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cipla Ltd"
                  disabled={actionLoading}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={actionLoading}>
                {actionLoading
                  ? <><span className="spinner" /> Submitting via MetaMask…</>
                  : '🔗 Authorize Participant'}
              </button>
            </form>

            <div className="card" style={{ marginTop: 16, background: 'var(--bg)', border: '1px dashed var(--border-dark)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 2 }}>
                <strong>Demo Quick-Setup:</strong> Copy these addresses from <code>npx hardhat node</code> output:
                <br />• <strong>Account #1</strong> → Manufacturer
                <br />• <strong>Account #2</strong> → Distributor
                <br />• <strong>Account #3</strong> → Pharmacy
              </div>
            </div>
          </div>
        )}

        {/* Participants Table */}
        <div className={`card ${!isAdmin ? 'grid-2' : ''}`} style={!isAdmin ? { gridColumn: '1/-1' } : {}}>
          <div className="card-header">
            <span className="card-title">Registered Participants</span>
            <button className="btn btn-secondary btn-sm" onClick={loadParticipants} disabled={loading}>
              {loading ? '…' : '🔄 Refresh'}
            </button>
          </div>
          {error && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}
          {loading ? (
            <div className="loading-overlay"><span className="spinner spinner-dark" /> Loading…</div>
          ) : participants.length === 0 ? (
            <div className="empty-state"><p>No participants registered yet.</p></div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Wallet Address</th>
                    <th>Role</th>
                    <th>Status</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.wallet}>
                      <td style={{ fontWeight: 500 }}>
                        {p.name}
                        {p.wallet.toLowerCase() === account?.toLowerCase() && (
                          <span className="badge badge-muted" style={{ marginLeft: 6, fontSize: 10 }}>You</span>
                        )}
                      </td>
                      <td className="monospace" style={{ fontSize: 12 }}>{p.wallet}</td>
                      <td>
                        <span className={`badge ${ROLE_BADGE[p.role]}`}>{p.roleName}</span>
                      </td>
                      <td>
                        {p.authorized
                          ? <span className="badge badge-success">Authorized</span>
                          : <span className="badge badge-error">Revoked</span>
                        }
                      </td>
                      {isAdmin && (
                        <td>
                          {p.role !== 1 && ( // cannot revoke admin
                            <button
                              className={`btn btn-sm ${p.authorized ? 'btn-danger' : 'btn-success'}`}
                              onClick={() => p.authorized ? handleRevoke(p.wallet, p.name) : null}
                              disabled={actionLoading || !p.authorized}
                            >
                              {p.authorized ? 'Revoke' : 'Revoked'}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
