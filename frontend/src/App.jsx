import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { WalletProvider } from './hooks/useWallet'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import RegisterMedicine from './pages/RegisterMedicine'
import SupplyChain from './pages/SupplyChain'
import Verification from './pages/Verification'
import TransactionHistory from './pages/TransactionHistory'
import ParticipantManagement from './pages/ParticipantManagement'
import QRCodePage from './pages/QRCodePage'
import ConnectWallet from './pages/ConnectWallet'

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="connect" element={<ConnectWallet />} />
            <Route path="register" element={<RegisterMedicine />} />
            <Route path="supply-chain" element={<SupplyChain />} />
            <Route path="verify" element={<Verification />} />
            <Route path="verify/:batchId" element={<Verification />} />
            <Route path="history" element={<TransactionHistory />} />
            <Route path="participants" element={<ParticipantManagement />} />
            <Route path="qr" element={<QRCodePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  )
}
