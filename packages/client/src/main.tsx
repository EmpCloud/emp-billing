import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: { fontSize: "14px", borderRadius: "10px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" },
        success: { iconTheme: { primary: "#4f46e5", secondary: "#fff" } },
      }}
    />
  </React.StrictMode>
);
