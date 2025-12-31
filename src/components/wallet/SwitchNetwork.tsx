/* eslint-disable @typescript-eslint/no-explicit-any */

import { Tag } from "antd";
import { IoCheckmarkCircle, IoWarning } from "react-icons/io5";
import { useCasperWallet } from "../../providers/WalletProvider";

// Get network from environment
const CASPER_NETWORK = import.meta.env.VITE_CASPER_NETWORK || "testnet";
const isMainnet = CASPER_NETWORK === "mainnet";

export function SwitchNetwork() {
  const { connected, network } = useCasperWallet();

  if (!connected) {
    return null;
  }

  return (
    <div className="bg-grey-800 rounded-xl p-4 border border-grey-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-grey-300 text-sm">Network</span>
        <Tag
          icon={<IoCheckmarkCircle className="mr-1" />}
          color="success"
          className="!bg-primary/20 !text-primary !border-primary/30 !m-0 flex items-center"
        >
          Connected
        </Tag>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-grey-700 flex items-center justify-center">
          <img
            src="/casper-logo.svg"
            alt="Casper"
            className="w-5 h-5"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div>
          <p className="text-white font-medium">
            {network?.name || (isMainnet ? "Casper Mainnet" : "Casper Testnet")}
          </p>
          <p className="text-grey-400 text-xs">
            Chain: {network?.chainName || (isMainnet ? "casper" : "casper-test")}
          </p>
        </div>
      </div>

      <div className="bg-grey-700/50 border border-grey-600 rounded-lg p-3">
        <p className="text-grey-300 text-sm">
          {isMainnet ? (
            <>
              <IoCheckmarkCircle className="inline mr-1 text-primary" />
              Connected to Casper Mainnet
            </>
          ) : (
            <>
              <IoWarning className="inline mr-1 text-amber-400" />
              Connected to Casper Testnet (development mode)
            </>
          )}
        </p>
      </div>

      <p className="text-grey-400 text-xs mt-3 text-center">
        Network is configured via environment settings
      </p>
    </div>
  );
}
