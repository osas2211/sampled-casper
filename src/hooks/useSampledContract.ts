/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-unused-vars */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ISample, IUploadSamplePayload } from "../@types/sample"
import { toast } from "sonner"
import { IoCloseCircleSharp } from "react-icons/io5"
import { useCasperWallet } from "../providers/WalletProvider"

// Casper Network Configuration
const CASPER_RPC_URL = import.meta.env.VITE_CASPER_RPC_URL || "https://rpc.testnet.casperlabs.io/rpc"
const CHAIN_NAME = import.meta.env.VITE_CASPER_CHAIN_NAME || "casper-test"
const CONTRACT_HASH = import.meta.env.VITE_CONTRACT_HASH || ""

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

// Helper for JSON-RPC calls
async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(CASPER_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message || "RPC Error")
  }
  return data.result
}

/** Helper to wait for deploy execution */
const waitForDeploy = async (deployHash: string, timeout = 120000): Promise<void> => {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      interface DeployInfo {
        deploy: unknown
        execution_results: Array<{
          result: {
            Success?: unknown
            Failure?: { error_message: string }
          }
        }>
      }

      const result = await rpcCall<DeployInfo>("info_get_deploy", [deployHash])

      if (result.execution_results && result.execution_results.length > 0) {
        const execResult = result.execution_results[0].result
        if (execResult.Success) {
          return
        } else if (execResult.Failure) {
          throw new Error(`Deploy failed: ${execResult.Failure.error_message}`)
        }
      }
    } catch (error) {
      // Deploy not found yet, continue waiting
      if ((error as Error).message?.includes("Deploy failed")) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error("Deploy execution timeout")
}

/** Helper to query contract state */
const queryContractState = async <T>(
  contractHash: string,
  key: string
): Promise<T | null> => {
  try {
    interface StateResult {
      stored_value: {
        CLValue?: { parsed: T }
      }
    }

    const result = await rpcCall<StateResult>("state_get_item", [
      null, // state_root_hash (null for latest)
      `hash-${contractHash}`,
      [key],
    ])

    return result.stored_value.CLValue?.parsed ?? null
  } catch (error) {
    console.error("Error querying contract state:", error)
    return null
  }
}

export const useUploadSample = () => {
  const { account, signDeploy } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: IUploadSamplePayload) => {
      if (!account) {
        throw new Error("Wallet not connected")
      }

      // For now, return a placeholder - actual implementation requires
      // building and signing a deploy with the Casper SDK
      // This will be functional once the contract is deployed
      throw new Error("Contract not yet deployed. Please deploy the contract first and update VITE_CONTRACT_HASH in .env")
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
      if (!account || !CONTRACT_HASH) return []

      try {
        // Query user's uploaded samples from contract state
        const samples = await queryContractState<ISample[]>(
          CONTRACT_HASH,
          `user_uploaded_samples_${account.address}`
        )

        console.log("Get user samples for:", account.address)
        return samples || []
      } catch (error) {
        console.error("Error fetching user samples:", error)
        return []
      }
    },
    queryKey: ["user-samples", account?.address],
    enabled: !!account && !!CONTRACT_HASH,
  })
}

export const useGetAllSamples = () => {
  return useQuery({
    queryFn: async (): Promise<ISample[]> => {
      if (!CONTRACT_HASH) return []

      try {
        // Query all samples from contract state
        const samples = await queryContractState<ISample[]>(
          CONTRACT_HASH,
          "samples"
        )

        console.log("Get all samples")
        return samples || []
      } catch (error) {
        console.error("Error fetching all samples:", error)
        return []
      }
    },
    queryKey: ["all-samples"],
    enabled: !!CONTRACT_HASH,
  })
}

export const useGetSample = (sample_id: string) => {
  return useQuery({
    queryFn: async (): Promise<ISample | null> => {
      if (!CONTRACT_HASH) return null

      try {
        const sample = await queryContractState<ISample>(
          CONTRACT_HASH,
          `sample_${sample_id}`
        )

        console.log("Get sample:", sample_id)
        return sample
      } catch (error) {
        console.error("Error fetching sample:", error)
        return null
      }
    },
    queryKey: ["single-sample", sample_id],
    enabled: !!sample_id && !!CONTRACT_HASH,
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

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update VITE_CONTRACT_HASH in .env")
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
      if (!account?.address || !sampleId || !CONTRACT_HASH) return false

      try {
        const purchaseRecord = await queryContractState(
          CONTRACT_HASH,
          `purchase_${account.address}_${sampleId}`
        )

        return purchaseRecord !== null
      } catch (error) {
        console.error("Error checking purchase status:", error)
        return false
      }
    },
    enabled: !!account?.address && !!sampleId && !!CONTRACT_HASH,
  })
}

export const useGetUserPurchases = () => {
  const { account } = useCasperWallet()

  return useQuery({
    queryFn: async (): Promise<ISample[]> => {
      if (!account?.address || !CONTRACT_HASH) return []

      try {
        const samples = await queryContractState<ISample[]>(
          CONTRACT_HASH,
          `user_purchased_samples_${account.address}`
        )

        console.log("Get user purchases for:", account.address)
        return samples || []
      } catch (error) {
        console.error("Error fetching user purchases:", error)
        return []
      }
    },
    queryKey: ["user-purchases", account?.address],
    enabled: !!account?.address && !!CONTRACT_HASH,
  })
}

export const useGetStats = () => {
  return useQuery({
    queryFn: async () => {
      if (!CONTRACT_HASH) return null

      try {
        const stats = await queryContractState(
          CONTRACT_HASH,
          "marketplace_stats"
        )

        console.log("Get stats")
        return stats
      } catch (error) {
        console.error("Error fetching stats:", error)
        return null
      }
    },
    queryKey: ["stats"],
    enabled: !!CONTRACT_HASH,
  })
}

export const useGetUserEarnings = () => {
  const { account } = useCasperWallet()

  return useQuery({
    queryFn: async (): Promise<number> => {
      if (!account?.address || !CONTRACT_HASH) return 0

      try {
        const earnings = await queryContractState<string>(
          CONTRACT_HASH,
          `user_earnings_${account.address}`
        )

        console.log("Get user earnings for:", account.address)
        return earnings ? motesToCspr(BigInt(earnings)) : 0
      } catch (error) {
        console.error("Error fetching user earnings:", error)
        return 0
      }
    },
    queryKey: ["user-earnings", account?.address],
    enabled: !!account?.address && !!CONTRACT_HASH,
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

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update VITE_CONTRACT_HASH in .env")
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
    // @ts-ignore
    mutationFn: async ({ sampleId, newPrice }: { sampleId: string; newPrice: number }) => {
      if (!account?.address) {
        throw new Error("Please connect your wallet first")
      }

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update VITE_CONTRACT_HASH in .env")
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["single-sample", (data as { sampleId: string }).sampleId] })
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

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update VITE_CONTRACT_HASH in .env")
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["single-sample", (data as { sampleId: string }).sampleId] })
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
