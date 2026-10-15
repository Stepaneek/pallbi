import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initializePublicSchema } from "./lib/db";

initializePublicSchema();

createRoot(document.getElementById("root")!).render(<App />);
