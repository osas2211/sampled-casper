import {
  createContext,
  use,
  useState,
  useEffect,
  useCallback,
  PropsWithChildren,
} from "react";
import { PublicKey } from "casper-js-sdk";

// Casper Wallet types
interface CasperWalletState {
  isConnected: boolean;
  activeKey: string | null;
  isLocked: boolean;
}

interface CasperWalletEventDetail {
  isConnected?: boolean;
  activeKey?: string;
  isLocked?: boolean;
  isUnlocked?: boolean;
}

// Context type
export interface CasperWalletContextType {
  account: { address: string; publicKey: PublicKey } | null;
  connected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signDeploy: (deployJson: string) => Promise<string>;
  network: { name: string; chainName: string };
}

const CasperWalletContext = createContext<CasperWalletContextType | null>(null);

// Casper network configuration
const CASPER_NETWORK = {
  testnet: {
    name: "Casper Testnet",
    chainName: "casper-test",
    rpcUrl: "https://rpc.testnet.casperlabs.io/rpc",
  },
  mainnet: {
    name: "Casper Mainnet",
    chainName: "casper",
    rpcUrl: "https://rpc.mainnet.casperlabs.io/rpc",
  },
};

// Get current network from env
const getCurrentNetwork = () => {
  const env = import.meta.env.VITE_CASPER_NETWORK || "testnet";
  return env === "mainnet" ? CASPER_NETWORK.mainnet : CASPER_NETWORK.testnet;
};

// Type for window.CasperWalletProvider
declare global {
  interface Window {
    CasperWalletProvider?: () => {
      requestConnection: () => Promise<boolean>;
      disconnectFromSite: () => Promise<boolean>;
      getActivePublicKey: () => Promise<string>;
      signDeploy: (deployJson: string, publicKey: string) => Promise<string>;
      isConnected: () => Promise<boolean>;
    };
    CasperWalletEventTypes?: {
      Connected: string;
      Disconnected: string;
      ActiveKeyChanged: string;
      Locked: string;
      Unlocked: string;
    };
  }
}

export const WalletProvider = ({ children }: PropsWithChildren) => {
  const [account, setAccount] = useState<{ address: string; publicKey: PublicKey } | null>(null);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const network = getCurrentNetwork();

  // Get Casper Wallet provider
  const getProvider = useCallback(() => {
    if (typeof window !== "undefined" && window.CasperWalletProvider) {
      return window.CasperWalletProvider();
    }
    return null;
  }, []);

  // Check if wallet is connected on mount
  useEffect(() => {
    const checkConnection = async () => {
      const provider = getProvider();
      if (provider) {
        try {
          const isConnected = await provider.isConnected();
          if (isConnected) {
            const activeKey = await provider.getActivePublicKey();
            if (activeKey) {
              const publicKey = PublicKey.fromHex(activeKey);
              setAccount({
                address: activeKey,
                publicKey,
              });
              setConnected(true);
            }
          }
        } catch (error) {
          console.error("Error checking wallet connection:", error);
        }
      }
      setIsLoading(false);
    };

    // Wait for Casper Wallet to be injected
    const timer = setTimeout(checkConnection, 500);
    return () => clearTimeout(timer);
  }, [getProvider]);

  // Listen for wallet events
  useEffect(() => {
    const handleWalletEvent = (event: CustomEvent<CasperWalletEventDetail>) => {
      const { activeKey, isConnected: connected, isLocked } = event.detail;

      if (isLocked) {
        setAccount(null);
        setConnected(false);
        return;
      }

      if (connected === false) {
        setAccount(null);
        setConnected(false);
        return;
      }

      if (activeKey) {
        try {
          const publicKey = PublicKey.fromHex(activeKey);
          setAccount({
            address: activeKey,
            publicKey,
          });
          setConnected(true);
        } catch (error) {
          console.error("Error parsing public key:", error);
        }
      }
    };

    // Listen to all Casper Wallet events
    const eventTypes = window.CasperWalletEventTypes;
    if (eventTypes) {
      window.addEventListener(eventTypes.Connected, handleWalletEvent as EventListener);
      window.addEventListener(eventTypes.Disconnected, handleWalletEvent as EventListener);
      window.addEventListener(eventTypes.ActiveKeyChanged, handleWalletEvent as EventListener);
      window.addEventListener(eventTypes.Locked, handleWalletEvent as EventListener);
      window.addEventListener(eventTypes.Unlocked, handleWalletEvent as EventListener);

      return () => {
        window.removeEventListener(eventTypes.Connected, handleWalletEvent as EventListener);
        window.removeEventListener(eventTypes.Disconnected, handleWalletEvent as EventListener);
        window.removeEventListener(eventTypes.ActiveKeyChanged, handleWalletEvent as EventListener);
        window.removeEventListener(eventTypes.Locked, handleWalletEvent as EventListener);
        window.removeEventListener(eventTypes.Unlocked, handleWalletEvent as EventListener);
      };
    }
  }, []);

  // Connect wallet
  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://www.casperwallet.io/", "_blank");
      return;
    }

    setIsLoading(true);
    try {
      const connected = await provider.requestConnection();
      if (connected) {
        const activeKey = await provider.getActivePublicKey();
        if (activeKey) {
          const publicKey = PublicKey.fromHex(activeKey);
          setAccount({
            address: activeKey,
            publicKey,
          });
          setConnected(true);
        }
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getProvider]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) {
      try {
        await provider.disconnectFromSite();
      } catch (error) {
        console.error("Error disconnecting wallet:", error);
      }
    }
    setAccount(null);
    setConnected(false);
  }, [getProvider]);

  // Sign deploy
  const signDeploy = useCallback(async (deployJson: string): Promise<string> => {
    const provider = getProvider();
    if (!provider || !account) {
      throw new Error("Wallet not connected");
    }

    const signature = await provider.signDeploy(deployJson, account.address);
    return signature;
  }, [getProvider, account]);

  const value: CasperWalletContextType = {
    account,
    connected,
    isLoading,
    connect,
    disconnect,
    signDeploy,
    network,
  };

  return (
    <CasperWalletContext value={value}>
      {children}
    </CasperWalletContext>
  );
};

// Hook to use wallet context
export const useCasperWallet = () => {
  const context = use(CasperWalletContext);
  if (!context) {
    throw new Error("useCasperWallet must be used within a WalletProvider");
  }
  return context;
};

// Backwards-compatible hook (same interface as before)
export const useWallet = () => {
  const { account, connected, isLoading, disconnect } = useCasperWallet();
  return {
    account: account ? { address: account.address } : undefined,
    connected,
    isLoading,
    disconnect,
    wallet: connected ? { name: "Casper Wallet", icon: "/casper-wallet.svg" } : null,
    network: { chainId: connected ? 1 : 0, name: "casper-test" },
  };
};
