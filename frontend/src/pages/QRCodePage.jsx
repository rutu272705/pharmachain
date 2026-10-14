import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useWallet } from '../hooks/useWallet'
import { getAllBatchIds } from '../services/contractService'

export default function QRCodePage() {
  const { provider, isCorrectNetwork, contractError } = useWallet()
  const navigate = useNavigate()

  const [batchIds, setBatchIds]   = useState([])
  const [selected, setSelected]   = useState('')
  const [manualId, setManualId]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scanSuccess, setScanSuccess] = useState(null)
  const [scanResult, setScanResult] = useState(null)

  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)

  const activeBatchId = selected || manualId

  // The QR code encodes just the batch ID so it's portable
  const qrValue = activeBatchId
    ? `${window.location.origin}/verify/${encodeURIComponent(activeBatchId)}`
    : ''

  useEffect(() => {
    if (!provider) return
    if (!isCorrectNetwork) {
      setBatchIds([])
      setLoadError('Switch MetaMask to the configured Hardhat Local network before loading registered batches.')
      return
    }
    if (contractError) {
      setBatchIds([])
      setLoadError(contractError)
      return
    }
    setLoading(true)
    setLoadError(null)
    getAllBatchIds(provider)
      .then(ids => setBatchIds([...ids]))
      .catch(err => setLoadError(`Failed to load batch IDs: ${err.message}`))
      .finally(() => setLoading(false))
  }, [provider, isCorrectNetwork, contractError])

  // ── Camera Scanner ─────────────────────────────────────────────
  async function startScanner() {
    setScanError(null)
    setScanSuccess(null)
    setScanResult(null)
    setScannerOpen(true)

    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode')

      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        false
      )
      html5QrRef.current = scanner

      scanner.render(
        (decodedText) => {
          // Try to extract batchId from the URL
          let batchId = decodedText
          try {
            const url = new URL(decodedText)
            const segments = url.pathname.split('/')
            const verifyIdx = segments.indexOf('verify')
            if (verifyIdx !== -1 && segments[verifyIdx + 1]) {
              batchId = decodeURIComponent(segments[verifyIdx + 1])
            }
          } catch {
            // Not a URL – use the raw value as batchId
          }
          setScanResult(batchId)
          setScanSuccess(`Scanned: ${batchId}`)
          scanner.clear().catch(() => {})
          setScannerOpen(false)
        },
        (error) => {
          // Ignore per-frame errors; only show if persistent
        }
      )
    } catch (err) {
      setScanError('Camera scanner failed to load: ' + err.message +
        '. Use manual entry below instead.')
      setScannerOpen(false)
    }
  }

  function stopScanner() {
    if (html5QrRef.current) {
      html5QrRef.current.clear().catch(() => {})
      html5QrRef.current = null
    }
    setScannerOpen(false)
  }

  function goVerify() {
    const id = scanResult || activeBatchId
    if (id) navigate('/verify/' + encodeURIComponent(id))
  }

  function downloadQR() {
    const svg = document.querySelector('#qr-display svg')
    if (!svg) return
    const data = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([data], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${activeBatchId}-QR.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="page-header">
        <h1>📷 QR Code</h1>
        <p>Generate QR codes for registered medicine batches or scan a code to verify a batch.</p>
      </div>

      {loadError && <div className="alert alert-error"><span>⚠</span><span>{loadError}</span></div>}

      <div className="grid-2">
        {/* QR Generator */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>🔳 Generate QR Code</div>

          {loading && (
            <div className="loading-overlay"><span className="spinner spinner-dark" /> Loading batch IDs…</div>
          )}

          <div className="form-group">
            <label>Select Registered Batch</label>
            <select value={selected} onChange={e => { setSelected(e.target.value); setManualId('') }}>
              <option value="">— Select a batch —</option>
              {batchIds.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>— or enter manually —</div>

          <div className="form-group">
            <label>Manual Batch ID</label>
            <input
              value={manualId}
              onChange={e => { setManualId(e.target.value); setSelected('') }}
              placeholder="CIPLA-PARA-2024-001"
            />
          </div>

          {activeBatchId ? (
            <div>
              <div className="qr-box" id="qr-display">
                <QRCodeSVG
                  value={qrValue}
                  size={200}
                  level="H"
                  includeMargin
                  style={{ borderRadius: 8 }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{activeBatchId}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all' }}>
                    {qrValue}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={goVerify} style={{ flex: 1 }}>
                  🔍 Verify this Batch
                </button>
                <button className="btn btn-secondary" onClick={downloadQR}>
                  ⬇ Download SVG
                </button>
              </div>
            </div>
          ) : (
            <div className="qr-box">
              <div style={{ fontSize: 48, opacity: 0.3 }}>🔳</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Select or enter a batch ID to generate a QR code</p>
            </div>
          )}
        </div>

        {/* QR Scanner */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>📷 Scan QR Code</div>

          {scanSuccess && (
            <div className="alert alert-success">
              <span>✅</span>
              <div>
                {scanSuccess}
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={goVerify}>
                    🔍 Verify Batch
                  </button>
                </div>
              </div>
            </div>
          )}

          {scanError && (
            <div className="alert alert-error">
              <span>⚠</span><span>{scanError}</span>
            </div>
          )}

          {!scannerOpen ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>📷</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                Scan a PharmaChain QR code using your camera to instantly verify a medicine batch.
              </p>
              <button className="btn btn-primary btn-lg" onClick={startScanner}>
                📷 Open Camera Scanner
              </button>
            </div>
          ) : (
            <div>
              <div id="qr-reader" ref={scannerRef} style={{ width: '100%' }} />
              <button className="btn btn-secondary btn-full" onClick={stopScanner} style={{ marginTop: 12 }}>
                ✕ Stop Scanner
              </button>
            </div>
          )}

          <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Manual Batch ID Entry</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={scanResult || ''}
                onChange={e => setScanResult(e.target.value)}
                placeholder="Paste or type batch ID"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={goVerify}
                disabled={!scanResult}
              >
                Verify →
              </button>
            </div>
          </div>

          <div className="alert alert-info" style={{ marginTop: 16 }}>
            <span>ℹ</span>
            <span>
              Camera scanning requires browser permission. If it fails, use the manual batch ID entry above.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
