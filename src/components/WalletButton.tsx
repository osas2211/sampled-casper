/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises */

import { Button, Modal, Tooltip } from "antd";
import { useCasperWallet } from "../providers/WalletProvider";
import { WalletSelectionModal } from "./wallet/WalletConnectionModal";
import { useState, useEffect, useCallback } from "react";
import {
  IoWallet,
  IoLogOutOutline,
  IoCopyOutline,
  IoCheckmark,
} from "react-icons/io5";
import { FiExternalLink } from "react-icons/fi";
import { HiOutlineRefresh } from "react-icons/hi";
import { fetchBalance, formatBalance, type Balance } from "../util/wallet";
import { toast } from "sonner";

// Casper explorer URL
const CASPER_EXPLORER_URL = import.meta.env.VITE_CASPER_NETWORK === "mainnet"
  ? "https://cspr.live"
  : "https://testnet.cspr.live";

export const WalletButton = () => {
  const { account, connected, isLoading, disconnect, network } = useCasperWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const address = account?.address || "";

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const loadBalance = useCallback(async () => {
    if (!address) return;
    setBalanceLoading(true);
    try {
      const result = await fetchBalance(address);
      setBalances(result);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    } finally {
      setBalanceLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (connected && address) {
      loadBalance();
    }
  }, [connected, address, loadBalance]);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy address");
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setModalOpen(false);
    toast.success("Wallet disconnected");
  };

  const nativeBalance = balances.find((b) => b.asset_type === "native");

  if (isLoading) {
    return (
      <Button
        type="primary"
        className="w-[150px] md:!h-[42px] !h-[35px] !rounded-full font-semibold"
        loading
      >
        Loading...
      </Button>
    );
  }

  if (connected && account?.address) {
    return (
      <>
        <Button
          type="primary"
          className="md:!h-[42px] !h-[35px] !rounded-full font-semibold !flex !items-center !gap-2 !px-4"
          onClick={() => setModalOpen(true)}
        >
          <IoWallet className="text-lg" />
          <span className="hidden sm:inline">{truncateAddress(address)}</span>
        </Button>

        <Modal
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          centered
          width={400}
          styles={{
            content: {
              padding: 0,
              borderRadius: "16px",
              backgroundColor: "#1b1819",
              border: "1px solid #262424",
            },
            mask: { backdropFilter: "blur(8px)" },
          }}
        >
          <div className="p-6">
            {/* Wallet Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <IoWallet className="text-primary text-2xl" />
              </div>
              <div>
                <p className="text-white font-medium">Casper Wallet</p>
                <p className="text-grey-400 text-sm">Connected</p>
              </div>
            </div>

            {/* Address Section */}
            <div className="bg-grey-800 rounded-xl p-4 mb-4">
              <p className="text-grey-400 text-xs mb-2">Wallet Address</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-white text-sm font-mono break-all">
                  {truncateAddress(address)}
                </code>
                <div className="flex items-center gap-1">
                  <Tooltip title={copied ? "Copied!" : "Copy address"}>
                    <button
                      onClick={handleCopyAddress}
                      className="p-2 rounded-lg hover:bg-grey-700 transition-colors text-grey-300 hover:text-white"
                    >
                      {copied ? (
                        <IoCheckmark className="text-primary" />
                      ) : (
                        <IoCopyOutline />
                      )}
                    </button>
                  </Tooltip>
                  <Tooltip title="View on explorer">
                    <a
                      href={`${CASPER_EXPLORER_URL}/account/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-grey-700 transition-colors text-grey-300 hover:text-white"
                    >
                      <FiExternalLink />
                    </a>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Balance Section */}
            <div className="bg-grey-800 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-grey-400 text-xs">Balance</p>
                <button
                  onClick={loadBalance}
                  disabled={balanceLoading}
                  className="p-1.5 rounded-lg hover:bg-grey-700 transition-colors text-grey-400 hover:text-white disabled:opacity-50"
                >
                  <HiOutlineRefresh
                    className={`text-sm ${balanceLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-grey-700 flex items-center justify-center">
                  <img
                    src="/casper-logo.svg"
                    alt="CSPR"
                    className="w-6 h-6"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div>
                  <p className="text-white text-lg font-semibold">
                    {balanceLoading
                      ? "..."
                      : formatBalance(nativeBalance?.balance || "0")}{" "}
                    <span className="text-grey-400 text-sm font-normal">
                      {nativeBalance?.symbol || "CSPR"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Network Info */}
            <div className="bg-grey-800 rounded-xl p-4 mb-6">
              <p className="text-grey-400 text-xs mb-2">Network</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-white text-sm">
                  {network?.name || "Casper Network"}
                </p>
              </div>
            </div>

            {/* Disconnect Button */}
            <Button
              type="default"
              danger
              size="large"
              block
              icon={<IoLogOutOutline />}
              onClick={handleDisconnect}
              className="!bg-red-500/10 !border-red-500/30 !text-red-400 hover:!bg-red-500/20 hover:!border-red-500/50 !rounded-xl !h-12"
            >
              Disconnect Wallet
            </Button>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <WalletSelectionModal>
      <Button
        type="primary"
        className="md:!h-[42px] !h-[35px] !rounded-full font-semibold !flex !items-center !gap-2 !px-4"
      >
        <IoWallet className="text-lg" />
        <span>Connect Wallet</span>
      </Button>
    </WalletSelectionModal>
  );
};
