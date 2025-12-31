/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-unused-vars */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ISample, IUploadSamplePayload } from "../@types/sample"
import { toast } from "sonner"
import { IoCloseCircleSharp } from "react-icons/io5"
import { useCasperWallet } from "../providers/WalletProvider"
import {
  CasperClient,
  CasperServiceByJsonRPC,
  CLPublicKey,
  CLValueBuilder,
  DeployUtil,
  RuntimeArgs,
  CLString,
  CLU64,
  CLU512,
} from "casper-js-sdk"

// Casper Network Configuration
const CASPER_RPC_URL = import.meta.env.VITE_CASPER_RPC_URL || "https://rpc.testnet.casperlabs.io/rpc"
const CHAIN_NAME = import.meta.env.VITE_CASPER_CHAIN_NAME || "casper-test"
const CONTRACT_HASH = import.meta.env.VITE_CONTRACT_HASH || ""
const CONTRACT_PACKAGE_HASH = import.meta.env.VITE_CONTRACT_PACKAGE_HASH || ""

// Initialize Casper client
const casperClient = new CasperClient(CASPER_RPC_URL)
const casperService = new CasperServiceByJsonRPC(CASPER_RPC_URL)

// Gas costs (in motes - 1 CSPR = 10^9 motes)
const GAS_UPLOAD_SAMPLE = "5000000000" // 5 CSPR
const GAS_PURCHASE_SAMPLE = "10000000000" // 10 CSPR
const GAS_UPDATE_PRICE = "2000000000" // 2 CSPR
const GAS_WITHDRAW = "3000000000" // 3 CSPR
const GAS_DEACTIVATE = "2000000000" // 2 CSPR

export interface IPurchaseSamplePayload {
  buyer: string
  sample_id: number
}

export interface IPurchaseSampleResponse {
  transactionHash: string
  sample_id: string
}

/** Convert motes (smallest unit) to CSPR tokens (1 CSPR = 1,000,000,000 motes) */
export const motesToCspr = (motes: bigint | string | number): number => {
  const amount = typeof motes === "bigint" ? motes : BigInt(motes || 0)
  return Number(amount) / 1_000_000_000
}

/** Convert CSPR to motes */
export const csprToMotes = (cspr: number): bigint => {
  return BigInt(Math.floor(cspr * 1_000_000_000))
}

/** Helper to create a deploy for contract calls */
const createContractDeploy = (
  publicKey: CLPublicKey,
  entryPoint: string,
  args: RuntimeArgs,
  paymentAmount: string
): DeployUtil.Deploy => {
  const contractHashBytes = Uint8Array.from(
    Buffer.from(CONTRACT_HASH.replace("hash-", ""), "hex")
  )

  const deployParams = new DeployUtil.DeployParams(publicKey, CHAIN_NAME)
  const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
    contractHashBytes,
    entryPoint,
    args
  )
  const payment = DeployUtil.standardPayment(paymentAmount)

  return DeployUtil.makeDeploy(deployParams, session, payment)
}

/** Helper to wait for deploy execution */
const waitForDeploy = async (deployHash: string, timeout = 120000): Promise<void> => {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const result = await casperService.getDeployInfo(deployHash)
      if (result.execution_results && result.execution_results.length > 0) {
        const execResult = result.execution_results[0].result
        if ("Success" in execResult) {
          return
        } else if ("Failure" in execResult) {
          throw new Error(`Deploy failed: ${execResult.Failure.error_message}`)
        }
      }
    } catch (error) {
      // Deploy not found yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error("Deploy execution timeout")
}

/** Helper to query contract state */
const queryContractState = async <T>(
  stateRootHash: string,
  key: string,
  path: string[]
): Promise<T | null> => {
  try {
    const result = await casperService.getBlockState(stateRootHash, key, path)
    return result.CLValue?.data as T
  } catch (error) {
    console.error("Error querying contract state:", error)
    return null
  }
}

/** Get the latest state root hash */
const getStateRootHash = async (): Promise<string> => {
  const latestBlock = await casperService.getLatestBlockInfo()
  return latestBlock.block?.header.state_root_hash || ""
}

