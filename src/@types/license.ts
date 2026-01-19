/**
 * License types for the NFT License System
 */

/**
 * License type enum matching the smart contract
 */
export enum LicenseType {
  Personal = 0,    // Non-commercial use only
  Commercial = 1,  // Commercial releases
  Broadcast = 2,   // TV, radio, streaming, ads
  Exclusive = 3,   // Exclusive rights
}

/**
 * License type metadata for UI display
 */
export interface ILicenseTypeInfo {
  type: LicenseType
  name: string
  description: string
  shortDescription: string
  icon: string
  color: string
}

/**
 * All license type information for UI
 */
export const LICENSE_TYPE_INFO: Record<LicenseType, ILicenseTypeInfo> = {
  [LicenseType.Personal]: {
    type: LicenseType.Personal,
    name: 'Personal',
    description: 'Non-commercial use only. Perfect for demos, personal projects, and learning.',
    shortDescription: 'Non-commercial use',
    icon: 'user',
    color: '#4CAF50',
  },
  [LicenseType.Commercial]: {
    type: LicenseType.Commercial,
    name: 'Commercial',
    description: 'Use in commercial releases. Keep 100% of your royalties from sales.',
    shortDescription: 'Commercial releases',
    icon: 'dollar-sign',
    color: '#2196F3',
  },
  [LicenseType.Broadcast]: {
    type: LicenseType.Broadcast,
    name: 'Broadcast',
    description: 'Licensed for TV, radio, streaming platforms, and advertisements.',
    shortDescription: 'TV, radio, streaming, ads',
    icon: 'radio',
    color: '#9C27B0',
  },
  [LicenseType.Exclusive]: {
    type: LicenseType.Exclusive,
    name: 'Exclusive',
    description: 'Exclusive rights to this sample. Sample will be removed from marketplace.',
    shortDescription: 'Full exclusive rights',
    icon: 'crown',
    color: '#FF9800',
  },
}

/**
 * Pricing multipliers for each license type
 */
export interface ILicensePricing {
  personal_multiplier: string
  commercial_multiplier: string
  broadcast_multiplier: string
  exclusive_multiplier: string
}

/**
 * Default pricing multipliers (100 = 1x)
 */
export const DEFAULT_LICENSE_PRICING: ILicensePricing = {
  personal_multiplier: '100',    // 1x
  commercial_multiplier: '250',  // 2.5x
  broadcast_multiplier: '500',   // 5x
  exclusive_multiplier: '2000',  // 20x
}

/**
 * All license prices for a sample
 */
export interface IAllLicensePrices {
  personal: string
  commercial: string
  broadcast: string
  exclusive: string
}

/**
 * License NFT metadata from the contract
 */
export interface ILicenseMetadata {
  license_id: string
  sample_id: string
  license_type: LicenseType
  original_creator: string
  current_owner: string
  purchase_price: string
  purchase_timestamp: string
  is_active: boolean
  transfer_count: string
}

/**
 * Extended license info with sample details for UI
 */
export interface ILicenseNFT extends ILicenseMetadata {
  // Sample info for display
  sample_title?: string
  sample_cover_image?: string
  sample_genre?: string
  sample_ipfs_link?: string
}

/**
 * License info summary for a sample
 */
export interface ISampleLicenseInfo {
  total_licenses: string
  personal_count: string
  commercial_count: string
  broadcast_count: string
  has_exclusive: boolean
  exclusive_holder?: string
}

/**
 * Payload for purchasing a license
 */
export interface IPurchaseLicensePayload {
  sample_id: number
  license_type: LicenseType
}

/**
 * Payload for transferring a license
 */
export interface ITransferLicensePayload {
  license_id: number
  to: string
  sale_price: bigint
}

/**
 * Royalty payment record
 */
export interface IRoyaltyPayment {
  license_id: string
  from: string
  to: string
  sale_price: string
  creator_royalty: string
  platform_fee: string
  creator: string
  timestamp: string
}

/**
 * Helper to get license type from number
 */
export function getLicenseType(value: number): LicenseType {
  if (value >= 0 && value <= 3) {
    return value as LicenseType
  }
  return LicenseType.Personal
}

/**
 * Helper to get license type info
 */
export function getLicenseTypeInfo(type: LicenseType): ILicenseTypeInfo {
  return LICENSE_TYPE_INFO[type]
}

/**
 * Calculate license price from base price and multiplier
 */
export function calculateLicensePrice(
  basePrice: bigint,
  multiplier: string
): bigint {
  return (basePrice * BigInt(multiplier)) / 100n
}

/**
 * Format license price for display
 */
export function formatLicensePrice(priceInMotes: string): string {
  const cspr = Number(priceInMotes) / 1_000_000_000
  return cspr.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

/**
 * Constants for royalties
 */
export const LICENSE_CONSTANTS = {
  CREATOR_ROYALTY_PERCENT: 10,
  PLATFORM_FEE_PERCENT: 2,
  MULTIPLIER_DENOMINATOR: 100,
}
