import React, { useEffect, useState, useMemo } from "react";
import {
  analyzeChecklists,
  analyzeBoardChecklists,
  generateMarkdownSummary,
  generateExecutiveBrief,
} from "../lib/checklistService.js";
import {
  getCardChecklists,
  getBoardCardsWithChecklists,
  getBoardLists,
  postCardComment,
  updateCheckItemState,
} from "../lib/trelloApi.js";
import { isAuthorized } from "../lib/auth.js";
import {
  ChecklistIcon,
  CheckCircleIcon,
  CheckIcon,
  AlertCircleIcon,
  ClockIcon,
  CopyIcon,
  MessageSquareIcon,
  SparklesIcon,
  RefreshCwIcon,
  BoardIcon,
  CardIcon,
  SpinnerIcon,
  FilterIcon,
} from "../lib/icons.jsx";
import "./summarizer.css";

export default function SummarizerApp({ t }) {
  const [viewMode, setViewMode] = useState("card"); // 'card' | 'card-back-section' | 'board'
  const [loading, setLoading] = useState(true);
  const [cardData, setCardData] = useState(null);
  const [boardData, setBoardData] = useState(null);
  const [activeTab, setActiveTab] = useState("breakdown"); // 'breakdown' | 'incomplete' | 'markdown'
  const [toastMessage, setToastMessage] = useState(null);
  const [postingComment, setPostingComment] = useState(false);
  const [boardSearch, setBoardSearch] = useState("");
  const [boardListFilter, setBoardListFilter] = useState("ALL");

  // Read URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get("view");
    if (view === "card-back-section") {
      setViewMode("card-back-section");
    } else if (view === "board") {
      setViewMode("board");
    } else {
      setViewMode("card");
    }
  }, []);

  // Load data based on viewMode
  useEffect(() => {
    loadData();
  }, [viewMode, t]);

  // Adjust iframe size if compact
  useEffect(() => {
    if (viewMode === "card-back-section" && t && typeof t.sizeTo === "function") {
      t.sizeTo("#root").catch(() => {});
    }
  }, [viewMode, cardData, t]);

  function showToast(msg) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }

  async function loadData() {
    setLoading(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetCardId = urlParams.get("cardId");

      if (viewMode === "board") {
        // Load all cards and lists for the board
        let rawCards = [];
        let rawLists = [];

        if (t && typeof t.cards === "function") {
          try {
            rawCards = await t.cards("all").catch(() => []);
          } catch (e) {}
        }
        if (t && typeof t.lists === "function") {
          try {
            rawLists = await t.lists("all").catch(() => []);
          } catch (e) {}
        }

        // Check if authorized and cards lack checklists
        const authed = await isAuthorized(t).catch(() => false);
        if (authed) {
          try {
            const board = await t.board("id").catch(() => null);
            if (board && board.id) {
              const apiCards = await getBoardCardsWithChecklists(t, board.id).catch(() => null);
              if (Array.isArray(apiCards) && apiCards.length > 0) {
                rawCards = apiCards;
              }
              const apiLists = await getBoardLists(t, board.id).catch(() => null);
              if (Array.isArray(apiLists) && apiLists.length > 0) {
                rawLists = apiLists;
              }
            }
          } catch (e) {}
        }

        const boardAnalysis = analyzeBoardChecklists(rawCards, rawLists);
        setBoardData({
          analysis: boardAnalysis,
          lists: rawLists,
        });
      } else {
        // Load single card data
        let currentCard = null;
        if (t && typeof t.card === "function") {
          try {
            currentCard = await t.card("id", "name", "desc", "checklists", "due", "badges", "url").catch(() => null);
          } catch (e) {}
        }

        let checklists = currentCard?.checklists || [];

        // If card checklists are missing or targetCardId specified, try REST API if authorized
        if ((!checklists || checklists.length === 0) && currentCard?.id) {
          const authed = await isAuthorized(t).catch(() => false);
          if (authed) {
            try {
              const apiChecklists = await getCardChecklists(t, currentCard.id).catch(() => null);
              if (Array.isArray(apiChecklists) && apiChecklists.length > 0) {
                checklists = apiChecklists;
              }
            } catch (e) {}
          }
        }

        setCardData({
          id: currentCard?.id || targetCardId || "card_1",
          name: currentCard?.name || "Sprint Feature Card",
          url: currentCard?.url || "#",
          due: currentCard?.due || null,
          checklists: checklists,
        });
      }
    } catch (err) {
      console.error("Failed to load summarizer data", err);
    } finally {
      setLoading(false);
    }
  }

  // Current card analytics
  const cardAnalysis = useMemo(() => {
    if (!cardData) return null;
    return analyzeChecklists(cardData.checklists, cardData.name);
  }, [cardData]);

  // Generated markdown
  const markdownText = useMemo(() => {
    if (!cardAnalysis) return "";
    return generateMarkdownSummary(cardAnalysis);
  }, [cardAnalysis]);

  // Executive brief
  const executiveBrief = useMemo(() => {
    if (!cardAnalysis) return "";
    return generateExecutiveBrief(cardAnalysis);
  }, [cardAnalysis]);

  // Copy Markdown to Clipboard
  async function handleCopyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdownText);
      showToast("📋 Markdown summary copied to clipboard!");
    } catch (e) {
      showToast("Unable to copy to clipboard.");
    }
  }

  // Post Markdown to Trello Card Comment
  async function handlePostComment() {
    if (!cardData?.id) return;
    setPostingComment(true);
    try {
      const authed = await isAuthorized(t).catch(() => false);
      if (authed) {
        await postCardComment(t, cardData.id, markdownText);
        showToast("💬 Summary posted as comment on this card!");
      } else {
        // Dev / unauthenticated simulation
        await new Promise((res) => setTimeout(res, 600));
        showToast("💬 (Dev Mode) Summary posted to card comments!");
      }
    } catch (err) {
      showToast("Failed to post comment: " + (err.message || "Unknown error"));
    } finally {
      setPostingComment(false);
    }
  }

  // Toggle checklist item state in local state & API
  async function handleToggleItem(checklistId, itemId, currentState) {
    const nextState = currentState === "complete" ? "incomplete" : "complete";

    // Optimistically update local state
    setCardData((prev) => {
      if (!prev) return prev;
      const updatedChecklists = prev.checklists.map((cl) => {
        if (cl.id !== checklistId) return cl;
        return {
          ...cl,
          checkItems: (cl.checkItems || []).map((it) => {
            if (it.id !== itemId) return it;
            return { ...it, state: nextState };
          }),
        };
      });
      return { ...prev, checklists: updatedChecklists };
    });

    try {
      const authed = await isAuthorized(t).catch(() => false);
      if (authed && cardData?.id) {
        await updateCheckItemState(t, cardData.id, itemId, nextState).catch(() => {});
      }
    } catch (e) {}
  }

  // Filtered cards for Board View
  const filteredBoardCards = useMemo(() => {
    if (!boardData?.analysis?.cards) return [];
    return boardData.analysis.cards.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(boardSearch.toLowerCase());
      const matchesList = boardListFilter === "ALL" || c.listId === boardListFilter;
      return matchesSearch && matchesList;
    });
  }, [boardData, boardSearch, boardListFilter]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "12px", color: "var(--text-secondary)" }}>
        <SpinnerIcon width={32} height={32} />
        <span style={{ fontSize: "14px" }}>Analyzing checklists…</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // VIEW: Compact Widget for Card-Back Section
  // -------------------------------------------------------------------------
  if (viewMode === "card-back-section") {
    const percent = cardAnalysis?.percentComplete || 0;
    const total = cardAnalysis?.totalItems || 0;
    const completed = cardAnalysis?.completedItems || 0;
    const overdueCount = cardAnalysis?.overdueCount || 0;

    return (
      <div className="compact-widget">
        <div className="compact-top">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ChecklistIcon width={18} height={18} className="brief-icon" />
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-main)" }}>
              Checklist Health: <strong style={{ color: cardAnalysis?.statusColor }}>{cardAnalysis?.status}</strong>
            </span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600" }}>
            {completed}/{total} ({percent}%)
          </span>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${percent}%`, background: cardAnalysis?.statusColor }} />
        </div>

        <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
          {executiveBrief}
        </p>

        {overdueCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontSize: "11px", marginBottom: "10px" }}>
            <AlertCircleIcon width={14} height={14} />
            <span>{overdueCount} task(s) are overdue</span>
          </div>
        )}

        <div className="compact-actions">
          <button type="button" onClick={handleCopyMarkdown} className="btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }}>
            <CopyIcon width={14} height={14} />
            Copy Markdown
          </button>
          <button
            type="button"
            onClick={handlePostComment}
            disabled={postingComment}
            className="btn-primary"
            style={{ padding: "6px 12px", fontSize: "12px" }}
          >
            {postingComment ? <SpinnerIcon width={14} height={14} /> : <MessageSquareIcon width={14} height={14} />}
            Post Comment
          </button>
        </div>

        {toastMessage && <div className="toast-msg">{toastMessage}</div>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // VIEW: Board-Wide Checklists Rollup View
  // -------------------------------------------------------------------------
  if (viewMode === "board") {
    const analysis = boardData?.analysis;

    return (
      <div className="summarizer-app">
        <header className="app-header">
          <div className="header-left">
            <div className="app-logo-badge">
              <BoardIcon width={24} height={24} />
            </div>
            <div className="app-title-group">
              <h1>Board Checklists Overview</h1>
              <div className="app-meta-pill">
                <span>{analysis?.totalCardsWithChecklists || 0} cards with active checklists</span>
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button type="button" onClick={loadData} className="btn-secondary">
              <RefreshCwIcon width={15} height={15} />
              Refresh
            </button>
          </div>
        </header>

        {/* Board Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <div className="stat-card">
            <span className="stat-label">
              <CheckCircleIcon width={15} height={15} /> Board Completion
            </span>
            <span className="stat-value" style={{ color: "var(--emerald-light)" }}>
              {analysis?.boardPercentComplete || 0}%
            </span>
            <span className="stat-sub">Across all board checklists</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">
              <ChecklistIcon width={15} height={15} /> Total Checklist Tasks
            </span>
            <span className="stat-value">{analysis?.totalItems || 0}</span>
            <span className="stat-sub">{analysis?.completedItems || 0} tasks done</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">
              <ClockIcon width={15} height={15} /> Incomplete Tasks
            </span>
            <span className="stat-value" style={{ color: "var(--sky)" }}>
              {analysis?.incompleteItems || 0}
            </span>
            <span className="stat-sub">Pending completion</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">
              <AlertCircleIcon width={15} height={15} /> Overdue Items
            </span>
            <span className="stat-value" style={{ color: analysis?.overdueCount > 0 ? "var(--red)" : "var(--text-muted)" }}>
              {analysis?.overdueCount || 0}
            </span>
            <span className="stat-sub">Passed deadline</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
            <input
              type="text"
              placeholder="Search card title…"
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
              style={{
                width: "100%",
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-sm)",
                padding: "9px 14px",
                color: "var(--text-main)",
                fontSize: "13px",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FilterIcon width={15} height={15} style={{ color: "var(--text-secondary)" }} />
            <select
              value={boardListFilter}
              onChange={(e) => setBoardListFilter(e.target.value)}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-sm)",
                padding: "9px 12px",
                color: "var(--text-main)",
                fontSize: "13px",
              }}
            >
              <option value="ALL">All Board Lists</option>
              {(boardData?.lists || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="board-cards-grid">
          {filteredBoardCards.map((card) => {
            const cardAn = card.analysis;
            return (
              <div key={card.id} className="board-card-tile">
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "600" }}>
                      {card.listName}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: "600",
                        color: cardAn.statusColor,
                        background: "rgba(255,255,255,0.05)",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {cardAn.status}
                    </span>
                  </div>

                  <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600", color: "var(--text-main)", lineHeight: "1.4" }}>
                    {card.name}
                  </h3>

                  <div className="progress-track" style={{ marginBottom: "8px" }}>
                    <div className="progress-fill" style={{ width: `${cardAn.percentComplete}%`, background: cardAn.statusColor }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-secondary)" }}>
                    <span>{cardAn.percentComplete}% done</span>
                    <span>
                      {cardAn.completedItems} / {cardAn.totalItems} items
                    </span>
                  </div>
                </div>

                {cardAn.overdueCount > 0 && (
                  <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", color: "#f87171", fontSize: "11px" }}>
                    <AlertCircleIcon width={13} height={13} />
                    <span>{cardAn.overdueCount} overdue</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredBoardCards.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)", fontSize: "14px" }}>
            No cards found matching your search.
          </div>
        )}

        {toastMessage && <div className="toast-msg">{toastMessage}</div>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // VIEW: Full Card Modal View
  // -------------------------------------------------------------------------
  const percent = cardAnalysis?.percentComplete || 0;
  const strokeDashoffset = 251.2 - (251.2 * percent) / 100;

  return (
    <div className="summarizer-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo-badge">
            <ChecklistIcon width={24} height={24} />
          </div>
          <div className="app-title-group">
            <h1>{cardData?.name || "Card Checklist Summary"}</h1>
            <div className="app-meta-pill">
              <span>{cardAnalysis?.totalChecklists} Checklist(s)</span>
              <span>•</span>
              <span style={{ color: cardAnalysis?.statusColor }}>{cardAnalysis?.status}</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button type="button" onClick={handleCopyMarkdown} className="btn-secondary">
            <CopyIcon width={15} height={15} />
            Copy Markdown
          </button>
          <button
            type="button"
            onClick={handlePostComment}
            disabled={postingComment}
            className="btn-primary"
          >
            {postingComment ? <SpinnerIcon width={15} height={15} /> : <MessageSquareIcon width={15} height={15} />}
            Post to Card
          </button>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="stats-grid">
        <div className="stat-card gauge-card">
          <div className="circular-gauge">
            <svg width="90" height="90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="none" />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={cardAnalysis?.statusColor || "#10b981"}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="251.2"
                strokeDashoffset={strokeDashoffset}
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div className="gauge-text">
              <div className="gauge-value">{percent}%</div>
              <div className="gauge-label">Done</div>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <ChecklistIcon width={15} height={15} /> Total Items
          </span>
          <span className="stat-value">{cardAnalysis?.totalItems || 0}</span>
          <span className="stat-sub">Across all checklists</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <CheckCircleIcon width={15} height={15} /> Completed Tasks
          </span>
          <span className="stat-value" style={{ color: "var(--emerald-light)" }}>
            {cardAnalysis?.completedItems || 0}
          </span>
          <span className="stat-sub">{cardAnalysis?.incompleteItems || 0} remaining</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            <AlertCircleIcon width={15} height={15} /> Overdue Tasks
          </span>
          <span className="stat-value" style={{ color: cardAnalysis?.overdueCount > 0 ? "var(--red)" : "var(--text-muted)" }}>
            {cardAnalysis?.overdueCount || 0}
          </span>
          <span className="stat-sub">Attention required</span>
        </div>
      </div>

      {/* Executive Brief Banner */}
      <div className={`brief-banner ${cardAnalysis?.overdueCount > 0 ? "warning" : ""}`}>
        <SparklesIcon width={20} height={20} className="brief-icon" />
        <div className="brief-content">
          <div className="brief-title">Executive Brief</div>
          <p className="brief-text">{executiveBrief}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs-nav">
        <button
          type="button"
          onClick={() => setActiveTab("breakdown")}
          className={`tab-btn ${activeTab === "breakdown" ? "active" : ""}`}
        >
          <span>All Checklists</span>
          <span className="tab-badge">{cardAnalysis?.categorized?.length || 0}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("incomplete")}
          className={`tab-btn ${activeTab === "incomplete" ? "active" : ""}`}
        >
          <span>Remaining Tasks</span>
          <span className="tab-badge">{cardAnalysis?.incompleteItems || 0}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("markdown")}
          className={`tab-btn ${activeTab === "markdown" ? "active" : ""}`}
        >
          <span>Markdown Export</span>
        </button>
      </div>

      {/* Tab: Breakdown */}
      {activeTab === "breakdown" && (
        <div className="checklists-list">
          {(cardAnalysis?.categorized || []).map((cl) => (
            <div key={cl.id} className="checklist-block">
              <div className="checklist-header">
                <div className="checklist-title-group">
                  <ChecklistIcon width={18} height={18} style={{ color: "var(--sky)" }} />
                  <h3 className="checklist-title">{cl.name}</h3>
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: "600" }}>
                  {cl.completed} / {cl.total} ({cl.percent}%)
                </span>
              </div>

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${cl.percent}%` }} />
              </div>

              <div className="items-list">
                {cl.items.map((it) => (
                  <div key={it.id} className="item-row">
                    <div className="item-left">
                      <div
                        onClick={() => handleToggleItem(cl.id, it.id, it.state)}
                        className={`item-checkbox ${it.isComplete ? "checked" : ""}`}
                      >
                        {it.isComplete && <CheckIcon width={12} height={12} />}
                      </div>
                      <span className={`item-name ${it.isComplete ? "done" : ""}`}>
                        {it.name}
                      </span>
                    </div>

                    <div className="item-meta">
                      {it.isOverdue && (
                        <span className="overdue-tag">
                          <AlertCircleIcon width={12} height={12} /> Overdue
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Incomplete Remaining Tasks Only */}
      {activeTab === "incomplete" && (
        <div className="checklists-list">
          {cardAnalysis?.incompleteItems === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px", background: "var(--bg-card)", borderRadius: "var(--radius-md)" }}>
              <CheckCircleIcon width={48} height={48} style={{ color: "var(--emerald)", margin: "0 auto 12px auto" }} />
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "var(--text-main)" }}>All tasks complete!</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>There are no remaining tasks on this card.</p>
            </div>
          ) : (
            (cardAnalysis?.categorized || []).map((cl) => {
              const pendingItems = cl.items.filter((it) => !it.isComplete);
              if (pendingItems.length === 0) return null;

              return (
                <div key={cl.id} className="checklist-block">
                  <div className="checklist-header">
                    <div className="checklist-title-group">
                      <ClockIcon width={17} height={17} style={{ color: "var(--amber)" }} />
                      <h3 className="checklist-title">{cl.name}</h3>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--amber)", fontWeight: "600" }}>
                      {pendingItems.length} task(s) remaining
                    </span>
                  </div>

                  <div className="items-list">
                    {pendingItems.map((it) => (
                      <div key={it.id} className="item-row">
                        <div className="item-left">
                          <div
                            onClick={() => handleToggleItem(cl.id, it.id, it.state)}
                            className="item-checkbox"
                          ></div>
                          <span className="item-name">{it.name}</span>
                        </div>

                        <div className="item-meta">
                          {it.isOverdue && (
                            <span className="overdue-tag">
                              <AlertCircleIcon width={12} height={12} /> Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Markdown Preview */}
      {activeTab === "markdown" && (
        <div className="markdown-view-container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-main)" }}>
              Formatted Markdown Report
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Ready for Trello Comments or Slack / Teams
            </span>
          </div>

          <pre className="markdown-code-box">{markdownText}</pre>

          <div className="markdown-actions">
            <button type="button" onClick={handleCopyMarkdown} className="btn-secondary">
              <CopyIcon width={15} height={15} />
              Copy Markdown
            </button>
            <button
              type="button"
              onClick={handlePostComment}
              disabled={postingComment}
              className="btn-primary"
            >
              {postingComment ? <SpinnerIcon width={15} height={15} /> : <MessageSquareIcon width={15} height={15} />}
              Post Comment on Card
            </button>
          </div>
        </div>
      )}

      {toastMessage && <div className="toast-msg">{toastMessage}</div>}
    </div>
  );
}