export const useUploadSample = () => {
  const { account, signDeploy } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: IUploadSamplePayload) => {
      if (!account) {
        throw new Error("Wallet not connected")
      }

      // Convert price to motes (assuming input is in CSPR)
      const priceInMotes = csprToMotes(Number(request.price))

      // Build runtime args
      const args = RuntimeArgs.fromMap({
        price: CLValueBuilder.u512(priceInMotes.toString()),
        ipfs_link: CLValueBuilder.string(request.ipfs_link),
        title: CLValueBuilder.string(request.title),
        bpm: CLValueBuilder.u64(request.bpm),
        genre: CLValueBuilder.string(request.genre),
        cover_image: CLValueBuilder.string(request.cover_image),
        video_preview_link: CLValueBuilder.string(request.video_preview_link || ""),
      })

      // Create deploy
      const deploy = createContractDeploy(
        account.publicKey,
        "upload_sample",
        args,
        GAS_UPLOAD_SAMPLE
      )

      // Sign deploy
      const deployJson = DeployUtil.deployToJson(deploy)
      const signedDeployJson = await signDeploy(JSON.stringify(deployJson))
      const signedDeploy = DeployUtil.deployFromJson(JSON.parse(signedDeployJson)).unwrap()

      // Submit deploy
      const deployHash = await casperClient.putDeploy(signedDeploy)

      // Wait for execution
      await waitForDeploy(deployHash)

      return { hash: deployHash }
    },

    onSuccess(data) {
      console.log("Upload successful:", data)
      queryClient.invalidateQueries({
        queryKey: ["user-samples", account?.address],
      })
      queryClient.invalidateQueries({
        queryKey: ["all-samples"],
      })
    },
    onError: (error: Error) => {
      console.log(error)
      toast.error("Error", {
        className: "!bg-red-500 *:!text-white !border-0",
        description: error.message || "Failed to upload sample",
        duration: 5000,
        icon: IoCloseCircleSharp({ size: 24 }),
      })
    },
  })
}

export const useGetUserSamples = () => {
  const { account } = useCasperWallet()

  return useQuery({
    queryFn: async (): Promise<ISample[]> => {
      if (!account) return []

      try {
        const stateRootHash = await getStateRootHash()
        // Query user's uploaded samples from contract state
        // Note: Actual implementation depends on how the contract stores this data
        const samples = await queryContractState<ISample[]>(
          stateRootHash,
          `hash-${CONTRACT_HASH}`,
          ["user_uploaded_samples", account.address]
        )

        console.log("Get user samples for:", account.address)
        return samples || []
      } catch (error) {
        console.error("Error fetching user samples:", error)
        return []
      }
    },
    queryKey: ["user-samples", account?.address],
    enabled: !!account,
  })
}

export const useGetAllSamples = () => {
  return useQuery({
    queryFn: async (): Promise<ISample[]> => {
      try {
        const stateRootHash = await getStateRootHash()
        // Query all samples from contract state
        // Note: This might need pagination for large datasets
        const samples = await queryContractState<ISample[]>(
          stateRootHash,
          `hash-${CONTRACT_HASH}`,
          ["samples"]
        )

        console.log("Get all samples")
        return samples || []
      } catch (error) {
        console.error("Error fetching all samples:", error)
        return []
      }
    },
    queryKey: ["all-samples"],
  })
}

export const useGetSample = (sample_id: string) => {
  return useQuery({
    queryFn: async (): Promise<ISample | null> => {
      try {
        const stateRootHash = await getStateRootHash()
        const sample = await queryContractState<ISample>(
          stateRootHash,
          `hash-${CONTRACT_HASH}`,
          ["samples", sample_id]
        )

        console.log("Get sample:", sample_id)
        return sample
      } catch (error) {
        console.error("Error fetching sample:", error)
        return null
      }
    },
    queryKey: ["single-sample", sample_id],
    enabled: !!sample_id,
  })
}

