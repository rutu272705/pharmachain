import React, { useState, useEffect } from 'react'
import { useWallet } from '../hooks/useWallet'
import { getTransactionHistory } from '../services/contractService'

export default function TransactionHistory() {
  const { provider, isCorrectNetwork, contractError } = useWallet()
  const [txs, setTxs]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [filter, setFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')

  async function loadHistory() {
    if (!provider) return
    if (!isCorrectNetwork) {
      setTxs([])
      setError('Switch MetaMask to the configured Hardhat Local network before loading transaction history.')
      return
    }
    if (contractError) {
      setTxs([])
      setError(contractError)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getTransactionHistory(provider)
      setTxs(data)
    } catch (e) {
      setError('Failed to load transaction history: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHistory() }, [provider, isCorrectNetwork, contractError])

  const types = ['All', 'Registered', 'Transferred', 'Received', 'Dispensed']

  const filtered = txs.filter(tx => {
    const matchType   = typeFilter === 'All' || tx.type === typeFilter
    const matchSearch = !filter ||
      tx.batchId.toLowerCase().includes(filter.toLowerCase()) ||
      (tx.txHash || '').toLowerCase().includes(filter.toLowerCase()) ||
      (tx.from || '').toLowerCase().includes(filter.toLowerCase()) ||
      (tx.to || '').toLowerCase().includes(filter.toLowerCase())
    return matchType && matchSearch
  })

  function shortAddr(addr) {
    if (!addr || addr === 'null' || addr === '0x0000000000000000000000000000000000000000') return '—'
    return addr.slice(0, 6) + '…' + addr.slice(-4)
  }

  function typeBadge(type) {
    const map = {
      Registered:  'badge-primary',
      Transferred: 'badge-warning',
      Received:    'badge-info',
      Dispensed:   'badge-success',
    }
    return map[type] || 'badge-muted'
  }

  function formatTs(ts) {
    if (!ts) return '—'
    return new Date(ts * 1000).toLocaleString()
  }

  return (
    <div>
      <div className="page-header">
        <h1>⛓ Transaction History</h1>
        <p>All supply-chain events recorded on the local Hardhat blockchain, read from contract event logs.</p>
      </div>

      {!provider && (
        <div className="alert alert-info"><span>ℹ</span><span>Connect wallet to load transaction history.</span></div>
      )}
      {error && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">📜 On-Chain Events</span>
          <button className="btn btn-secondary btn-sm" onClick={loadHistory} disabled={loading}>
            {loading ? '…' : '🔄 Refresh'}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search batch ID, address, hash…"
            style={{ flex: 1, minWidth: 200 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {types.map(t => (
              <button
                key={t}
                className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><span className="spinner spinner-dark" /> Loading from blockchain events…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>{txs.length === 0 ? 'No transactions found. Register a medicine batch to get started.' : 'No results match your filter.'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Batch ID</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Block</th>
                  <th>Timestamp</th>
                  <th>Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr key={i}>
                    <td><span className={`badge ${typeBadge(tx.type)}`}>{tx.type}</span></td>
                    <td className="monospace">{tx.batchId}</td>
                    <td className="monospace">{shortAddr(tx.from)}</td>
                    <td className="monospace">{shortAddr(tx.to)}</td>
                    <td>#{tx.blockNumber}</td>
                    <td style={{ fontSize: 12 }}>{formatTs(tx.timestamp)}</td>
                    <td className="monospace" style={{ fontSize: 11 }} title={tx.txHash}>
                      {tx.txHash ? tx.txHash.slice(0, 12) + '…' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          Showing {filtered.length} of {txs.length} events · All data from Hardhat Local blockchain event logs
        </div>
      </div>
    </div>
  )
}
