import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { FiltersProvider } from "./lib/filters";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FiltersProvider>
          <App />
        </FiltersProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
