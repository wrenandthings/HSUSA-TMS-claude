import React from "react";
import ReactDOM from "react-dom/client";
// Fonts are bundled so the app looks the same with no internet connection.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter-tight/600.css";
import "@fontsource/inter-tight/700.css";
import "./styles/theme.css";
import App from "./app/App";

ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
