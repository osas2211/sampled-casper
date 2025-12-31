import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { MySamples } from "../components/explore/MySamples";
import { WalletButton } from "../components/WalletButton";

const MySamplesPage = () => {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p>Please connect your wallet</p>
          <WalletButton />
        </div>
      </div>
    );
  }
  return (
    <div>
      <MySamples />
    </div>
  );
};

export default MySamplesPage;
