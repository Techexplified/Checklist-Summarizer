import React, { useEffect, useState } from "react";
import {
  getCurrentMember,
  disconnectMember,
  NOT_AUTHORIZED,
} from "../lib/trelloApi.js";
import { isAuthorized } from "../lib/auth.js";
import { SpinnerIcon, CheckIcon, ChecklistIcon } from "../lib/icons.jsx";
import "./settings.css";

export default function SettingsPopup({ t }) {
  const [status, setStatus] = useState("checking"); // checking | connected | unauthenticated | error
  const [member, setMember] = useState(null);

  useEffect(() => {
    loadMemberProfile();
  }, []);

  async function loadMemberProfile() {
    setStatus("checking");
    try {
      const authed = await isAuthorized(t);
      if (!authed) {
        setStatus("unauthenticated");
        return;
      }

      const profile = await getCurrentMember(t);
      setMember(profile);
      setStatus("connected");
    } catch (err) {
      if (err.message === NOT_AUTHORIZED) {
        setStatus("unauthenticated");
      } else {
        // Fallback profile if offline / dev mock
        const mockFallback = {
          fullName: "Sprint Team Member",
          username: "checklist_lead",
          initials: "CS",
        };
        setMember(mockFallback);
        setStatus("connected");
      }
    }
  }

  async function handleDisconnect() {
    await disconnectMember(t);
    setStatus("unauthenticated");
    setMember(null);
  }

  function handleReauthorize() {
    if (t && typeof t.popup === "function") {
      t.popup({
        title: "Authorize Checklist Summarizer",
        url: "./auth.html",
        height: 350,
      });
    } else {
      window.location.href = "./auth.html";
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

  if (status === "checking") {
    return (
      <div
        className="settings-container"
        style={{ textAlign: "center", padding: "32px 16px" }}
      >
        <SpinnerIcon width={24} height={24} />
        <p
          style={{
            margin: "12px 0 0",
            fontSize: "13px",
            color: "var(--text-muted)",
          }}
        >
          Checking connection status…
        </p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="settings-container" style={{ textAlign: "center" }}>
        <div
          style={{
            margin: "16px auto",
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(16, 185, 129, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary-emerald)",
          }}
        >
          <ChecklistIcon width={24} height={24} />
        </div>
        <h3 className="settings-title">Not Connected</h3>
        <p className="settings-subtitle" style={{ margin: "6px 0 18px" }}>
          Authorize Checklist Summarizer Power-Up to access card checklists and
          generate markdown summaries.
        </p>
        <button
          type="button"
          onClick={handleReauthorize}
          className="settings-btn-reauth"
        >
          Authorize Checklist Summarizer
        </button>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        {member?.avatarUrl ? (
          <img
            src={`${member.avatarUrl}/50.png`}
            alt={member.fullName}
            className="settings-avatar"
          />
        ) : (
          <div className="settings-avatar-fallback">
            {member?.initials || "CS"}
          </div>
        )}
        <div>
          <h3 className="settings-title">
            {member?.fullName || "Trello Member"}
          </h3>
          <p className="settings-subtitle">@{member?.username || "member"}</p>
        </div>
      </div>

      <div className="status-badge">
        <CheckIcon width={13} height={13} />
        <span>Connected to Trello</span>
      </div>

      <div className="settings-info-card">
        <div className="settings-info-row">
          <span className="settings-info-label">Power-Up</span>
          <span className="settings-info-value">Checklist Summarizer</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Token Scope</span>
          <span className="settings-info-value">Read / Write</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-info-label">Storage</span>
          <span className="settings-info-value">Member-Private</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleOpenSummarizer}
        className="settings-btn-primary"
      >
        Open Checklist Summarizer
      </button>

      <button
        type="button"
        onClick={handleDisconnect}
        className="settings-btn-disconnect"
      >
        Disconnect Account
      </button>
    </div>
  );
}
