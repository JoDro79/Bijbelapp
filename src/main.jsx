import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import BibleExplainer from "./BibleExplainer.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BibleExplainer />
  </StrictMode>
);
