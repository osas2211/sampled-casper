/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, react-refresh/only-export-components */
import { createContext, useMemo, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export interface WalletContextType {
  address?: string;
  isConnected: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  ready: boolean;
  signTransaction?: (tx: unknown) => Promise<unknown>;
}

export const WalletContext = createContext<WalletContextType>({
  isConnected: false,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  ready: false,
});

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const wallet = wallets[0];
  const address = wallet?.address;

  const signTransaction = useCallback(
    async (tx: unknown) => {
      if (!wallet) {
        throw new Error("No wallet connected");
      }
      // Get the provider and sign the transaction
      const provider = await wallet.getEthereumProvider();
      const result = await provider.request({
        method: "eth_sendTransaction",
        params: [tx],
      });
      return result;
    },
    [wallet],
  );

  const contextValue = useMemo(
    () => ({
      address,
      isConnected: authenticated && !!address,
      isLoading: !ready,
      login,
      logout,
      ready,
      signTransaction: wallet ? signTransaction : undefined,
    }),
    [address, authenticated, ready, login, logout, wallet, signTransaction],
  );

  return <WalletContext value={contextValue}>{children}</WalletContext>;
};
