/* eslint-disable @typescript-eslint/no-misused-promises */
"use client";

import { useState } from "react";
import { useCasperWallet } from "../../providers/WalletProvider";
import { Modal, Button, Spin } from "antd";
import { toast } from "sonner";
import { IoWallet, IoClose } from "react-icons/io5";
import { FiExternalLink, FiDownload } from "react-icons/fi";
import { BsCheckCircleFill } from "react-icons/bs";

// Supported Casper wallets
const CASPER_WALLETS = [
  {
    name: "Casper Wallet",
    icon: "/casper-wallet-icon.svg",
    downloadUrl: "https://www.casperwallet.io/",
    description: "Official Casper Network wallet",
    recommended: true,
  },
];

export function WalletSelectionModal({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const { connect, connected } = useCasperWallet();

  // Check if Casper Wallet is installed
  const isCasperWalletInstalled = () => {
    return typeof window !== "undefined" && window.CasperWalletProvider !== undefined;
  };

  const handleWalletSelect = async (walletName: string) => {
    if (!isCasperWalletInstalled()) {
      // Open download page
      window.open("https://www.casperwallet.io/", "_blank");
      toast.info("Please install Casper Wallet to continue");
      return;
    }

    setConnecting(walletName);
    try {
      await connect();
      toast.success("Wallet connected successfully!", {
        icon: <BsCheckCircleFill className="text-primary" />,
      });
      setOpen(false);
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast.error("Failed to connect wallet. Please try again.");
    } finally {
      setConnecting(null);
    }
  };

  // Close modal if already connected
  if (connected && open) {
    setOpen(false);
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{children}</div>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        centered
        width={420}
        closeIcon={<IoClose className="text-grey-300 text-xl" />}
        className="wallet-modal"
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
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <IoWallet className="text-primary text-2xl" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Connect Wallet
            </h2>
            <p className="text-grey-400 text-sm">
              Connect your Casper wallet to Sampled
            </p>
          </div>

          {/* Wallet List */}
          <div className="space-y-3">
            {CASPER_WALLETS.map((wallet) => {
              const isInstalled = wallet.name === "Casper Wallet" && isCasperWalletInstalled();

              return (
                <button
                  key={wallet.name}
                  onClick={() => handleWalletSelect(wallet.name)}
                  disabled={connecting !== null}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200
                    ${
                      connecting === wallet.name
                        ? "bg-primary/10 border-primary"
                        : "bg-grey-800 border-grey-700 hover:border-primary/50 hover:bg-grey-700"
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div className="w-10 h-10 rounded-lg bg-grey-700 flex items-center justify-center overflow-hidden">
                    {wallet.icon ? (
                      <img
                        src={wallet.icon}
                        alt={wallet.name}
                        className="w-6 h-6"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <IoWallet className="text-grey-400 text-xl" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {wallet.name}
                      </span>
                      {wallet.recommended && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-grey-400 text-xs mt-0.5">
                      {isInstalled ? wallet.description : "Click to install"}
                    </p>
                  </div>
                  {connecting === wallet.name ? (
                    <Spin size="small" />
                  ) : isInstalled ? (
                    <FiExternalLink className="text-grey-400" />
                  ) : (
                    <FiDownload className="text-grey-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Install wallet prompt */}
          {!isCasperWalletInstalled() && (
            <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-yellow-400 text-sm text-center">
                Casper Wallet not detected. Please install it to continue.
              </p>
              <Button
                type="primary"
                href="https://www.casperwallet.io/"
                target="_blank"
                className="!bg-primary !text-black !border-0 !mt-3 !w-full"
              >
                Install Casper Wallet
              </Button>
            </div>
          )}

          {/* Network info */}
          <div className="mt-4 p-3 bg-grey-800 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-grey-400 text-xs">
                Connecting to {import.meta.env.PUBLIC_VITE_CASPER_NETWORK === "mainnet" ? "Casper Mainnet" : "Casper Testnet"}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-grey-700">
            <p className="text-grey-500 text-xs text-center">
              By connecting, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
