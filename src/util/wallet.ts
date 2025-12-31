export type Balance = {
  asset_type: string;
  balance: string;
  symbol?: string;
  decimals?: number;
};

// Casper Network configuration
const CASPER_RPC_URL = import.meta.env.VITE_CASPER_RPC_URL || "https://rpc.testnet.casperlabs.io/rpc";

// CSPR has 9 decimals (motes)
const CSPR_DECIMALS = 9;

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
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "RPC Error");
  }
  return data.result;
}

export const fetchBalance = async (address: string): Promise<Balance[]> => {
  try {
    // Use query_balance RPC (Casper 2.0 compatible)
    interface QueryBalanceResult {
      balance: string;
    }

    const result = await rpcCall<QueryBalanceResult>("query_balance", [
      {
        purse_identifier: {
          main_purse_under_public_key: address,
        },
      },
    ]);

    const balanceInMotes = result.balance || "0";
    const balanceInCspr = Number(balanceInMotes) / Math.pow(10, CSPR_DECIMALS);

    return [
      {
        asset_type: "native",
        balance: balanceInCspr.toFixed(4),
        symbol: "CSPR",
        decimals: CSPR_DECIMALS,
      },
    ];
  } catch (error) {
    console.error("Error fetching balance:", error);
    // Return zero balance if account not found or error
    return [
      {
        asset_type: "native",
        balance: "0",
        symbol: "CSPR",
        decimals: CSPR_DECIMALS,
      },
    ];
  }
};

export const formatBalance = (
  balance: string,
  decimals: number = 4,
): string => {
  const num = parseFloat(balance);
  if (isNaN(num)) return "0";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

// Helper to convert motes to CSPR
export const motesToCspr = (motes: bigint | string | number): number => {
  const amount = typeof motes === "bigint" ? motes : BigInt(motes || 0);
  return Number(amount) / Math.pow(10, CSPR_DECIMALS);
};

// Helper to convert CSPR to motes
export const csprToMotes = (cspr: number): bigint => {
  return BigInt(Math.floor(cspr * Math.pow(10, CSPR_DECIMALS)));
};

// Format CSPR amount for display
export const formatCspr = (motes: bigint | string | number): string => {
  const cspr = motesToCspr(motes);
  return formatBalance(cspr.toString(), 4);
};

// Shorten address for display
export const shortenAddress = (
  address: string,
  prefixLength = 6,
  suffixLength = 4,
): string => {
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  const start = address.slice(0, prefixLength);
  const end = address.slice(-suffixLength);
  return `${start}...${end}`;
};