export const usePurchaseSample = () => {
  const { account, signDeploy } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sampleId: string): Promise<IPurchaseSampleResponse> => {
      if (!account) {
        throw new Error("Please connect your wallet first")
      }

      // First, get the sample to know the price
      const stateRootHash = await getStateRootHash()
      const sample = await queryContractState<ISample>(
        stateRootHash,
        `hash-${CONTRACT_HASH}`,
        ["samples", sampleId]
      )

      if (!sample) {
        throw new Error("Sample not found")
      }

      // Build runtime args with payment
      const args = RuntimeArgs.fromMap({
        sample_id: CLValueBuilder.u64(parseInt(sampleId)),
        amount: CLValueBuilder.u512(sample.price), // Include payment amount
      })

      // Create deploy (payment includes the sample price + gas)
      const totalPayment = BigInt(sample.price) + BigInt(GAS_PURCHASE_SAMPLE)
      const deploy = createContractDeploy(
        account.publicKey,
        "purchase_sample",
        args,
        totalPayment.toString()
      )

      // Sign deploy
      const deployJson = DeployUtil.deployToJson(deploy)
      const signedDeployJson = await signDeploy(JSON.stringify(deployJson))
      const signedDeploy = DeployUtil.deployFromJson(JSON.parse(signedDeployJson)).unwrap()

      // Submit deploy
      const deployHash = await casperClient.putDeploy(signedDeploy)

      // Wait for execution
      await waitForDeploy(deployHash)

      return {
        transactionHash: deployHash,
        sample_id: sampleId,
      }
    },
    onSuccess: (data) => {
      console.log("Purchase successful:", data)

      queryClient.invalidateQueries({ queryKey: ["user-purchases", account?.address] })
      queryClient.invalidateQueries({ queryKey: ["user-earnings", account?.address] })
      queryClient.invalidateQueries({
        queryKey: ["single-sample", data.sample_id],
      })
    },
    onError: (error: Error) => {
      console.log(error)
      toast.error("Error", {
        className: "!bg-red-500 *:!text-white !border-0",
        description: error.message || "Failed to purchase sample",
        duration: 5000,
        icon: IoCloseCircleSharp({ size: 24 }),
      })
    },
  })
}

export const useHasPurchased = (sampleId: string) => {
  const { account } = useCasperWallet()

  return useQuery({
    queryKey: ["hasPurchased", account?.address, sampleId],
    queryFn: async (): Promise<boolean> => {
      if (!account?.address || !sampleId) return false

      try {
        const stateRootHash = await getStateRootHash()
        const purchaseRecord = await queryContractState(
          stateRootHash,
          `hash-${CONTRACT_HASH}`,
          ["user_purchase_records", account.address, sampleId]
        )

        return purchaseRecord !== null
      } catch (error) {
        console.error("Error checking purchase status:", error)
        return false
      }
    },
    enabled: !!account?.address && !!sampleId,
  })
}

export const useGetUserPurchases = () => {
  const { account } = useCasperWallet()

  return useQuery({
    queryFn: async (): Promise<ISample[]> => {
      if (!account?.address) return []

      try {
        const stateRootHash = await getStateRootHash()
        const samples = await queryContractState<ISample[]>(
          stateRootHash,
          `hash-${CONTRACT_HASH}`,
          ["user_purchased_samples", account.address]
        )

        console.log("Get user purchases for:", account.address)
        return samples || []
      } catch (error) {
        console.error("Error fetching user purchases:", error)
        return []
      }
    },
    queryKey: ["user-purchases", account?.address],
    enabled: !!account?.address,
  })
}

export const useGetStats = () => {
  return useQuery({
    queryFn: async () => {
      try {
        const stateRootHash = await getStateRootHash()
        const stats = await queryContractState(
          stateRootHash,
          `hash-${CONTRACT_HASH}`,
          ["marketplace_stats"]
        )

        console.log("Get stats")
        return stats
      } catch (error) {
        console.error("Error fetching stats:", error)
        return null
      }
    },
    queryKey: ["stats"],
  })
}

export const useGetUserEarnings = () => {
  const { account } = useCasperWallet()

  return useQuery({
    queryFn: async (): Promise<number> => {
      if (!account?.address) return 0

      try {
        const stateRootHash = await getStateRootHash()
        const earnings = await queryContractState<string>(
          stateRootHash,
          `hash-${CONTRACT_HASH}`,
          ["user_earnings", account.address]
        )

        console.log("Get user earnings for:", account.address)
        return earnings ? motesToCspr(BigInt(earnings)) : 0
      } catch (error) {
        console.error("Error fetching user earnings:", error)
        return 0
      }
    },
    queryKey: ["user-earnings", account?.address],
    enabled: !!account?.address,
  })
}

