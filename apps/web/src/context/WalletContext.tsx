import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { WalletAccount } from '../types';
import { DEMO_ACCOUNTS } from '../services/mockDataService';

interface WalletContextType {
  account: WalletAccount;
  accounts: WalletAccount[];
  signer: ethers.Signer | null;
  provider: ethers.Provider;
  isMetaMask: boolean;
  isConnected: boolean;
  selectAccount: (account: WalletAccount) => void;
  connectMetaMask: () => Promise<void>;
  signTypedData: (domain: ethers.TypedDataDomain, types: Record<string, ethers.TypedDataField[]>, value: Record<string, unknown>) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const RPC_URL = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedAccount, setSelectedAccount] = useState<WalletAccount>(DEMO_ACCOUNTS[0]);
  const [isMetaMask, setIsMetaMask] = useState(false);
  const [customSigner, setCustomSigner] = useState<ethers.Signer | null>(null);

  const provider = useMemo(() => {
    return new ethers.JsonRpcProvider(RPC_URL);
  }, []);

  const signer = useMemo(() => {
    if (customSigner) return customSigner;
    if (selectedAccount.privateKey) {
      try {
        return new ethers.Wallet(selectedAccount.privateKey, provider);
      } catch {
        return null;
      }
    }
    return null;
  }, [selectedAccount, provider, customSigner]);

  const selectAccount = (acc: WalletAccount) => {
    setIsMetaMask(false);
    setCustomSigner(null);
    setSelectedAccount(acc);
  };

  const connectMetaMask = async () => {
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum) {
      try {
        const browserProvider = new ethers.BrowserProvider((window as unknown as { ethereum: ethers.Eip1193Provider }).ethereum);
        const mmSigner = await browserProvider.getSigner();
        const address = await mmSigner.getAddress();
        const balance = await browserProvider.getBalance(address);

        setCustomSigner(mmSigner);
        setIsMetaMask(true);
        setSelectedAccount({
          address,
          label: 'MetaMask Account',
          role: 'client',
          balanceEth: ethers.formatEther(balance),
        });
      } catch (err) {
        console.error('Failed to connect MetaMask:', err);
      }
    } else {
      alert('MetaMask or Web3 wallet extension not detected. Using local Anvil test accounts.');
    }
  };

  const signTypedData = async (
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> => {
    if (!signer) throw new Error('No active signer available');
    return await signer.signTypedData(domain, types, value);
  };

  // Poll balance if RPC provider is reachable
  useEffect(() => {
    let mounted = true;
    const fetchBalance = async () => {
      try {
        const bal = await provider.getBalance(selectedAccount.address);
        if (mounted) {
          setSelectedAccount((prev) => ({
            ...prev,
            balanceEth: parseFloat(ethers.formatEther(bal)).toFixed(4),
          }));
        }
      } catch {
        // RPC might be offline; use default static balance
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [selectedAccount.address, provider]);

  return (
    <WalletContext.Provider
      value={{
        account: selectedAccount,
        accounts: DEMO_ACCOUNTS,
        signer,
        provider,
        isMetaMask,
        isConnected: true,
        selectAccount,
        connectMetaMask,
        signTypedData,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
