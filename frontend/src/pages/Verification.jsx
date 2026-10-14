import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { verifyMedicine, getMedicine, getMedicineHistory, BATCH_STATUS, BATCH_STATUS_BADGE } from '../services/contractService'

export default function Verification() {
  const { batchId: paramBatchId } = useParams()
  const { provider, isCorrectNetwork, contractError } = useWallet()

  const [search, setSearch] = useState(paramBatchId || '')
  const [result, setResult] = useState(null)
  const [medicine, setMedicine] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleVerify(batchId) {
    const id = (batchId || search).trim()
    if (!id) { setError('Please enter a batch ID.'); return }
    if (!provider) { setError('Connect your wallet or wait for provider to initialize.'); return }
    if (!isCorrectNetwork) { setError('Switch MetaMask to the configured Hardhat Local network before verifying this batch.'); return }
    if (contractError) { setError(contractError); return }

    setLoading(true)
    setError(null)
    setResult(null)
    setMedicine(null)
    setHistory([])

    try {
      const vResult = await verifyMedicine(provider, id)
      setResult(vResult)
      if (vResult.exists) {
        const [med, hist] = await Promise.all([
          getMedicine(provider, id),
          getMedicineHistory(provider, id),
        ])
        setMedicine(med)
        setHistory(hist)
      }
    } catch (e) {
      setError('Verification failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-verify if batch ID in URL
  useEffect(() => {
    if (paramBatchId && provider) handleVerify(paramBatchId)
  }, [paramBatchId, provider, isCorrectNetwork, contractError])

  function formatDate(ts) {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  function shortAddr(addr) {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
    return addr
  }

  const statusEmojis = ['📝', '🚚', '🏭', '🚚', '💊', '✅']

  return (
    <div>
      <div className="page-header">
        <h1>🔍 Medicine Verification</h1>
        <p>
          Verify any medicine batch by searching its batch ID. Data comes directly from the blockchain.
          Anyone can verify — no wallet required.
        </p>
      </div>

      {/* Search Box */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Enter batch ID (e.g. CIPLA-PARA-2024-001)"
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={() => handleVerify()} disabled={loading}>
            {loading ? <><span className="spinner" /> Verifying…</> : '🔍 Verify'}
          </button>
          <Link to="/qr" className="btn btn-secondary">📷 Scan QR</Link>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            <span>⚠</span><span>{error}</span>
          </div>
        )}
      </div>

      {/* No provider warning */}
      {!provider && (
        <div className="alert alert-info">
          <span>ℹ</span>
          <span>
            <Link to="/connect" style={{ fontWeight: 600 }}>Connect your wallet</Link> to enable verification.
            The contract is on the local Hardhat network.
          </span>
        </div>
      )}
      {provider && !isCorrectNetwork && (
        <div className="alert alert-warning">
          <span>⚠</span><span>Switch MetaMask to the configured Hardhat Local network to verify local-chain batches.</span>
        </div>
      )}
      {contractError && <div className="alert alert-error"><span>⚠</span><span>{contractError}</span></div>}

      {/* Results */}
      {result && (
        <div>
          {/* Status Banner */}
          {!result.exists ? (
            <div className="card" style={{ background: 'var(--error-bg)', border: '2px solid #fed7d7', textAlign: 'center', padding: 40, marginBottom: 20 }}>
              <div style={{ fontSize: 56 }}>❌</div>
              <h2 style={{ color: 'var(--error)', marginTop: 12 }}>Batch Not Found</h2>
              <p style={{ color: '#9b2c2c', marginTop: 8 }}>
                Batch ID <code>"{search}"</code> is not registered on this blockchain.
                It may be unregistered, counterfeit, or on a different network.
              </p>
            </div>
          ) : result.isExpired ? (
            <div className="card" style={{ background: 'var(--warning-bg)', border: '2px solid #f6ad55', textAlign: 'center', padding: 40, marginBottom: 20 }}>
              <div style={{ fontSize: 56 }}>⚠️</div>
              <h2 style={{ color: '#c05621', marginTop: 12 }}>Batch Expired</h2>
              <p style={{ color: '#7b5a00', marginTop: 8 }}>
                This batch is registered but <strong>past its expiry date</strong>.
                Do not use this medicine.
              </p>
            </div>
          ) : (
            <div className="card" style={{ background: 'var(--success-bg)', border: '2px solid #9ae6b4', textAlign: 'center', padding: 40, marginBottom: 20 }}>
              <div style={{ fontSize: 56 }}>✅</div>
              <h2 style={{ color: 'var(--success)', marginTop: 12 }}>Batch Verified</h2>
              <p style={{ color: '#276749', marginTop: 8 }}>
                This batch is registered on the blockchain and is within its validity period.
              </p>
            </div>
          )}

          {/* Medicine Details */}
          {medicine && (
            <div className="grid-2">
              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>💊 Medicine Details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <DetailRow label="Batch ID"       value={<code className="monospace">{medicine.batchId}</code>} />
                  <DetailRow label="Medicine Name"  value={medicine.name} />
                  <DetailRow label="Manufacturer"   value={medicine.manufacturerName} />
                  <DetailRow label="Mfg Date"       value={formatDate(medicine.manufacturingDate)} />
                  <DetailRow label="Expiry Date"    value={<span style={{ color: result.isExpired ? 'var(--error)' : 'var(--success)', fontWeight: 600 }}>{formatDate(medicine.expiryDate)}</span>} />
                  <DetailRow label="Status"         value={
                    result.isExpired
                      ? <span className="badge badge-error">EXPIRED</span>
                      : <span className={`badge ${BATCH_STATUS_BADGE[medicine.status]}`}>{medicine.statusName}</span>
                  } />
                  <DetailRow label="Current Custodian" value={<span className="monospace" style={{ fontSize: 12 }}>{shortAddr(medicine.currentOwner)}</span>} />
                  <DetailRow label="Registered At"  value={formatDate(medicine.registeredAt)} />
                </div>
              </div>

              {/* Supply Chain Journey */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 16 }}>🔗 Supply Chain Journey</div>
                {history.length === 0 ? (
                  <div className="empty-state"><p>No history entries found.</p></div>
                ) : (
                  <div className="timeline">
                    {history.map((h, i) => (
                      <div className="timeline-item" key={i}>
                        <div className={`timeline-dot ${i === history.length - 1 ? 'active' : 'completed'}`}>
                          {statusEmojis[h.action] || '•'}
                        </div>
                        <div className="timeline-content">
                          <h4>{h.actionName}</h4>
                          <p>{h.note}</p>
                          <p style={{ fontSize: 11 }}>{new Date(h.timestamp * 1000).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="alert alert-warning" style={{ marginTop: 16 }}>
            <span>ℹ</span>
            <span>
              <strong>Verification Disclaimer:</strong> This system verifies that a batch with this ID
              is registered on the blockchain and checks its recorded history. It cannot independently
              confirm whether the physical medicine in your hand matches the registered batch without
              additional physical authentication (e.g., tamper-evident seals, holographic labels).
            </span>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
          <h3 style={{ color: 'var(--text-secondary)' }}>Enter a batch ID to verify</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 14 }}>
            Or scan the QR code on the medicine packaging to verify automatically.
          </p>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, fontSize: 14 }}>{value}</span>
    </div>
  )
}
