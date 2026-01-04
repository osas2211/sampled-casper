/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises */

import { Avatar, Button } from "antd";
import { useWalletBalance } from "../../hooks/useWalletBalance";
// TODO: Define Sample type for Casper

import {
  getAccountHashFromPublicKey,
  motesToCspr,
  useHasPurchased,
  usePurchaseSample,
} from "../../hooks/useSampledContract";
import { downloadAudio } from "../../util/download-audio";
import { toast } from "sonner";
import { BsCheckCircleFill } from "react-icons/bs";
import { Link } from "react-router-dom";
import { ISample } from "../../@types/sample"
import { useCasperWallet } from "../../providers/WalletProvider"

export const PurchaseSampleTab = ({ sample }: { sample: ISample }) => {
  const { balances, updateBalance, } = useWalletBalance();
  const { data: hasPurchased, refetch: refetchPurchaseStatus } =
    useHasPurchased(sample?.sample_id);
  console.log(hasPurchased)
  const { mutate: purchaseSample, isPending: isPurchasing } =
    usePurchaseSample();
  const { account } = useCasperWallet();
  const userAccountHash = getAccountHashFromPublicKey(account?.address!!)
  const address = account?.address
  const isSeller = userAccountHash === sample?.seller;

  const handlePurchase = async () => {
    if (!address) {
      // TODO: Implement Casper wallet connection
      toast.error("Error", {
        className: "!bg-red-500 *:!text-white !border-0",
        description: "Please connect your wallet first",
        duration: 5000,
      });
      return;
    }

    if (!sample) return;

    purchaseSample(sample.sample_id, {
      onSuccess: (data) => {
        // Refetch purchase status
        toast.success("Success", {
          className: "!bg-primary !border-0",
          description: "Sample purchased successfully!",
          duration: 5000,
          icon: <BsCheckCircleFill />,
          action: (
            <Link
              to={`https://testnet.cspr.live/transaction/${data?.transactionHash}`}
              target="_blank"
              className="underline font-semibold"
            >
              View on explorer
            </Link>
          ),
        });
        refetchPurchaseStatus();
        updateBalance();

        // Optionally auto-download after purchase
        if (sample.ipfs_link) {
          setTimeout(() => {
            downloadAudio(sample.ipfs_link, `${sample.title}.mp3`);
          }, 2000);
        }
      },
    });
  };

  return (
    <div className="pt-4 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="md:text-lg">Purchase</p>
        </div>
        {
          !balances[0]?.balance ? <span className="italics">Loading balance...</span> : <p>
          <span className="text-grey-300">Balance:</span>{" "}
          {Number(Number(balances[0]?.balance).toFixed(3)).toLocaleString()} CSPR
        </p>
        }
      </div>

      <div className="flex gap-2 items-center">
        <Avatar src="/assets/images/casper-logo.png" />
        <p className="text-lg md:text-xl">
          Price: {motesToCspr(sample?.price)} CSPR
        </p>
        {isSeller ? (
          <p className="bg-primary p-1 px-2 text-xs rounded-full text-black">
            Seller
          </p>
        ) : hasPurchased ? (
          <p className="bg-primary p-1 px-2 text-xs rounded-full text-black">
            Purchased
          </p>
        ) : (
          <></>
        )}
      </div>
      {!hasPurchased && !isSeller ? (
        <div className="space-y-2">
          <Button
            className={` w-full !h-[45px]`}
            type="primary"
            size="large"
            loading={isPurchasing}
            onClick={handlePurchase}
          >
            Buy sample
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            className={` w-full !h-[45px]`}
            type="primary"
            size="large"
            onClick={() =>
              downloadAudio(sample?.ipfs_link, `${sample?.title}.mp3`)
            }
          >
            Download sample
          </Button>
        </div>
      )}
    </div>
  );
};
