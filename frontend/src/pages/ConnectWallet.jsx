import React from 'react'
import { useWallet } from '../hooks/useWallet'
import contractConfig from '../config/contract.json'

export default function ConnectWallet() {
  const {
    account, chainId, role, isConnecting, error, contractError,
    isCorrectNetwork, connect, disconnect, switchNetwork, setError,
  } = useWallet()

  const shortAddr = addr => addr ? addr.slice(0, 10) + '…' + addr.slice(-8) : ''

  return (
    <div>
      <div className="page-header">
        <h1>🔌 Connect Wallet</h1>
        <p>Connect your MetaMask wallet to interact with PharmaChain on the local Hardhat network.</p>
      </div>

      <div className="grid-2">
        {/* Connection Card */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>MetaMask Connection</div>

          {error && (
            <div className="alert alert-error">
              <span>⚠</span>
              <div>
                {error}
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => setError(null)}>Dismiss</button>
              </div>
            </div>
          )}

          {!account ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🦊</div>
              <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>MetaMask Required</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
                PharmaChain uses MetaMask to sign transactions on the local Hardhat blockchain.
                No real cryptocurrency is involved.
              </p>
              {!window.ethereum ? (
                <div>
                  <div className="alert alert-warning">
                    <span>⚠</span>
                    <span>MetaMask is not installed. Please install the MetaMask browser extension.</span>
                  </div>
                  <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="btn btn-primary btn-lg">
                    Install MetaMask
                  </a>
                </div>
              ) : (
                <button className="btn btn-primary btn-lg" onClick={connect} disabled={isConnecting}>
                  {isConnecting
                    ? <><span className="spinner" /> Connecting to MetaMask…</>
                    : '🔌 Connect MetaMask'}
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="alert alert-success">
                <span>✅</span>
                <span>Wallet connected successfully!</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoRow label="Address" value={<span className="monospace">{account}</span>} />
                <InfoRow label="Network" value={
                  isCorrectNetwork
                    ? <span className="badge badge-success">✓ Hardhat Local (Chain {chainId})</span>
                    : <span className="badge badge-error">✗ Wrong Network (Chain {chainId})</span>
                } />
                <InfoRow label="Role" value={
                  <span className={`badge badge-${roleBadge(role)}`}>
                    {role || (isCorrectNetwork ? 'Role unavailable' : 'Switch network to read role')}
                  </span>
                } />
                <InfoRow label="Contract" value={
                  <span className="monospace" style={{ fontSize: 12 }}>{contractConfig.contractAddress}</span>
                } />
                <InfoRow label="Contract Admin" value={
                  <span className="monospace" style={{ fontSize: 12 }}>{contractConfig.adminAddress}</span>
                } />
              </div>

              {contractError && (
                <div className="alert alert-error" style={{ marginTop: 16 }}>
                  <span>⚠</span>
                  <span>{contractError}</span>
                </div>
              )}

              {!isCorrectNetwork && (
                <div className="alert alert-warning" style={{ marginTop: 16 }}>
                  <span>⚠</span>
                  <span>
                    You are on the wrong network. Please switch MetaMask to the Hardhat Local network
                    (RPC: {contractConfig.rpcUrl}, Chain ID: {contractConfig.chainId}).
                  </span>
                  <button className="btn btn-primary btn-sm" style={{ marginLeft: 8 }} onClick={switchNetwork}>
                    Switch network
                  </button>
                </div>
              )}

              <button className="btn btn-secondary btn-full" style={{ marginTop: 20 }} onClick={disconnect}>
                Disconnect Wallet
              </button>
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}>⚙️ MetaMask Setup Guide</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Step number={1} title="Add Hardhat Local Network" color="var(--primary)">
              <p>Open MetaMask → Networks → Add a network → Add manually:</p>
              <ConfigBlock items={[
                ['Network Name', 'Hardhat Local'],
                ['RPC URL', contractConfig.rpcUrl],
                ['Chain ID', String(contractConfig.chainId)],
                ['Currency Symbol', 'ETH'],
              ]} />
            </Step>

            <Step number={2} title="Start Local Blockchain" color="var(--accent-dark)">
              <p>In Terminal 1 (blockchain folder):</p>
              <CodeBlock code="npx hardhat node" />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                This starts a local Ethereum node. Keep this terminal open.
              </p>
            </Step>

            <Step number={3} title="Import a Test Account" color="var(--warning)">
              <p>Copy a private key from the <code>hardhat node</code> output (Account #0–#9), then:</p>
              <p style={{ marginTop: 8 }}>MetaMask → Account circle → Import account → Paste private key</p>
              <p style={{ marginTop: 8 }}>
                Account #0 is the administrator that deploys the contract. Import only a local Hardhat test account;
                its development key is printed by your local node and must never be used with real funds.
              </p>
              <div className="alert alert-warning" style={{ marginTop: 8 }}>
                <span>⚠</span>
                <span>
                  <strong>NEVER</strong> use these test keys on mainnet or with real funds.
                  Never share your real Secret Recovery Phrase.
                </span>
              </div>
            </Step>

            <Step number={4} title="Deploy the Contract" color="var(--success)">
              <p>In Terminal 2 (blockchain folder):</p>
              <CodeBlock code="npx hardhat run scripts/deploy.js --network localhost" />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                The contract address and ABI will be automatically written to the frontend config.
              </p>
            </Step>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', minWidth: 90 }}>{label}</span>
      <span style={{ flex: 1 }}>{value}</span>
    </div>
  )
}

function Step({ number, title, color, children }) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: color,
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2,
      }}>{number}</div>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>{title}</h4>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  )
}

function ConfigBlock({ items }) {
  return (
    <div style={{
      background: 'var(--bg)', borderRadius: 8, padding: '12px 16px',
      marginTop: 8, border: '1px solid var(--border)',
    }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 120 }}>{k}:</span>
          <span className="monospace" style={{ fontWeight: 600 }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function CodeBlock({ code }) {
  return (
    <div style={{
      background: '#1a2332', color: '#00d4aa', borderRadius: 8, padding: '10px 16px',
      fontFamily: 'Courier New, monospace', fontSize: 13, marginTop: 8,
    }}>
      $ {code}
    </div>
  )
}

function roleBadge(role) {
  const map = { ADMIN: 'error', MANUFACTURER: 'primary', DISTRIBUTOR: 'info', PHARMACY: 'success' }
  return map[role] || 'muted'
}
