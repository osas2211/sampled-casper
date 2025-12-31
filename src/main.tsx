 
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
// import { PrivyProvider } from "@privy-io/react-auth";
import { WalletProvider } from "./providers/WalletProvider.tsx";
import { NotificationProvider } from "./providers/NotificationProvider.tsx";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AntConfigProvider } from "./components/shared/AntConfigProvider.tsx";
import { SmoothScroll } from "./components/SmoothScroll.tsx";
import { Loader } from "./components/shared/Loader.tsx";
import { OnboardingProvider } from "./context/onboarding-context.tsx";
import { Toaster } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <div className="antialiased bg-background text-white">
      <NotificationProvider>
        <QueryClientProvider client={queryClient}>
          {/* <PrivyProvider
            appId={import.meta.env.PUBLIC_VITE_PRIVY_APP_ID || ""}
            config={{
              appearance: {
                theme: "dark",
                accentColor: "#676FFF",
              },
              embeddedWallets: {
                ethereum: {
                  createOnLogin: "users-without-wallets",
                },
              },
            }}
          >
            
          </PrivyProvider> */}
          <WalletProvider>
              <BrowserRouter>
                <AntConfigProvider>
                  <OnboardingProvider>
                    <SmoothScroll>
                      <Loader />
                      <App />
                      <Toaster />
                    </SmoothScroll>
                  </OnboardingProvider>
                </AntConfigProvider>
              </BrowserRouter>
            </WalletProvider>
        </QueryClientProvider>
      </NotificationProvider>
    </div>
  </StrictMode>,
);
