import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    build: {
      target: "esnext",
    },
    envPrefix: "PUBLIC_",
    server: {
      proxy: {
        '/api/rpc': {
          target: 'https://node.testnet.casper.network',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/rpc/, '/rpc')
        }
      }
    }
  }
})
