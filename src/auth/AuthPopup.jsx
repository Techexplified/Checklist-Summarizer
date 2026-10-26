import React, { useEffect, useRef, useState } from "react";
import {
  APP_NAME,
  AUTH_MESSAGE_SOURCE,
  buildAuthorizeUrl,
  saveToken,
} from "../lib/auth.js";
import {
  CheckIcon,
  SpinnerIcon,
  ChecklistIcon,
} from "../lib/icons.jsx";
import "./auth.css";

export default function AuthPopup({ t }) {
  const [status, setStatus] = useState("idle"); // idle | waiting | success | error
  const [errorMessage, setErrorMessage] = useState("");
  const popupRef = useRef(null);

  useEffect(() => {
    async function handleToken(token) {
      if (!token) return;
      try {
        await saveToken(t, token);
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          "Failed to store authorization credentials: " +
            (err.message || "Unknown error")
        );
      }
    }

    async function handleMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== AUTH_MESSAGE_SOURCE) return;

      if (!event.data.token) {
        setStatus("error");
        setErrorMessage("No authorization token received from Trello.");
        return;
      }

      await handleToken(event.data.token);
    }

    // BroadcastChannel support
    let bc = null;
    try {
      bc = new BroadcastChannel("checklist_summarizer_auth");
      bc.onmessage = (event) => {
        if (event.data && event.data.token) {
          handleToken(event.data.token);
        }
      };
    } catch (e) {}

    // Storage event support
    function handleStorage(e) {
      if (e.key === "trello_token" && e.newValue) {
        handleToken(e.newValue);
      }
    }

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      if (bc) bc.close();
    };
  }, [t]);

  useEffect(() => {
    if (t && typeof t.sizeTo === "function") {
      t.sizeTo("#root").catch(() => {});
    }
  }, [t, status]);

  function handleAuthorize() {
    setStatus("waiting");
    setErrorMessage("");

    const returnUrl = `${window.location.origin}/authorized.html`;
    const authUrl = buildAuthorizeUrl(returnUrl);

    const width = 580;
    const height = 750;

    const screenWidth =
      window.screen?.availWidth || window.screen?.width || 1280;
    const screenHeight =
      window.screen?.availHeight || window.screen?.height || 800;

    const left = Math.max(0, Math.round((screenWidth - width) / 2));
    const top = Math.max(0, Math.round((screenHeight - height) / 2));

    popupRef.current = window.open(
      authUrl,
      "trelloAuthPopup",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`
    );

    if (
      !popupRef.current ||
      popupRef.current.closed ||
      typeof popupRef.current.closed === "undefined"
    ) {
      setStatus("error");
      setErrorMessage(
        "Popup was blocked by your browser. Please allow popups for this site and try again."
      );
    }
  }

  function handleOpenSummarizer() {
    if (t && typeof t.modal === "function") {
      t.modal({
        url: "./summarizer.html?view=board",
        accentColor: "#0f172a",
        height: 720,
        fullscreen: true,
        title: "Board Checklists Overview",
      });
    }
    if (t && typeof t.closePopup === "function") {
      t.closePopup();
    }
  }

  if (status === "success") {
    return (
      <div className="auth-popup-container auth-state-box">
        <div className="auth-success-circle">
          <CheckIcon width={28} height={28} />
        </div>
        <h3 className="auth-title">Connected to {APP_NAME}</h3>
        <p
          className="auth-subtitle"
          style={{ marginBottom: "18px", lineHeight: "1.45" }}
        >
          Your Trello account is connected! You can now analyze checklists,
          generate progress metrics, and copy or post summaries.
        </p>
        <button
          type="button"
          onClick={handleOpenSummarizer}
          className="auth-btn-primary"
        >
          Open Checklist Summarizer
        </button>
      </div>
    );
  }

  return (
    <div className="auth-popup-container">
      <div className="auth-header">
        <div className="auth-icon-badge">
          <ChecklistIcon width={22} height={22} />
        </div>
        <div>
          <h3 className="auth-title">Connect {APP_NAME}</h3>
          <p className="auth-subtitle">Trello Authorization</p>
        </div>
      </div>

      <p className="auth-body-text">
        Connect your Trello account so {APP_NAME} can read card checklists,
        calculate completion health, and post markdown summaries as comments.
      </p>

      <div className="auth-features-list">
        <div className="auth-feature-item">
          <span className="auth-feature-dot"></span>
          <span>Analyze checklists &amp; overdue items</span>
        </div>
        <div className="auth-feature-item">
          <span className="auth-feature-dot"></span>
          <span>1-click Post Markdown Summary to Card Comments</span>
        </div>
        <div className="auth-feature-item">
          <span className="auth-feature-dot"></span>
          <span>Board-wide checklist rollup &amp; health audit</span>
        </div>
        <div className="auth-feature-item">
          <span className="auth-feature-dot"></span>
          <span>Secure member-private credential storage</span>
        </div>
      </div>

      {status === "error" && (
        <div className="auth-error-box">
          {errorMessage ||
            "Couldn't connect. Please verify popups are allowed and try again."}
        </div>
      )}

      <button
        type="button"
        onClick={handleAuthorize}
        disabled={status === "waiting"}
        className="auth-btn-primary"
      >
        {status === "waiting" ? (
          <>
            <SpinnerIcon width={16} height={16} />
            Waiting for approval…
          </>
        ) : (
          "Connect Trello Account"
        )}
      </button>

      {status === "waiting" && (
        <p
          className="auth-body-text"
          style={{ textAlign: "center", marginTop: "10px", fontSize: "12px" }}
        >
          Please complete authorization in the popup window.
        </p>
      )}

      {status === "error" && (
        <button
          type="button"
          onClick={handleAuthorize}
          className="auth-link-btn"
        >
          Try again
        </button>
      )}
    </div>
  );
}
