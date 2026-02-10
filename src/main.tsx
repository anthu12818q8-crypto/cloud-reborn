import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeCSP, preventClickjacking, initializeDevToolsProtection } from "./lib/csp";
import { initializeVideoProtection, startFPSMonitoring, startConsoleCleaner } from "./lib/videoProtection";
import { initializeAdvancedSecurity } from "./lib/advancedSecurity";
import { initializeApiProtection } from "./lib/apiSecurity";

// Initialize security measures
if (!import.meta.env.DEV) {
  // Only in production
  initializeCSP();
  preventClickjacking();
  initializeDevToolsProtection();
  initializeAdvancedSecurity();
  startConsoleCleaner();
  initializeApiProtection(); // Protect API keys from extraction
}

// Always initialize video protection
initializeVideoProtection();
startFPSMonitoring();

createRoot(document.getElementById("root")!).render(<App />);
