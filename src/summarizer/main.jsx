import React from "react";
import ReactDOM from "react-dom/client";
import SummarizerApp from "./SummarizerApp.jsx";
import { getTrelloClient } from "../lib/trelloMock.js";

const t = getTrelloClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SummarizerApp t={t} />
  </React.StrictMode>
);
