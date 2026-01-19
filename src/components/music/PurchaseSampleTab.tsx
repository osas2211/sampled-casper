/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises */

import { useState } from "react";
import { Avatar, Button, Divider } from "antd";
import { useWalletBalance } from "../../hooks/useWalletBalance";

import {
  getAccountHashFromPublicKey,
  motesToCspr,
  useHasPurchased,
  usePurchaseSampleLicense,
  getAllLicensePrices,
  calculateLicensePrice,
} from "../../hooks/useSampledContract";
import { downloadAudio } from "../../util/download-audio";
import { toast } from "sonner";
import { BsCheckCircleFill } from "react-icons/bs";
import { Link } from "react-router-dom";
import { ISample } from "../../@types/sample"
import { useCasperWallet } from "../../providers/WalletProvider"
import { LicenseType } from "../../@types/license"
import { LicenseSelectorModal } from "../license/LicenseSelectorModal"

export const PurchaseSampleTab = ({ sample }: { sample: ISample }) => {
  const { balances, updateBalance } = useWalletBalance();
  const { data: hasPurchased, refetch: refetchPurchaseStatus } =
    useHasPurchased(sample?.sample_id);
  const { mutate: purchaseLicense, isPending: isPurchasing } =
    usePurchaseSampleLicense();
  const { account } = useCasperWallet();
  const userAccountHash = getAccountHashFromPublicKey(account?.address!!)
  const address = account?.address
  const isSeller = userAccountHash === sample?.seller;

  // License selection state
  const [selectedLicense, setSelectedLicense] = useState<LicenseType>(LicenseType.Personal);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Calculate all license prices
  const licensePrices = getAllLicensePrices(sample?.price || "0");

  // Get the selected license price
  const selectedPrice = calculateLicensePrice(sample?.price || "0", selectedLicense);

  // TODO: Check if sample is exclusively licensed (will need contract query)
  const isExclusivelyLicensed = !sample?.is_active && sample?.total_sales !== "0";

  const handlePurchase = async () => {
    if (!address) {
      toast.error("Error", {
        className: "!bg-red-500 *:!text-white !border-0",
        description: "Please connect your wallet first",
        duration: 5000,
      });
      return;
    }

    if (!sample) return;

    const sampleId = parseInt(sample.sample_id, 10);

    purchaseLicense(
      { sample_id: sampleId, license_type: selectedLicense },
      {
        onSuccess: (data) => {
          const licenseTypeName = ["Personal", "Commercial", "Broadcast", "Exclusive"][data.license_type];
          setIsModalOpen(false);
          toast.success("Success", {
            className: "!bg-primary !border-0",
            description: `${licenseTypeName} license purchased successfully!`,
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

          // Auto-download after purchase
          if (sample.ipfs_link) {
            setTimeout(() => {
              downloadAudio(sample.ipfs_link, `${sample.title}.mp3`);
            }, 2000);
          }
        },
      }
    );
  };

  return (
    <div className="pt-4 space-y-4 md:space-y-6">
      {/* Balance display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="md:text-lg font-medium">Purchase License</p>
        </div>
        {!balances[0]?.balance ? (
          <span className="italics text-gray-400">Loading balance...</span>
        ) : (
          <p>
            <span className="text-grey-300">Balance:</span>{" "}
            {Number(Number(balances[0]?.balance).toFixed(3)).toLocaleString()} CSPR
          </p>
        )}
      </div>

      {/* Base price info */}
      <div className="flex gap-2 items-center">
        <Avatar src="/assets/images/casper-logo.png" />
        <p className="text-sm text-gray-400">
          Base Price: {motesToCspr(sample?.price)} CSPR
        </p>
        {isSeller && (
          <p className="bg-primary p-1 px-2 text-xs rounded-full text-black">
            Your Sample
          </p>
        )}
        {hasPurchased && (
          <p className="bg-green-500 p-1 px-2 text-xs rounded-full text-white">
            Licensed
          </p>
        )}
      </div>

      <Divider className="!my-4 !border-gray-700" />

      {/* License purchase or download button */}
      {!hasPurchased && !isSeller ? (
        <div className="space-y-4">
          {/* License price range */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            <h4 className="text-white font-medium">Available Licenses</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Personal</span>
                <span className="text-white">{motesToCspr(licensePrices.personal)} CSPR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Commercial</span>
                <span className="text-white">{motesToCspr(licensePrices.commercial)} CSPR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Broadcast</span>
                <span className="text-white">{motesToCspr(licensePrices.broadcast)} CSPR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Exclusive</span>
                <span className="text-white">{motesToCspr(licensePrices.exclusive)} CSPR</span>
              </div>
            </div>
          </div>

          {isExclusivelyLicensed ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">
                This sample has been exclusively licensed and is no longer available for purchase.
              </p>
            </div>
          ) : (
            <Button
              className="w-full !h-[50px] !text-lg"
              type="primary"
              size="large"
              onClick={() => setIsModalOpen(true)}
            >
              Buy License
            </Button>
          )}

          <p className="text-center text-xs text-gray-500">
            Choose from Personal, Commercial, Broadcast, or Exclusive licenses.
          </p>

          {/* License selector modal */}
          <LicenseSelectorModal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onPurchase={handlePurchase}
            prices={licensePrices}
            selectedLicense={selectedLicense}
            onSelectLicense={setSelectedLicense}
            selectedPrice={selectedPrice}
            isExclusivelyLicensed={isExclusivelyLicensed}
            isPurchasing={isPurchasing}
            sampleTitle={sample?.title}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {hasPurchased && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400 text-sm">
                You own a license for this sample. Download your file below.
              </p>
            </div>
          )}

          <Button
            className="w-full !h-[50px] !text-lg"
            type="primary"
            size="large"
            onClick={() =>
              downloadAudio(sample?.ipfs_link, `${sample?.title}.mp3`)
            }
          >
            Download Sample
          </Button>

          {isSeller && (
            <p className="text-center text-xs text-gray-500">
              This is your sample. You can download it anytime.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
