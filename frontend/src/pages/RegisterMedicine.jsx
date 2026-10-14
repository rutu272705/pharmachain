import React, { useState } from 'react'
import { useWallet } from '../hooks/useWallet'
import { registerMedicine, parseContractError } from '../services/contractService'

export default function RegisterMedicine() {
  const { signer, account, role, isCorrectNetwork, contractError } = useWallet()

  const [form, setForm] = useState({
    batchId: '',
    name: '',
    manufacturerName: '',
    manufacturingDate: '',
    expiryDate: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)
  const [success, setSuccess] = useState(null)

  const isManufacturer = role === 'MANUFACTURER'

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!signer) { setError('Please connect your MetaMask wallet first.'); return }
    if (!isCorrectNetwork) { setError('Switch MetaMask to the configured Hardhat Local network before registering a batch.'); return }
    if (contractError) { setError(contractError); return }
    if (!isManufacturer) { setError('Only authorized manufacturers can register medicine batches.'); return }

    const { batchId, name, manufacturerName, manufacturingDate, expiryDate } = form
    if (!batchId || !name || !manufacturerName || !manufacturingDate || !expiryDate) {
      setError('All fields are required.'); return
    }
    if (new Date(expiryDate) <= new Date(manufacturingDate)) {
      setError('Expiry date must be after manufacturing date.'); return
    }
    if (new Date(expiryDate) <= new Date()) {
      setError('Expiry date must be in the future.'); return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const receipt = await registerMedicine(signer, { batchId, name, manufacturerName, manufacturingDate, expiryDate })
      setSuccess({
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        batchId,
      })
      setForm({ batchId: '', name: '', manufacturerName: '', manufacturingDate: '', expiryDate: '' })
    } catch (err) {
      setError(parseContractError(err))
    } finally {
      setLoading(false)
    }
  }

  const dateForInput = date => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const today = dateForInput(new Date())
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = dateForInput(tomorrowDate)

  return (
    <div>
      <div className="page-header">
        <h1>💊 Register Medicine Batch</h1>
        <p>Register a new pharmaceutical batch on the blockchain. Only authorized manufacturers can register batches.</p>
      </div>

      {!account && (
        <div className="alert alert-warning">
          <span>⚠</span>
          <span>Connect your MetaMask wallet to register medicines.</span>
        </div>
      )}

      {account && !isCorrectNetwork && (
        <div className="alert alert-error">
          <span>⚠</span>
          <span>Switch MetaMask to the configured Hardhat Local network (chain ID shown on the Connect Wallet page) before registering.</span>
        </div>
      )}

      {contractError && (
        <div className="alert alert-error"><span>⚠</span><span>{contractError}</span></div>
      )}

      {account && isCorrectNetwork && !contractError && role && !isManufacturer && (
        <div className="alert alert-error">
          <span>🚫</span>
          <span>
            Your wallet (<code>{account.slice(0, 10)}…</code>) does not have the MANUFACTURER role.
            Ask the admin to authorize your address.
            Your current role: <strong>{role}</strong>
          </span>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>Batch Registration Form</div>

          {success && (
            <div className="alert alert-success">
              <span>✅</span>
              <div>
                <strong>Batch registered successfully!</strong><br />
                Batch ID: <code>{success.batchId}</code><br />
                Block: #{success.blockNumber}<br />
                <span style={{ fontSize: 12 }}>
                  Tx Hash: <code className="monospace">{success.txHash}</code>
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="batchId">Batch ID *</label>
              <input
                id="batchId" name="batchId" value={form.batchId}
                onChange={handleChange}
                placeholder="e.g. CIPLA-PARA-2024-001"
                disabled={loading}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Must be unique. Will be stored permanently on the blockchain.
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="name">Medicine Name *</label>
              <input
                id="name" name="name" value={form.name}
                onChange={handleChange}
                placeholder="e.g. Paracetamol 500mg Tablets"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="manufacturerName">Manufacturer Name *</label>
              <input
                id="manufacturerName" name="manufacturerName" value={form.manufacturerName}
                onChange={handleChange}
                placeholder="e.g. Cipla Limited"
                disabled={loading}
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="manufacturingDate">Manufacturing Date *</label>
                <input
                  type="date" id="manufacturingDate" name="manufacturingDate"
                  value={form.manufacturingDate} onChange={handleChange}
                  max={today} disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="expiryDate">Expiry Date *</label>
                <input
                  type="date" id="expiryDate" name="expiryDate"
                  value={form.expiryDate} onChange={handleChange}
                  min={tomorrow} disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading || !account || !isCorrectNetwork || Boolean(contractError) || !isManufacturer}
            >
              {loading
                ? <><span className="spinner" /> Submitting to blockchain via MetaMask…</>
                : '🔗 Register on Blockchain'}
            </button>
          </form>

          {loading && (
            <div className="alert alert-info" style={{ marginTop: 16 }}>
              <span>ℹ</span>
              <span>
                <strong>Check MetaMask!</strong> A transaction approval popup should appear.
                Approve it to register the batch on the blockchain.
              </span>
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>ℹ️ What gets stored on blockchain?</div>
            <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20 }}>
              <li>Unique batch identifier</li>
              <li>Medicine name</li>
              <li>Manufacturer name and wallet address</li>
              <li>Manufacturing date (Unix timestamp)</li>
              <li>Expiry date (Unix timestamp)</li>
              <li>Registration timestamp (block time)</li>
              <li>Current custodian address</li>
              <li>Batch status in supply chain</li>
            </ul>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>⚠️ Important Notes</div>
            <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20 }}>
              <li>Batch IDs must be globally unique — duplicates are rejected by the contract.</li>
              <li>Expired batches cannot be registered or transferred.</li>
              <li>Only your wallet address (with MANUFACTURER role) can register.</li>
              <li>This uses your test ETH on Hardhat Local — no real funds.</li>
              <li>All data is permanently stored on the local blockchain.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
