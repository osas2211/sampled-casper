import { Radio, Card, Tag, Tooltip } from "antd"
import {
  UserOutlined,
  DollarOutlined,
  WifiOutlined,
  CrownOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons"
import {
  LicenseType,
  LICENSE_TYPE_INFO,
  IAllLicensePrices,
} from "../../@types/license"
import { motesToCspr } from "../../hooks/useSampledContract"

interface LicenseSelectorProps {
  prices: IAllLicensePrices
  selectedLicense: LicenseType
  onSelect: (licenseType: LicenseType) => void
  isExclusivelyLicensed?: boolean
  disabled?: boolean
}

const LICENSE_ICONS = {
  [LicenseType.Personal]: <UserOutlined />,
  [LicenseType.Commercial]: <DollarOutlined />,
  [LicenseType.Broadcast]: <WifiOutlined />,
  [LicenseType.Exclusive]: <CrownOutlined />,
}

export const LicenseSelector = ({
  prices,
  selectedLicense,
  onSelect,
  isExclusivelyLicensed = false,
  disabled = false,
}: LicenseSelectorProps) => {
  const licenseTypes = [
    { type: LicenseType.Personal, price: prices.personal },
    { type: LicenseType.Commercial, price: prices.commercial },
    { type: LicenseType.Broadcast, price: prices.broadcast },
    { type: LicenseType.Exclusive, price: prices.exclusive },
  ]

  const formatPrice = (priceInMotes: string) => {
    const cspr = motesToCspr(priceInMotes)
    return cspr.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-white font-medium">Select License Type</span>
        <Tooltip title="Different licenses grant different usage rights. Choose the one that fits your needs.">
          <InfoCircleOutlined className="text-gray-400 cursor-help" />
        </Tooltip>
      </div>

      <Radio.Group
        value={selectedLicense}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full"
        disabled={disabled}
      >
        <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
          {licenseTypes.map(({ type, price }) => {
            const info = LICENSE_TYPE_INFO[type]
            const isSelected = selectedLicense === type
            const isDisabled =
              disabled ||
              (isExclusivelyLicensed && type !== LicenseType.Exclusive) ||
              (type === LicenseType.Exclusive && isExclusivelyLicensed)

            return (
              <Radio.Button
                key={type}
                value={type}
                disabled={isDisabled}
                className="!h-auto !p-0 !border-0"
                style={{ background: "transparent" }}
              >
                <Card
                  className={`
                    cursor-pointer transition-all duration-200
                    ${isSelected ? "!border-primary !bg-primary/10" : "!border-gray-700 !bg-gray-800/50"}
                    ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:!border-gray-500"}
                  `}
                  bodyStyle={{ padding: "16px" }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                        style={{ backgroundColor: `${info.color}20`, color: info.color }}
                      >
                        {LICENSE_ICONS[type]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{info.name}</span>
                          {type === LicenseType.Exclusive && isExclusivelyLicensed && (
                            <Tag color="red">Sold</Tag>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs mt-1">{info.shortDescription}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">{formatPrice(price)} CSPR</div>
                      {type === LicenseType.Personal && (
                        <span className="text-xs text-green-400">Base Price</span>
                      )}
                      {type === LicenseType.Commercial && (
                        <span className="text-xs text-blue-400">2.5x</span>
                      )}
                      {type === LicenseType.Broadcast && (
                        <span className="text-xs text-purple-400">5x</span>
                      )}
                      {type === LicenseType.Exclusive && (
                        <span className="text-xs text-orange-400">20x</span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-gray-300 text-sm">{info.description}</p>
                    </div>
                  )}
                </Card>
              </Radio.Button>
            )
          })}
        </div>
      </Radio.Group>

      {isExclusivelyLicensed && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">
            This sample has been exclusively licensed and is no longer available for purchase.
          </p>
        </div>
      )}
    </div>
  )
}

export default LicenseSelector
