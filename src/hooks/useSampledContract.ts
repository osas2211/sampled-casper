/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ISample, IUploadSamplePayload } from "../@types/sample"
import { toast } from "sonner"
import { IoCloseCircleSharp } from "react-icons/io5"
import { useCasperWallet } from "../providers/WalletProvider"
import {
  Deploy,
  DeployHeader,
  ExecutableDeployItem,
  StoredContractByHash,
  Args,
  PublicKey,
  CLValue,
  ContractHash,
  Duration,
  Timestamp,
} from "casper-js-sdk"

// Casper Network Configuration
const CASPER_RPC_URL = import.meta.env.PUBLIC_VITE_CASPER_RPC_URL || "https://node.testnet.cspr.cloud/rpc"
const CSPR_CLOUD_ACCESS_TOKEN = import.meta.env.PUBLIC_VITE_CSPR_CLOUD_ACCESS_TOKEN || ""
const CHAIN_NAME = import.meta.env.PUBLIC_VITE_CASPER_CHAIN_NAME || "casper-test"
const CONTRACT_HASH = import.meta.env.PUBLIC_VITE_CONTRACT_HASH || ""

// Gas costs (in motes - 1 CSPR = 10^9 motes)
const GAS_UPLOAD_SAMPLE = "10000000000" // 10 CSPR