export const useWithdrawEarnings = () => {
  const { account, signDeploy } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!account?.address) {
        throw new Error("Please connect your wallet first")
      }

      // Build runtime args (no args needed for withdraw)
      const args = RuntimeArgs.fromMap({})

      // Create deploy
      const deploy = createContractDeploy(
        account.publicKey,
        "withdraw_earnings",
        args,
        GAS_WITHDRAW
      )

      // Sign deploy
      const deployJson = DeployUtil.deployToJson(deploy)
      const signedDeployJson = await signDeploy(JSON.stringify(deployJson))
      const signedDeploy = DeployUtil.deployFromJson(JSON.parse(signedDeployJson)).unwrap()

      // Submit deploy
      const deployHash = await casperClient.putDeploy(signedDeploy)

      // Wait for execution
      await waitForDeploy(deployHash)

      return { hash: deployHash }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-earnings", account?.address] })
    },
    onError: (error: Error) => {
      toast.error("Error", {
        className: "!bg-red-500 *:!text-white !border-0",
        description: error.message || "Failed to withdraw earnings",
        duration: 5000,
        icon: IoCloseCircleSharp({ size: 24 }),
      })
    },
  })
}

export const useUpdatePrice = () => {
  const { account, signDeploy } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ sampleId, newPrice }: { sampleId: string; newPrice: number }) => {
      if (!account?.address) {
        throw new Error("Please connect your wallet first")
      }

      const priceInMotes = csprToMotes(newPrice)

      const args = RuntimeArgs.fromMap({
        sample_id: CLValueBuilder.u64(parseInt(sampleId)),
        new_price: CLValueBuilder.u512(priceInMotes.toString()),
      })

      const deploy = createContractDeploy(
        account.publicKey,
        "update_price",
        args,
        GAS_UPDATE_PRICE
      )

      const deployJson = DeployUtil.deployToJson(deploy)
      const signedDeployJson = await signDeploy(JSON.stringify(deployJson))
      const signedDeploy = DeployUtil.deployFromJson(JSON.parse(signedDeployJson)).unwrap()

      const deployHash = await casperClient.putDeploy(signedDeploy)
      await waitForDeploy(deployHash)

      return { hash: deployHash, sampleId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["single-sample", data.sampleId] })
      queryClient.invalidateQueries({ queryKey: ["user-samples", account?.address] })
    },
    onError: (error: Error) => {
      toast.error("Error", {
        className: "!bg-red-500 *:!text-white !border-0",
        description: error.message || "Failed to update price",
        duration: 5000,
        icon: IoCloseCircleSharp({ size: 24 }),
      })
    },
  })
}

export const useDeactivateSample = () => {
  const { account, signDeploy } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sampleId: string) => {
      if (!account?.address) {
        throw new Error("Please connect your wallet first")
      }

      const args = RuntimeArgs.fromMap({
        sample_id: CLValueBuilder.u64(parseInt(sampleId)),
      })

      const deploy = createContractDeploy(
        account.publicKey,
        "deactivate_sample",
        args,
        GAS_DEACTIVATE
      )

      const deployJson = DeployUtil.deployToJson(deploy)
      const signedDeployJson = await signDeploy(JSON.stringify(deployJson))
      const signedDeploy = DeployUtil.deployFromJson(JSON.parse(signedDeployJson)).unwrap()

      const deployHash = await casperClient.putDeploy(signedDeploy)
      await waitForDeploy(deployHash)

      return { hash: deployHash, sampleId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["single-sample", data.sampleId] })
      queryClient.invalidateQueries({ queryKey: ["user-samples", account?.address] })
      queryClient.invalidateQueries({ queryKey: ["all-samples"] })
    },
    onError: (error: Error) => {
      toast.error("Error", {
        className: "!bg-red-500 *:!text-white !border-0",
        description: error.message || "Failed to deactivate sample",
        duration: 5000,
        icon: IoCloseCircleSharp({ size: 24 }),
      })
    },
  })
}
