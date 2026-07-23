import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import BibleExplainer from "./BibleExplainer.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BibleExplainer />
  </StrictMode>
);
