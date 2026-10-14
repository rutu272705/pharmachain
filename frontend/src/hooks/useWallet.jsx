import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import contractJSON from '../config/contract.json'
import PharmaChainABI from '../config/PharmaChainABI.json'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [account, setAccount]         = useState(null)
  const [provider, setProvider]       = useState(null)
  const [signer, setSigner]           = useState(null)
  const [chainId, setChainId]         = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError]             = useState(null)
  const [contractError, setContractError] = useState(null)
  const [role, setRole]               = useState(null) // 'ADMIN','MANUFACTURER','DISTRIBUTOR','PHARMACY','NONE'

  const ROLE_NAMES = ['NONE', 'ADMIN', 'MANUFACTURER', 'DISTRIBUTOR', 'PHARMACY']

  const detectRole = useCallback(async (addr, prov) => {
    setRole(null)
    setContractError(null)
    try {
      const network = await prov.getNetwork()
      if (Number(network.chainId) !== Number(contractJSON.chainId)) return

      const code = await prov.getCode(contractJSON.contractAddress)
      if (code === '0x') {
        setContractError(
          `No PharmaChain contract is deployed at ${contractJSON.contractAddress} on chain ${contractJSON.chainId}. Deploy the contract using the blockchain folder's local deployment command.`
        )
        return
      }

      const contract = new ethers.Contract(contractJSON.contractAddress, PharmaChainABI, prov)
      const adminAddr = await contract.getAdmin()
      if (addr.toLowerCase() === adminAddr.toLowerCase()) {
        setRole('ADMIN')
        return
      }
      const roleIdx = await contract.getRole(addr)
      setRole(ROLE_NAMES[Number(roleIdx)] || 'NONE')
    } catch (err) {
      setContractError(`Unable to read the wallet role from PharmaChain: ${err.shortMessage || err.message || 'Unknown contract error'}`)
    }
  }, [])

  const updateWallet = useCallback(async (addr) => {
    const prov = new ethers.BrowserProvider(window.ethereum)
    const sign = await prov.getSigner(addr)
    const network = await prov.getNetwork()

    setAccount(addr)
    setProvider(prov)
    setSigner(sign)
    setChainId(Number(network.chainId))
    await detectRole(addr, prov)
  }, [detectRole])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to use PharmaChain.')
      return
    }
    setIsConnecting(true)
    setError(null)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      await updateWallet(accounts[0])
    } catch (err) {
      if (err.code === 4001) {
        setError('Connection rejected. Please approve the MetaMask request.')
      } else {
        setError('Failed to connect wallet: ' + (err.message || 'Unknown error'))
      }
    } finally {
      setIsConnecting(false)
    }
  }, [updateWallet])

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to use PharmaChain.')
      return
    }

    setError(null)
    const targetChainId = Number(contractJSON.chainId)
    const chainIdHex = `0x${targetChainId.toString(16)}`
    const networkConfig = {
      chainId: chainIdHex,
      chainName: contractJSON.networkName,
      rpcUrls: [contractJSON.rpcUrl],
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch (err) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          })
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
          })
        } catch (addError) {
          setError(addError.code === 4001
            ? 'Adding or switching to the Hardhat Local network was rejected in MetaMask.'
            : `Failed to add or switch to the Hardhat Local network: ${addError.message || 'Unknown error'}`)
        }
      } else {
        setError(err.code === 4001
          ? 'Network switch was rejected in MetaMask.'
          : `Failed to switch networks: ${err.message || 'Unknown error'}`)
      }
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
    setProvider(null)
    setSigner(null)
    setChainId(null)
    setRole(null)
    setError(null)
    setContractError(null)
  }, [])

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        try {
          await updateWallet(accounts[0])
        } catch (err) {
          setRole(null)
          setContractError(`Unable to load the selected MetaMask account: ${err.message || 'Unknown error'}`)
        }
      }
    }
    const handleChainChanged = () => {
      window.location.reload()
    }
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener('chainChanged', handleChainChanged)
    }
  }, [disconnect, updateWallet])

  // Auto-reconnect if already connected
  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum.request({ method: 'eth_accounts' }).then(async (accounts) => {
      if (accounts.length > 0) {
        await updateWallet(accounts[0])
      }
    }).catch((err) => {
      setError(`Failed to reconnect MetaMask: ${err.message || 'Unknown error'}`)
    })
  }, [updateWallet])

  const isCorrectNetwork = chainId === contractJSON.chainId

  return (
    <WalletContext.Provider value={{
      account, provider, signer, chainId, role,
      isConnecting, error, contractError, isCorrectNetwork,
      connect, disconnect, switchNetwork, setError, detectRole,
    }}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
