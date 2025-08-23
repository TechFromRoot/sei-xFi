import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { DynamicContextProvider ,DynamicWidget} from "@dynamic-labs/sdk-react-core";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DynamicContextProvider
      settings={{
        environmentId: "8da6d0e5-62e9-492e-b33f-818bd526178c",
        walletConnectors: [],
      }}
    >
      <App />
    </DynamicContextProvider>
  </StrictMode>
);
