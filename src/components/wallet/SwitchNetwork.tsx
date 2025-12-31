/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-misused-promises */

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { toast } from "sonner";
import { Button, Tag } from "antd";
import { useState } from "react";
import { HiOutlineSwitchHorizontal } from "react-icons/hi";
import { IoCheckmarkCircle, IoWarning } from "react-icons/io5";

export function SwitchNetwork() {
  const { network, wallet, connected } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);

  // Detect current network by chain ID
  const isMovementMainnet = network?.chainId === 126;
  const isMovementTestnet = network?.chainId === 250;
  const isNightly = wallet?.name?.toLowerCase()?.includes("nightly");
  const isOnMovement = isMovementMainnet || isMovementTestnet;

  const handleSwitchNetwork = async (targetNetwork: "mainnet" | "testnet") => {
    const chainId = targetNetwork === "mainnet" ? 126 : 250;

    // Only Nightly supports Movement network switching
    if (isNightly && typeof window !== "undefined") {
      if ((window as any).nightly?.aptos?.changeNetwork) {
        setIsSwitching(true);
        try {
          await (window as any).nightly.aptos.changeNetwork({
            chainId,
            name: "custom",
          });
          toast.success(`Switched to Movement ${targetNetwork}`);
        } catch {
          toast.error("Failed to switch network");
        } finally {
          setIsSwitching(false);
        }
        return;
      }
    }

    toast.error("Network switching only supported with Nightly wallet");
  };

  if (!connected) {
    return null;
  }

  return (
    <div className="bg-grey-800 rounded-xl p-4 border border-grey-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-grey-300 text-sm">Network</span>
        {isOnMovement ? (
          <Tag
            icon={<IoCheckmarkCircle className="mr-1" />}
            color="success"
            className="!bg-primary/20 !text-primary !border-primary/30 !m-0 flex items-center"
          >
            Connected
          </Tag>
        ) : (
          <Tag
            icon={<IoWarning className="mr-1" />}
            color="warning"
            className="!bg-amber-500/20 !text-amber-400 !border-amber-500/30 !m-0 flex items-center"
          >
            Wrong Network
          </Tag>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-grey-700 flex items-center justify-center">
          <img
            src="/casper-logo.svg"
            alt="Movement"
            className="w-5 h-5"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div>
          <p className="text-white font-medium">
            {isMovementMainnet
              ? "Movement Mainnet"
              : isMovementTestnet
                ? "Movement Testnet"
                : network?.name || "Unknown Network"}
          </p>
          <p className="text-grey-400 text-xs">
            Chain ID: {network?.chainId || "N/A"}
          </p>
        </div>
      </div>

      {!isOnMovement && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
          <p className="text-amber-400 text-sm">
            Please switch to Movement Network to use this app.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type={isMovementMainnet ? "primary" : "default"}
          className={`flex-1 ${isMovementMainnet ? "!bg-primary !text-black" : "!bg-grey-700 !border-grey-600 !text-white hover:!border-primary"}`}
          icon={<HiOutlineSwitchHorizontal />}
          loading={isSwitching}
          disabled={isMovementMainnet || !isNightly}
          onClick={() => handleSwitchNetwork("mainnet")}
        >
          Mainnet
        </Button>
        <Button
          type={isMovementTestnet ? "primary" : "default"}
          className={`flex-1 ${isMovementTestnet ? "!bg-primary !text-black" : "!bg-grey-700 !border-grey-600 !text-white hover:!border-primary"}`}
          icon={<HiOutlineSwitchHorizontal />}
          loading={isSwitching}
          disabled={isMovementTestnet || !isNightly}
          onClick={() => handleSwitchNetwork("testnet")}
        >
          Testnet
        </Button>
      </div>

      {!isNightly && connected && (
        <p className="text-grey-400 text-xs mt-3 text-center">
          Network switching requires Nightly wallet
        </p>
      )}
    </div>
  );
}
