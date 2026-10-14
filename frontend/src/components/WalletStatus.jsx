import React from 'react'
import { useWallet } from '../hooks/useWallet'

export default function WalletStatus() {
  const { account, role, isConnecting, isCorrectNetwork, connect, disconnect } = useWallet()

  const shortAddr = addr => addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : ''

  if (!account) {
    return (
      <button className="btn btn-accent btn-sm" onClick={connect} disabled={isConnecting}>
        {isConnecting ? <><span className="spinner" style={{width:14,height:14}}/> Connecting…</> : '🔌 Connect Wallet'}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {!isCorrectNetwork && (
        <span className="badge badge-warning">⚠ Wrong Network</span>
      )}
      {role && role !== 'PUBLIC' && (
        <span className={`badge badge-${roleBadgeClass(role)}`}>{role}</span>
      )}
      <div className="wallet-pill">
        <span className="wallet-dot" />
        {shortAddr(account)}
      </div>
      <button className="btn btn-secondary btn-sm" onClick={disconnect} title="Disconnect">✕</button>
    </div>
  )
}

function roleBadgeClass(role) {
  const map = { ADMIN: 'error', MANUFACTURER: 'primary', DISTRIBUTOR: 'info', PHARMACY: 'success' }
  return map[role] || 'muted'
}
