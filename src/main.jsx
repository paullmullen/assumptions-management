import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import "antd/dist/reset.css";
import "./styles.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConfigProvider
      theme={{ token: { colorPrimary: "#1b4d3e", borderRadius: 8 } }}
    >
      <App />
    </ConfigProvider>
  </StrictMode>,
);
