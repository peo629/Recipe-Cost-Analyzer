import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// In production the SPA and the API live on different domains
// (e.g. two Railway services), so the API client needs an absolute
// base URL. In dev we leave it null so requests stay relative and
// the Vite proxy / same-origin api-server picks them up.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

createRoot(document.getElementById("root")!).render(<App />);
