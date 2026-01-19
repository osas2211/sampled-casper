import { Modal, Button, Divider } from "antd"
import { LicenseType, LICENSE_TYPE_INFO, IAllLicensePrices } from "../../@types/license"
import { LicenseSelector } from "./LicenseSelector"
import { motesToCspr } from "../../hooks/useSampledContract"

interface LicenseSelectorModalProps {
  open: boolean
  onClose: () => void
  onPurchase: () => void
  prices: IAllLicensePrices
  selectedLicense: LicenseType
  onSelectLicense: (licenseType: LicenseType) => void
  selectedPrice: string
  isExclusivelyLicensed?: boolean
  isPurchasing?: boolean
  sampleTitle?: string
}

export const LicenseSelectorModal = ({
  open,
  onClose,
  onPurchase,
  prices,
  selectedLicense,
  onSelectLicense,
  selectedPrice,
  isExclusivelyLicensed = false,
  isPurchasing = false,
  sampleTitle,
}: LicenseSelectorModalProps) => {
  const licenseInfo = LICENSE_TYPE_INFO[selectedLicense]

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div className="text-white">
          <span className="text-lg font-semibold">Purchase License</span>
          {sampleTitle && (
            <p className="text-sm text-gray-400 font-normal mt-1 truncate">
              {sampleTitle}
            </p>
          )}
        </div>
      }
      width={600}
      centered
      className="license-modal"
      styles={{
        content: {
          backgroundColor: "#1a1a1a",
          border: "1px solid #333",
        },
        header: {
          backgroundColor: "#1a1a1a",
          borderBottom: "1px solid #333",
        },
      }}
      closeIcon={<span className="text-gray-400 hover:text-white">&times;</span>}
    >
      <div className="py-4 space-y-6">
        <LicenseSelector
          prices={prices}
          selectedLicense={selectedLicense}
          onSelect={onSelectLicense}
          isExclusivelyLicensed={isExclusivelyLicensed}
          disabled={isPurchasing}
        />

        <Divider className="!my-4 !border-gray-700" />

        {/* Purchase summary */}
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
          <h4 className="text-white font-medium mb-3">Order Summary</h4>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">License Type</span>
            <span className="text-white font-medium flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: licenseInfo.color }}
              />
              {licenseInfo.name}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Usage Rights</span>
            <span className="text-gray-300 text-sm">{licenseInfo.shortDescription}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-400">Platform Fee (10%)</span>
            <span className="text-gray-300">
              {motesToCspr(BigInt(selectedPrice) / 10n)} CSPR
            </span>
          </div>

          <Divider className="!my-2 !border-gray-700" />

          <div className="flex justify-between items-center">
            <span className="text-white font-semibold text-lg">Total</span>
            <span className="text-primary text-2xl font-bold">
              {motesToCspr(selectedPrice)} CSPR
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            className="flex-1 !h-[50px]"
            size="large"
            onClick={onClose}
            disabled={isPurchasing}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 !h-[50px] !text-lg"
            type="primary"
            size="large"
            loading={isPurchasing}
            onClick={onPurchase}
            disabled={isExclusivelyLicensed}
          >
            {isPurchasing ? "Processing..." : "Confirm Purchase"}
          </Button>
        </div>

        <p className="text-center text-xs text-gray-500">
          By purchasing, you agree to the license terms for {licenseInfo.name} usage.
        </p>
      </div>
    </Modal>
  )
}

export default LicenseSelectorModal
