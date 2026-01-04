import type { VercelRequest, VercelResponse } from "@vercel/node"

// Casper RPC endpoints
const TESTNET_RPC = "https://node.testnet.casper.network/rpc"
const MAINNET_RPC = "https://rpc.mainnet.casperlabs.io/rpc"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests (JSON-RPC uses POST)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  // Determine which network to use based on env
  const chainName = process.env.PUBLIC_VITE_CASPER_CHAIN_NAME || "casper-test"
  const rpcUrl = chainName === "casper" ? MAINNET_RPC : TESTNET_RPC

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    })

    const data = await response.json()

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    return res.status(response.status).json(data)
  } catch (error) {
    console.error("RPC proxy error:", error)
    return res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error: Failed to proxy RPC request",
      },
      id: req.body?.id || null,
    })
  }
}
