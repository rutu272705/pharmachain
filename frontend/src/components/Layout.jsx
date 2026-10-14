import React from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useWallet } from '../hooks/useWallet'
import WalletStatus from './WalletStatus'
import contractConfig from '../config/contract.json'

function SidebarLogo() {
  return (
    <div className="sidebar-logo">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="8" fill="#00d4aa" fillOpacity="0.2"/>
        <path d="M18 7L28 13V23L18 29L8 23V13L18 7Z" stroke="#00d4aa" strokeWidth="2" fill="none"/>
        <circle cx="18" cy="18" r="4" fill="#00d4aa"/>
        <path d="M18 9V15M18 21V27M10 13L15 16M21 20L26 23M26 13L21 16M15 20L10 23" stroke="#00d4aa" strokeWidth="1.5"/>
      </svg>
      <div className="sidebar-logo-text">
        <h1>PharmaChain</h1>
        <span>Blockchain Supply Chain</span>
      </div>
    </div>
  )
}

const navItems = [
  {
    section: 'Overview',
    links: [
      { to: '/dashboard',   icon: '⬡', label: 'Dashboard' },
      { to: '/connect',     icon: '⬡', label: 'Connect Wallet' },
    ],
  },
  {
    section: 'Supply Chain',
    links: [
      { to: '/register',     icon: '⬡', label: 'Register Medicine' },
      { to: '/supply-chain', icon: '⬡', label: 'Supply Chain' },
      { to: '/verify',       icon: '⬡', label: 'Verify Medicine' },
      { to: '/qr',           icon: '⬡', label: 'QR Code Scanner' },
    ],
  },
  {
    section: 'Management',
    links: [
      { to: '/history',      icon: '⬡', label: 'Transactions' },
      { to: '/participants', icon: '⬡', label: 'Participants' },
    ],
  },
]

// Map path → page title
const pageTitles = {
  '/dashboard':    'Dashboard',
  '/connect':      'Connect Wallet',
  '/register':     'Register Medicine',
  '/supply-chain': 'Supply Chain Management',
  '/verify':       'Medicine Verification',
  '/qr':           'QR Code',
  '/history':      'Transaction History',
  '/participants': 'Participant Management',
}

export default function Layout() {
  const location = useLocation()
  const title = Object.entries(pageTitles).find(([k]) => location.pathname.startsWith(k))?.[1] || 'PharmaChain'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <SidebarLogo />
        <nav className="sidebar-nav">
          {navItems.map(section => (
            <div key={section.section}>
              <div className="sidebar-section-label">{section.section}</div>
              {section.links.map(link => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
                >
                  <NavIcon path={link.to} />
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
          Mumbai University BLC Project<br />
          {contractConfig.networkName} · Chain {contractConfig.chainId}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-wallet">
            <WalletStatus />
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function NavIcon({ path }) {
  const icons = {
    '/dashboard':    <DashboardIcon />,
    '/connect':      <WalletIcon />,
    '/register':     <PlusIcon />,
    '/supply-chain': <TruckIcon />,
    '/verify':       <ShieldIcon />,
    '/qr':           <QRIcon />,
    '/history':      <HistoryIcon />,
    '/participants': <UsersIcon />,
  }
  return icons[path] || null
}

// ── Inline SVG icons ──────────────────────────────────────────────
const s = { width: 18, height: 18, fill: 'currentColor' }

function DashboardIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
}
function WalletIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1h-9a2 2 0 00-2 2v8a2 2 0 002 2h9zm-9-2h10V8H12v8zm4-2.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg>
}
function PlusIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
}
function TruckIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
}
function ShieldIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
}
function QRIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM19 19h2v2h-2z"/></svg>
}
function HistoryIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6a7 7 0 117 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12z"/></svg>
}
function UsersIcon() {
  return <svg {...s} viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
}
