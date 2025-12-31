import { useCasperWallet } from "../providers/WalletProvider";
import { MySamples } from "../components/explore/MySamples";
import { WalletButton } from "../components/WalletButton";

const MySamplesPage = () => {
  const { connected } = useCasperWallet();
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
