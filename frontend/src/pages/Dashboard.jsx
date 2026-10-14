import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import { getAllMedicines, getTransactionHistory, BATCH_STATUS, BATCH_STATUS_BADGE } from '../services/contractService'

function StatCard({ value, label, icon, colorClass }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${colorClass}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { provider, account, isCorrectNetwork, contractError } = useWallet()
  const [medicines, setMedicines] = useState([])
  const [txHistory, setTxHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!provider) return
    if (!isCorrectNetwork) {
      setError('Switch MetaMask to the configured Hardhat Local network before loading dashboard data.')
      return
    }
    if (contractError) {
      setError(contractError)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all([
      getAllMedicines(provider),
      getTransactionHistory(provider),
    ])
      .then(([meds, txs]) => {
        setMedicines(meds)
        setTxHistory(txs.slice(0, 10))
      })
      .catch(e => setError('Failed to load data: ' + e.message))
      .finally(() => setLoading(false))
  }, [provider, isCorrectNetwork, contractError])

  const now = Math.floor(Date.now() / 1000)
  const total   = medicines.length
  const expired = medicines.filter(m => m.isExpired).length
  const active  = medicines.filter(m => !m.isExpired && m.status < 5).length
  const dispensed = medicines.filter(m => m.status === 5).length

  function formatTs(ts) {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleString()
  }

  function shortAddr(addr) {
    if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—'
    return addr.slice(0, 6) + '…' + addr.slice(-4)
  }

  return (
    <div>
      <div className="page-header">
        <h1>📊 Dashboard</h1>
        <p>Overview of the PharmaChain pharmaceutical supply-chain on the local Hardhat blockchain.</p>
      </div>

      {!account && (
        <div className="alert alert-info">
          <span>🔌</span>
          <span>
            Connect your MetaMask wallet to interact with the smart contract.{' '}
            <Link to="/connect" style={{ fontWeight: 600 }}>Connect now →</Link>
          </span>
        </div>
      )}

      {error && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}

      <div className="stats-grid">
        <StatCard value={loading ? '…' : total}    label="Total Batches"   icon="📦" colorClass="blue" />
        <StatCard value={loading ? '…' : active}   label="Active Batches"  icon="✅" colorClass="green" />
        <StatCard value={loading ? '…' : expired}  label="Expired Batches" icon="⏰" colorClass="red" />
        <StatCard value={loading ? '…' : dispensed} label="Dispensed"      icon="💊" colorClass="teal" />
      </div>

      <div className="grid-2">
        {/* Recent Medicines */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 Recent Medicine Batches</span>
            <Link to="/supply-chain" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {loading ? (
            <div className="loading-overlay">
              <span className="spinner spinner-dark" />Loading…
            </div>
          ) : medicines.length === 0 ? (
            <div className="empty-state">
              <p>No medicine batches registered yet.</p>
              <Link to="/register" className="btn btn-primary" style={{ marginTop: 12 }}>Register a Batch</Link>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Medicine</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.slice(0, 8).map(m => (
                    <tr key={m.batchId}>
                      <td className="monospace">{m.batchId}</td>
                      <td>{m.name}</td>
                      <td>
                        {m.isExpired
                          ? <span className="badge badge-error">Expired</span>
                          : <span className={`badge ${BATCH_STATUS_BADGE[m.status]}`}>{m.statusName}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⛓ Recent Transactions</span>
            <Link to="/history" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          {loading ? (
            <div className="loading-overlay">
              <span className="spinner spinner-dark" />Loading…
            </div>
          ) : txHistory.length === 0 ? (
            <div className="empty-state">
              <p>No on-chain transactions recorded yet.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Batch</th>
                    <th>Block</th>
                  </tr>
                </thead>
                <tbody>
                  {txHistory.map((tx, i) => (
                    <tr key={i}>
                      <td><span className="badge badge-primary">{tx.type}</span></td>
                      <td className="monospace">{tx.batchId}</td>
                      <td>#{tx.blockNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="card" style={{ marginTop: 20, background: 'linear-gradient(135deg,#0f4c75,#1b6ca8)', color: 'white', border: 'none' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ fontSize: 48 }}>🔗</div>
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: 8, color: 'white' }}>How PharmaChain Works</h3>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.7 }}>
              Medicine batches are registered by authorized manufacturers directly on the Ethereum blockchain.
              All supply-chain events — transfers, receipts, and dispensing — are permanently recorded as
              on-chain transactions. The public can verify any batch using its ID or QR code.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>
              ⚠ Note: Blockchain verifies registered records and their history. It cannot independently
              confirm whether a physical medicine matches a registered batch without additional physical authentication.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
