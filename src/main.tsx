import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import WordClimbApp from "./WordClimbApp";
import { initPwa } from "./pwa";

initPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WordClimbApp />
  </StrictMode>,
);
