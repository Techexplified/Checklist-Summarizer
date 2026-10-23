import React from "react";
import ReactDOM from "react-dom/client";
import SettingsPopup from "./SettingsPopup.jsx";
import { getTrelloClient } from "../lib/trelloMock.js";

const t = getTrelloClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SettingsPopup t={t} />
  </React.StrictMode>
);
