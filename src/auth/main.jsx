import React from "react";
import ReactDOM from "react-dom/client";
import AuthPopup from "./AuthPopup.jsx";
import { getTrelloClient } from "../lib/trelloMock.js";

const t = getTrelloClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthPopup t={t} />
  </React.StrictMode>
);