// Default TTL for deploys (30 minutes)
const DEFAULT_TTL = 1800000

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  // Add Authorization header for CSPR.cloud
  if (CSPR_CLOUD_ACCESS_TOKEN) {
    headers["Authorization"] = CSPR_CLOUD_ACCESS_TOKEN
  }

  const response = await fetch(CASPER_RPC_URL, {
    method: "POST",
    headers,
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

/** Helper to wait for deploy execution (supports both v1 and v2 response formats) */
const waitForDeploy = async (deployHash: string, timeout = 120000): Promise<void> => {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const result = await rpcCall<any>("info_get_deploy", [deployHash])

      // Check for v2 format (execution_info)
      if (result.execution_info?.execution_result) {
        const execResult = result.execution_info.execution_result
        if (execResult.Version2) {
          if (execResult.Version2.error_message === null) {
            return // Success
          } else if (execResult.Version2.error_message) {
            throw new Error(`Deploy failed: ${execResult.Version2.error_message}`)
          }
        }
        if (execResult.Success) {
          return
        } else if (execResult.Failure) {
          throw new Error(`Deploy failed: ${execResult.Failure.error_message}`)
        }
      }

      // Check for v1 format (execution_results array)
      if (result.execution_results && result.execution_results.length > 0) {
        const execResult = result.execution_results[0].result
        if (execResult.Success) {
          return
        } else if (execResult.Failure) {
          throw new Error(`Deploy failed: ${execResult.Failure.error_message}`)
        }
      }
    } catch (error) {
      if ((error as Error).message?.includes("Deploy failed")) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error("Deploy execution timeout")
}

/** Build a contract call deploy */
const buildContractCallDeploy = (
  publicKey: PublicKey,
  entryPoint: string,
  args: Args,
  paymentAmount: string
): Deploy => {
  // Create session with stored contract by hash
  const contractHash = ContractHash.newContract(CONTRACT_HASH)
  const storedContract = new StoredContractByHash(contractHash, entryPoint, args)
  const session = new ExecutableDeployItem()
  session.storedContractByHash = storedContract

  const payment = ExecutableDeployItem.standardPayment(paymentAmount)

  // Create deploy header
  const header = new DeployHeader(
    CHAIN_NAME,
    [], // dependencies
    1, // gasPrice
    new Timestamp(new Date()),
    new Duration(DEFAULT_TTL),
    publicKey
  )

  return Deploy.makeDeploy(header, payment, session)
}

/** Send a signed deploy to the network */
const sendDeploy = async (signedDeployJson: string): Promise<string> => {
  const signedDeploy = JSON.parse(signedDeployJson)

  const result = await rpcCall<{ deploy_hash: string }>("account_put_deploy", [
    { deploy: signedDeploy },
  ])

  return result.deploy_hash
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

/** Query contract dictionary item */
const queryContractDictionary = async <T>(
  dictionaryName: string,
  dictionaryItemKey: string
): Promise<T | null> => {
  try {
    const result = await rpcCall<any>("state_get_dictionary_item", [
      null,
      {
        ContractNamedKey: {
          key: `hash-${CONTRACT_HASH}`,
          dictionary_name: dictionaryName,
          dictionary_item_key: dictionaryItemKey,
        },
      },
    ])

    return result.stored_value?.CLValue?.parsed ?? null
  } catch (error) {
    console.error("Error querying contract dictionary:", error)
    return null
  }
}

/** Parse Odra Sample from raw contract data */
const parseSampleFromContract = (data: any): ISample | null => {
  if (!data) return null

  try {
    // Odra stores structs as arrays of tuples [["field1", value1], ["field2", value2], ...]
    if (Array.isArray(data)) {
      const obj: Record<string, any> = {}
      for (const [key, value] of data) {
        obj[key] = value
      }
      return {
        sample_id: String(obj.sample_id ?? "0"),
        seller: String(obj.seller?.Account || obj.seller || ""),
        price: String(obj.price ?? "0"),
        ipfs_link: String(obj.ipfs_link ?? ""),
        title: String(obj.title ?? ""),
        bpm: String(obj.bpm ?? "0"),
        genre: String(obj.genre ?? ""),
        cover_image: String(obj.cover_image ?? ""),
        video_preview_link: String(obj.video_preview_link ?? ""),
        total_sales: String(obj.total_sales ?? "0"),
        is_active: Boolean(obj.is_active),
        created_at: String(obj.created_at ?? "0"),
      }
    } else if (typeof data === "object") {
      return {
        sample_id: String(data.sample_id ?? "0"),
        seller: String(data.seller?.Account || data.seller || ""),
        price: String(data.price ?? "0"),
        ipfs_link: String(data.ipfs_link ?? ""),
        title: String(data.title ?? ""),
        bpm: String(data.bpm ?? "0"),
        genre: String(data.genre ?? ""),
        cover_image: String(data.cover_image ?? ""),
        video_preview_link: String(data.video_preview_link ?? ""),
        total_sales: String(data.total_sales ?? "0"),
        is_active: Boolean(data.is_active),
        created_at: String(data.created_at ?? "0"),
      }
    }
    return null
  } catch (error) {
    console.error("Error parsing sample:", error, data)
    return null
  }
}

/** Get the total sample count from the contract */
const getSampleCount = async (): Promise<number> => {
  try {
    const result = await rpcCall<any>("query_global_state", [
      null,
      `hash-${CONTRACT_HASH}`,
      ["sample_count"],
    ])

    const count = result?.stored_value?.CLValue?.parsed
    return typeof count === "number" ? count : parseInt(count || "0", 10)
  } catch (error) {
    console.error("Error getting sample count:", error)
    return 0
  }
}

/** Fetch all samples from the contract */
const fetchAllSamples = async (): Promise<ISample[]> => {
  const samples: ISample[] = []

  try {
    const count = await getSampleCount()
    console.log("Total sample count:", count)

    if (count === 0) return samples

    // Fetch each sample by ID (samples are 1-indexed)
    for (let id = 1; id <= count; id++) {
      try {
        const data = await queryContractDictionary<any>("samples", String(id))
        const sample = parseSampleFromContract(data)
        if (sample && sample.is_active) {
          samples.push(sample)
        }
      } catch (error) {
        console.error(`Error fetching sample ${id}:`, error)
      }
    }
  } catch (error) {
    console.error("Error fetching all samples:", error)
  }

  return samples
}

export const useUploadSample = () => {
  const { account, signDeploy } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: IUploadSamplePayload): Promise<{ deployHash: string }> => {
      if (!account) {
        throw new Error("Wallet not connected")
      }

      if (!CONTRACT_HASH) {
        throw new Error("Contract hash not configured. Please set PUBLIC_VITE_CONTRACT_HASH in .env")
      }

      // Build arguments for upload_sample entry point
      const args = Args.fromMap({
        price: CLValue.newCLUInt512(request.price.toString()),
        ipfs_link: CLValue.newCLString(request.ipfs_link),
        title: CLValue.newCLString(request.title),
        bpm: CLValue.newCLUint64(request.bpm),
        genre: CLValue.newCLString(request.genre),
        cover_image: CLValue.newCLString(request.cover_image),
        video_preview_link: CLValue.newCLString(request.video_preview_link || ""),
      })

      // Build the deploy
      const deploy = buildContractCallDeploy(
        account.publicKey,
        "upload_sample",
        args,
        GAS_UPLOAD_SAMPLE
      )

      // Convert deploy to JSON for signing
      const deployJson = JSON.stringify(Deploy.toJSON(deploy))

      // Sign the deploy using the wallet
      const signedDeployJson = await signDeploy(deployJson)

      // Send the signed deploy to the network
      const deployHash = await sendDeploy(signedDeployJson)

      console.log("Upload deploy submitted:", deployHash)

      // Wait for the deploy to be executed
      await waitForDeploy(deployHash)

      console.log("Upload deploy executed successfully:", deployHash)

      return { deployHash }
    },

    onSuccess(data) {
      console.log("Upload successful:", data)
      toast.success("Sample uploaded!", {
        description: "Your sample has been uploaded successfully.",
        duration: 5000,
      })
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
      if (!CONTRACT_HASH) {
        console.log("No contract hash configured")
        return []
      }

      try {
        console.log("Fetching all samples from contract:", CONTRACT_HASH)
        const samples = await fetchAllSamples()
        console.log("Fetched samples:", samples.length)
        return samples
      } catch (error) {
        console.error("Error fetching all samples:", error)
        return []
      }
    },
    queryKey: ["all-samples"],
    enabled: !!CONTRACT_HASH,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: 60000, // Refetch every minute
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
  const { account } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (_sampleId: string): Promise<IPurchaseSampleResponse> => {
      if (!account) {
        throw new Error("Please connect your wallet first")
      }

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update PUBLIC_VITE_CONTRACT_HASH in .env")
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
  const { account } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<{ deployHash: string }> => {
      if (!account?.address) {
        throw new Error("Please connect your wallet first")
      }

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update PUBLIC_VITE_CONTRACT_HASH in .env")
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
  const { account } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    // @ts-ignore
    mutationFn: async ({ sampleId, newPrice }: { sampleId: string; newPrice: number }) => {
      if (!account?.address) {
        throw new Error("Please connect your wallet first")
      }

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update PUBLIC_VITE_CONTRACT_HASH in .env")
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
  const { account } = useCasperWallet()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (_sampleId: string) => {
      if (!account?.address) {
        throw new Error("Please connect your wallet first")
      }

      // Placeholder - requires contract deployment
      throw new Error("Contract not yet deployed. Please deploy the contract first and update PUBLIC_VITE_CONTRACT_HASH in .env")
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
