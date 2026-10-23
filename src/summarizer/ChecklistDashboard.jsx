import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  INITIAL_BOARDS,
  INITIAL_ASSIGNEES,
  INITIAL_CHECKLIST_ITEMS,
} from "../data/mockDashboardData.js";
import { isAuthorized } from "../lib/auth.js";
import {
  getBoardCardsWithChecklists,
  getBoardLists,
  getBoardMembers,
  updateCheckItemState,
} from "../lib/trelloApi.js";
import {
  CheckIcon,
  CheckCircleIcon,
  SlidersIcon,
  ClockIcon,
  AlertTriangleIcon,
  CalendarIcon,
  PlusIcon,
  DownloadIcon,
  SettingsIcon,
  MaximizeIcon,
  SearchIcon,
  LayersIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  UserIcon,
  EyeIcon,
  MoreHorizontalIcon,
  MegaphoneIcon,
  SmartphoneIcon,
  CloudIcon,
  ChevronDownIcon,
  AlertCircleIcon,
  CopyIcon,
  RefreshCwIcon,
} from "../lib/icons.jsx";


export default function ChecklistDashboard({ t }) {
  // ── Live data state ──────────────────────────────────────────────────────
  const [isLive, setIsLive] = useState(false);          // true = real Trello data loaded
  const [isLoading, setIsLoading] = useState(false);
  const [liveBoards, setLiveBoards] = useState([]);     // [{id, name, color}]
  const [liveAssignees, setLiveAssignees] = useState([]); // [{id, name, initials, bg}]

  const boards = isLive ? liveBoards : INITIAL_BOARDS;
  const assignees = isLive ? liveAssignees : INITIAL_ASSIGNEES;

  // ── Item list ──────────────────────────────────────────────────────────
  const [items, setItems] = useState(INITIAL_CHECKLIST_ITEMS);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | INCOMPLETE | COMPLETED
  const [boardFilter, setBoardFilter] = useState("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL"); // ALL | OVERDUE | TODAY | UPCOMING
  const [sortBy, setSortBy] = useState("dueDate"); // dueDate | title | priority | assignee | board
  const [sortOrder, setSortOrder] = useState("asc"); // asc | desc
  const [groupBy, setGroupBy] = useState("none"); // none | board | priority

  // Modals
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskChecklist, setNewTaskChecklist] = useState("Product Launch Readiness");
  const [newTaskCard, setNewTaskCard] = useState("Executive Review & Milestone 3");
  const [newTaskBoard, setNewTaskBoard] = useState("b1");
  const [newTaskAssignee, setNewTaskAssignee] = useState("u1");
  const [newTaskPriority, setNewTaskPriority] = useState("HIGH");
  const [newTaskDue, setNewTaskDue] = useState("Oct 25");

  function showToast(text) {
    setToastMsg(text);
    setTimeout(() => setToastMsg(null), 3000);
  }

  // ── Live Trello data loader ──────────────────────────────────────────────
  const [needsAuth, setNeedsAuth] = useState(false);

  const loadRealData = useCallback(async () => {
    if (!t) return;
    setIsLoading(true);
    setNeedsAuth(false);
    try {
      // 1. Get board id via Power-Up client (always works — no token needed)
      const board = await t.board("id", "name").catch(() => null);
      if (!board || !board.id) {
        setIsLoading(false);
        return;
      }

      // 2. Fetch cards (with checklists), lists, and members in parallel
      //    These REST calls require an OAuth token — they'll throw NOT_AUTHORIZED if missing
      const [rawCards, rawLists, rawMembers] = await Promise.all([
        getBoardCardsWithChecklists(t, board.id),
        getBoardLists(t, board.id),
        getBoardMembers(t, board.id),
      ]);

      // Build lookup maps
      const listMap = {};
      rawLists.forEach((l) => { listMap[l.id] = l.name; });

      const memberMap = {};
      const AVATAR_COLORS = ["#f97316","#2563eb","#7c3aed","#0891b2","#059669","#dc2626","#db2777","#65a30d"];
      rawMembers.forEach((m, idx) => {
        memberMap[m.id] = {
          id: m.id,
          name: m.fullName || m.username,
          initials: m.initials || (m.fullName || m.username || "?").slice(0, 2).toUpperCase(),
          bg: AVATAR_COLORS[idx % AVATAR_COLORS.length],
          avatarUrl: m.avatarUrl || null,
        };
      });

      // Build boards list (just the one board for now)
      const liveBoardList = [{
        id: board.id,
        name: board.name,
        shortName: board.name.length > 22 ? board.name.slice(0, 22) + "…" : board.name,
        color: "#2563eb",
        icon: "cloud",
      }];

      // Flatten all checklist items across all cards
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const flatItems = [];
      for (const card of rawCards) {
        if (!Array.isArray(card.checklists) || card.checklists.length === 0) continue;
        const listName = listMap[card.idList] || "Unknown List";
        const cardName = card.name || "Untitled Card";
        const cardShort = cardName.length > 30 ? cardName.slice(0, 28) + "…" : cardName;

        for (const cl of card.checklists) {
          const checkItems = cl.checkItems || [];
          for (const ci of checkItems) {
            const isComplete = ci.state === "complete";
            let isDueToday = false;
            let isOverdue = false;
            let dueDateLabel = "";
            let dueStatus = "Upcoming";

            if (ci.due) {
              const dueDate = new Date(ci.due);
              const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
              dueDateLabel = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              if (!isComplete) {
                isOverdue = dueDay < today;
                isDueToday = dueDay.getTime() === today.getTime();
                dueStatus = isOverdue ? "Overdue" : isDueToday ? "Today" : "Upcoming";
              } else {
                dueStatus = "Completed";
              }
            } else if (card.due) {
              const cardDue = new Date(card.due);
              dueDateLabel = cardDue.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              if (!isComplete) {
                const cardDueDay = new Date(cardDue.getFullYear(), cardDue.getMonth(), cardDue.getDate());
                isOverdue = cardDueDay < today;
                isDueToday = cardDueDay.getTime() === today.getTime();
                dueStatus = isOverdue ? "Overdue" : isDueToday ? "Today" : "Upcoming";
              } else {
                dueStatus = "Completed";
              }
            } else {
              dueDateLabel = "No due date";
            }

            const memberId = ci.idMember || (card.idMembers && card.idMembers[0]) || null;

            flatItems.push({
              id: `${card.id}-${cl.id}-${ci.id}`,
              _rawCardId: card.id,
              _rawChecklistId: cl.id,
              _rawCheckItemId: ci.id,
              title: ci.name,
              checklistName: cl.name,
              priority: "MEDIUM",
              parentCard: cardShort,
              parentCardFull: cardName,
              listName,
              boardId: board.id,
              assigneeId: memberId,
              dueDate: dueDateLabel,
              dueStatus,
              state: ci.state,
              isDueToday,
              isOverdue,
            });
          }
        }
      }

      setLiveBoards(liveBoardList);
      setLiveAssignees(Object.values(memberMap));
      setItems(flatItems.length > 0 ? flatItems : []);
      setIsLive(true);
      if (flatItems.length > 0) {
        showToast(`Loaded ${flatItems.length} checklist items from Trello`);
      }
    } catch (err) {
      console.error("loadRealData failed:", err);
      if (err?.message === "NOT_AUTHORIZED" || String(err?.message).includes("NOT_AUTHORIZED")) {
        // Token missing — prompt user to connect via Settings
        setNeedsAuth(true);
      } else {
        showToast("Failed to load Trello data. Check console for details.");
      }
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // Auto-load on mount
  useEffect(() => {
    loadRealData();
  }, [loadRealData]);

  // Toggle item state
  function toggleItemState(id) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextState = item.state === "complete" ? "incomplete" : "complete";
        // If live mode, call Trello API asynchronously (fire-and-forget; optimistic UI)
        if (isLive && item._rawCardId && item._rawCheckItemId) {
          updateCheckItemState(t, item._rawCardId, item._rawCheckItemId, nextState).catch(() => {
            showToast("Failed to update item on Trello — please refresh");
          });
        }
        return {
          ...item,
          state: nextState,
          dueStatus: nextState === "complete" ? "Completed" : item.isOverdue ? "Overdue" : item.isDueToday ? "Today" : "Upcoming",
        };
      })
    );
  }

  // Toggle selection
  function toggleSelectItem(id) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select all visible
  function toggleSelectAll(filteredList) {
    if (selectedItemIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredList.map((i) => i.id)));
    }
  }

  // Metrics calculation
  const totalItems = items.length;
  const completedCount = items.filter((i) => i.state === "complete").length;
  const pendingCount = items.filter((i) => i.state === "incomplete").length;
  const overdueCount = items.filter((i) => i.state === "incomplete" && i.isOverdue).length;
  const dueTodayCount = items.filter((i) => i.state === "incomplete" && i.isDueToday).length;
  const completionPercent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Status filter
        if (statusFilter === "INCOMPLETE" && item.state !== "incomplete") return false;
        if (statusFilter === "COMPLETED" && item.state !== "complete") return false;

        // Board filter
        if (boardFilter !== "ALL" && item.boardId !== boardFilter) return false;

        // Assignee filter
        if (assigneeFilter !== "ALL" && item.assigneeId !== assigneeFilter) return false;

        // Due filter
        if (dueFilter === "OVERDUE" && (!item.isOverdue || item.state === "complete")) return false;
        if (dueFilter === "TODAY" && (!item.isDueToday || item.state === "complete")) return false;
        if (dueFilter === "UPCOMING" && (item.isOverdue || item.isDueToday)) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = item.title.toLowerCase().includes(q);
          const matchesCard = item.parentCard.toLowerCase().includes(q);
          const matchesChecklist = item.checklistName.toLowerCase().includes(q);
          const board = boards.find((b) => b.id === item.boardId);
          const matchesBoard = board ? board.name.toLowerCase().includes(q) : false;
          const assignee = assignees.find((u) => u.id === item.assigneeId);
          const matchesAssignee = assignee ? assignee.name.toLowerCase().includes(q) : false;
          if (!matchesTitle && !matchesCard && !matchesChecklist && !matchesBoard && !matchesAssignee) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let valA, valB;
        if (sortBy === "title") {
          valA = a.title;
          valB = b.title;
        } else if (sortBy === "priority") {
          const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          valA = rank[a.priority] || 0;
          valB = rank[b.priority] || 0;
        } else if (sortBy === "assignee") {
          const uA = assignees.find((u) => u.id === a.assigneeId)?.name || "";
          const uB = assignees.find((u) => u.id === b.assigneeId)?.name || "";
          valA = uA;
          valB = uB;
        } else {
          // Default: Due date ordering (overdue first, then today, then upcoming)
          const score = (item) => {
            if (item.state === "complete") return 100;
            if (item.isOverdue) return 1;
            if (item.isDueToday) return 2;
            return 3;
          };
          valA = score(a);
          valB = score(b);
        }

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [items, searchQuery, statusFilter, boardFilter, assigneeFilter, dueFilter, sortBy, sortOrder]);

  // Handle Add Task
  function handleAddTaskSubmit(e) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newItem = {
      id: `item-${Date.now()}`,
      title: newTaskTitle.trim(),
      checklistName: newTaskChecklist,
      priority: newTaskPriority,
      parentCard: newTaskCard,
      parentCardFull: newTaskCard,
      listName: "In Progress",
      boardId: newTaskBoard,
      assigneeId: newTaskAssignee,
      dueDate: newTaskDue,
      dueStatus: "Upcoming",
      state: "incomplete",
      isDueToday: newTaskDue.toLowerCase().includes("today"),
      isOverdue: false,
    };

    setItems((prev) => [newItem, ...prev]);
    setIsAddTaskOpen(false);
    setNewTaskTitle("");
    showToast(`Added: "${newItem.title.slice(0, 32)}..."`);
  }

  // Handle Export Markdown
  function handleExportMarkdown() {
    let md = `# Checklist Summary Report\n`;
    md += `*Generated: ${new Date().toLocaleDateString()}*\n\n`;
    md += `### 📊 Completion Metrics\n`;
    md += `- **Total Checklist Items**: ${totalItems}\n`;
    md += `- **Completion Rate**: ${completionPercent}% (${completedCount}/${totalItems})\n`;
    md += `- **Pending Tasks**: ${pendingCount}\n`;
    md += `- **Overdue Tasks**: ${overdueCount}\n`;
    md += `- **Due Today**: ${dueTodayCount}\n\n`;
    md += `### 📋 Task Inventory\n\n`;

    filteredItems.forEach((item) => {
      const check = item.state === "complete" ? "[x]" : "[ ]";
      const assignee = assignees.find((u) => u.id === item.assigneeId)?.name || "Unassigned";
      md += `- ${check} **${item.title}** (${item.priority}) — *${item.parentCard}* [@${assignee}] — Due: ${item.dueDate}\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      showToast("Markdown summary copied to clipboard!");
      setIsExportOpen(false);
    }).catch(() => {
      showToast("Unable to copy to clipboard.");
    });
  }

  // Handle Export CSV
  function handleExportCSV() {
    const headers = ["Checklist Item", "State", "Checklist", "Priority", "Parent Card", "Board", "Assignee", "Due Date"];
    const rows = filteredItems.map((item) => {
      const board = boards.find((b) => b.id === item.boardId)?.name || "";
      const assignee = assignees.find((u) => u.id === item.assigneeId)?.name || "";
      return [
        `"${item.title.replace(/"/g, '""')}"`,
        item.state,
        `"${item.checklistName}"`,
        item.priority,
        `"${item.parentCard}"`,
        `"${board}"`,
        `"${assignee}"`,
        `"${item.dueDate}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `checklist_summary_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportOpen(false);
    showToast("CSV file exported successfully!");
  }

  // Toggle Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Render board icon
  function renderBoardIcon(iconType) {
    if (iconType === "megaphone") return <MegaphoneIcon width={13} height={13} />;
    if (iconType === "phone") return <SmartphoneIcon width={13} height={13} />;
    return <CloudIcon width={13} height={13} />;
  }

  const isAllSelected = selectedItemIds.size === filteredItems.length && filteredItems.length > 0;

  return (
    <div className="dashboard-container">
      {/* =========================================================================
          TOP HEADER
          ========================================================================= */}
      <header className="dashboard-header">
        <div className="header-left-group">
          <div className="app-brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <polyline points="9 12 11.5 14.5 16 9" />
            </svg>
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">Checklist Summary</h1>
              <span className="powerup-badge">POWER-UP</span>
            </div>
            <p className="brand-subtitle">
              Cross-card task aggregator &amp; centralized checklist manager
            </p>
          </div>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="btn-add-task"
            onClick={() => setIsAddTaskOpen(true)}
            id="btn-add-task"
          >
            <PlusIcon width={16} height={16} />
            <span>Add Task</span>
          </button>

          <button
            type="button"
            className="btn-light-action"
            onClick={() => setIsExportOpen(true)}
            id="btn-export"
          >
            <DownloadIcon width={15} height={15} />
            <span>Export</span>
          </button>

          {/* Refresh Live Data */}
          {t && (
            <button
              type="button"
              className={`btn-icon-square ${isLoading ? "btn-loading" : ""}`}
              onClick={loadRealData}
              title={isLive ? "Refresh from Trello" : "Load from Trello"}
              id="btn-refresh"
              disabled={isLoading}
            >
              {isLoading
                ? <span className="spin-icon" style={{display:"inline-flex",animation:"spin 1s linear infinite"}}><RefreshCwIcon width={15} height={15} /></span>
                : <RefreshCwIcon width={15} height={15} />}
            </button>
          )}

          <button
            type="button"
            className="btn-icon-square"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            id="btn-settings"
          >
            <SettingsIcon width={16} height={16} />
          </button>

          <button
            type="button"
            className="btn-icon-square"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            id="btn-fullscreen"
          >
            <MaximizeIcon width={16} height={16} />
          </button>
        </div>
      </header>

      {/* ── Status banners ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="data-status-bar data-status-loading">
          <span className="spin-icon"><RefreshCwIcon width={13} height={13} /></span>
          <span>Loading live data from your Trello board&hellip;</span>
        </div>
      )}

      {!isLoading && needsAuth && (
        <div className="data-status-bar data-status-mock">
          <AlertCircleIcon width={13} height={13} />
          <span>
            Authorization required.{" "}
            <button
              className="status-bar-link-btn"
              onClick={() => setIsSettingsOpen(true)}
            >
              Open Settings to connect your Trello account
            </button>
            , then click the refresh button.
          </span>
        </div>
      )}

      {!isLoading && !needsAuth && isLive && (
        <div className="data-status-bar data-status-live">
          <CheckCircleIcon width={13} height={13} />
          <span>Live data from Trello &mdash; {items.length} checklist item{items.length !== 1 ? "s" : ""} loaded</span>
        </div>
      )}

      {/* =========================================================================
          5 STAT METRIC CARDS
          ========================================================================= */}
      <div className="metrics-grid">
        {/* Card 1: Total Items */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Total Items</span>
            <SlidersIcon width={16} height={16} className="metric-icon-muted" />
          </div>
          <div className="metric-value">{totalItems}</div>
          <div className="metric-subtext">Across all synced cards</div>
        </div>

        {/* Card 2: Completion Rate */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Completion Rate</span>
            <CheckCircleIcon width={17} height={17} className="metric-icon-green" />
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{completionPercent}%</span>
            <span className="metric-count">({completedCount}/{totalItems})</span>
          </div>
          <div className="metric-progress-track">
            <div
              className="metric-progress-fill"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Card 3: Pending Tasks */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Pending Tasks</span>
            <ClockIcon width={16} height={16} className="metric-icon-blue" />
          </div>
          <div className="metric-value">{pendingCount}</div>
          <div className="metric-subtext">Require action</div>
        </div>

        {/* Card 4: Overdue */}
        <div className="metric-card card-overdue">
          <div className="metric-card-top">
            <span className="metric-label red">Overdue</span>
            <AlertTriangleIcon width={16} height={16} className="metric-icon-red" />
          </div>
          <div className="metric-value red">{overdueCount}</div>
          <div className="metric-subtext red">Past deadline</div>
        </div>

        {/* Card 5: Due Today */}
        <div className="metric-card card-due-today">
          <div className="metric-card-top">
            <span className="metric-label amber">Due Today</span>
            <CalendarIcon width={16} height={16} className="metric-icon-amber" />
          </div>
          <div className="metric-value amber">{dueTodayCount}</div>
          <div className="metric-subtext amber">Needs attention today</div>
        </div>
      </div>

      {/* =========================================================================
          FILTER & CONTROL BAR
          ========================================================================= */}
      <div className="controls-card">
        {/* Top Controls Row */}
        <div className="controls-top-row">
          {/* Search Input */}
          <div className="search-box-wrapper">
            <SearchIcon width={15} height={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search tasks, card names, checklists... (/ to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Segmented Status Tabs */}
          <div className="segmented-track">
            <button
              type="button"
              className={`segmented-btn ${statusFilter === "ALL" ? "active" : ""}`}
              onClick={() => setStatusFilter("ALL")}
            >
              All Status
            </button>
            <button
              type="button"
              className={`segmented-btn ${statusFilter === "INCOMPLETE" ? "active" : ""}`}
              onClick={() => setStatusFilter("INCOMPLETE")}
            >
              Incomplete
            </button>
            <button
              type="button"
              className={`segmented-btn ${statusFilter === "COMPLETED" ? "active" : ""}`}
              onClick={() => setStatusFilter("COMPLETED")}
            >
              Completed
            </button>
          </div>

          {/* Group Dropdown */}
          <div className="dropdown-control-wrapper">
            <LayersIcon width={15} height={15} style={{ color: "#64748b" }} />
            <select
              className="custom-select"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="none">Group: None (Flat Table)</option>
              <option value="board">Group: By Board</option>
              <option value="priority">Group: By Priority</option>
            </select>
            <ChevronDownIcon width={12} height={12} className="select-chevron" />
          </div>

          {/* Sort Dropdown */}
          <div className="dropdown-control-wrapper">
            <ArrowUpDownIcon width={15} height={15} style={{ color: "#64748b" }} />
            <select
              className="custom-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="dueDate">Sort: Due Date</option>
              <option value="title">Sort: Checklist Item</option>
              <option value="priority">Sort: Priority</option>
              <option value="assignee">Sort: Assignee</option>
            </select>
            <ChevronDownIcon width={12} height={12} className="select-chevron" />
          </div>

          {/* Asc / Desc Button */}
          <button
            type="button"
            className="btn-sort-dir"
            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            title="Toggle sort direction"
          >
            {sortOrder === "asc" ? (
              <>
                <ArrowUpIcon width={13} height={13} />
                <span>Asc</span>
              </>
            ) : (
              <>
                <ArrowDownIcon width={13} height={13} />
                <span>Desc</span>
              </>
            )}
          </button>
        </div>

        {/* Bottom Sub-filters Row */}
        <div className="controls-bottom-row">
          <div className="sub-filters-left">
            {/* Board Filter */}
            <div className="inline-filter-item">
              <span className="filter-item-label">Board:</span>
              <div className="inline-select-container">
                <select
                  value={boardFilter}
                  onChange={(e) => setBoardFilter(e.target.value)}
                  className="sub-filter-select"
                >
                  <option value="ALL">All Boards ({boards.length})</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon width={11} height={11} className="sub-filter-chevron" />
              </div>
            </div>

            {/* Assignee Filter */}
            <div className="inline-filter-item">
              <UserIcon width={14} height={14} className="filter-item-icon" />
              <span className="filter-item-label">Assignee:</span>
              <div className="inline-select-container">
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="sub-filter-select"
                >
                  <option value="ALL">Everyone</option>
                  {assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon width={11} height={11} className="sub-filter-chevron" />
              </div>
            </div>

            {/* Due Date Filter */}
            <div className="inline-filter-item">
              <CalendarIcon width={14} height={14} className="filter-item-icon" />
              <span className="filter-item-label">Due:</span>
              <div className="inline-select-container">
                <select
                  value={dueFilter}
                  onChange={(e) => setDueFilter(e.target.value)}
                  className="sub-filter-select"
                >
                  <option value="ALL">All Dates</option>
                  <option value="OVERDUE">Overdue Only</option>
                  <option value="TODAY">Due Today</option>
                  <option value="UPCOMING">Upcoming</option>
                </select>
                <ChevronDownIcon width={11} height={11} className="sub-filter-chevron" />
              </div>
            </div>
          </div>

          <div className="sub-filters-right">
            <span className="showing-count">
              Showing <strong>{filteredItems.length}</strong> of {totalItems} items
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DATA TABLE
          ========================================================================= */}
      <div className="table-card">
        <table className="checklist-table">
          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  className="custom-checkbox"
                  checked={isAllSelected}
                  onChange={() => toggleSelectAll(filteredItems)}
                />
              </th>
              <th className="th-item">CHECKLIST ITEM</th>
              <th className="th-card">PARENT CARD</th>
              <th className="th-board">BOARD</th>
              <th className="th-assignee">ASSIGNEE</th>
              <th className="th-due">
                <span className="th-sortable" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                  DUE DATE {sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              </th>
              <th className="th-actions">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const isChecked = item.state === "complete";
              const isSelected = selectedItemIds.has(item.id);
              const board = boards.find((b) => b.id === item.boardId);
              const assignee = assignees.find((u) => u.id === item.assigneeId);

              // Priority badge styling
              const priorityClass =
                item.priority === "CRITICAL"
                  ? "priority-critical"
                  : item.priority === "HIGH"
                  ? "priority-high"
                  : item.priority === "MEDIUM"
                  ? "priority-medium"
                  : "priority-low";

              return (
                <tr
                  key={item.id}
                  className={`table-row ${isChecked ? "row-completed" : ""} ${
                    isSelected ? "row-selected" : ""
                  }`}
                >
                  {/* Checkbox for batch select */}
                  <td className="td-checkbox">
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectItem(item.id)}
                    />
                  </td>

                  {/* Checklist Item */}
                  <td className="td-item">
                    <div className="item-cell-wrapper">
                      <button
                        type="button"
                        className={`item-toggle-circle ${isChecked ? "done" : ""}`}
                        onClick={() => toggleItemState(item.id)}
                        title={isChecked ? "Mark as Incomplete" : "Mark as Complete"}
                      >
                        {isChecked && <CheckIcon width={12} height={12} />}
                      </button>

                      <div className="item-text-group">
                        <div className={`item-title ${isChecked ? "done-text" : ""}`}>
                          {item.title}
                        </div>
                        <div className="item-meta-line">
                          <span>Checklist: {item.checklistName}</span>
                          <span className="dot-divider">·</span>
                          <span className={`priority-tag ${priorityClass}`}>
                            {item.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Parent Card */}
                  <td className="td-card">
                    <div className="parent-card-name" title={item.parentCardFull}>
                      {item.parentCard}
                    </div>
                    <div className="parent-card-list">
                      List: {item.listName}
                    </div>
                  </td>

                  {/* Board */}
                  <td className="td-board">
                    <div className="board-badge-wrapper">
                      <span
                        className="board-dot"
                        style={{ background: board?.color || "#10b981" }}
                      />
                      <span className="board-icon">
                        {renderBoardIcon(board?.icon)}
                      </span>
                      <span className="board-title" title={board?.name}>
                        {board?.shortName || board?.name}
                      </span>
                    </div>
                  </td>

                  {/* Assignee */}
                  <td className="td-assignee">
                    {assignee ? (
                      <div className="assignee-wrapper">
                        <div
                          className="assignee-avatar"
                          style={{ background: assignee.bg }}
                        >
                          {assignee.initials}
                        </div>
                        <span className="assignee-name">{assignee.name}</span>
                      </div>
                    ) : (
                      <span className="unassigned-text">Unassigned</span>
                    )}
                  </td>

                  {/* Due Date */}
                  <td className="td-due">
                    {item.state === "incomplete" && item.isOverdue ? (
                      <div className="due-status overdue-danger">
                        <AlertCircleIcon width={14} height={14} />
                        <span>{item.dueDate} (Overdue)</span>
                      </div>
                    ) : item.state === "incomplete" && item.isDueToday ? (
                      <div className="due-status due-today-amber">
                        <CalendarIcon width={14} height={14} />
                        <span>{item.dueDate} (Today)</span>
                      </div>
                    ) : item.state === "complete" ? (
                      <div className="due-status completed-muted">
                        <CalendarIcon width={14} height={14} />
                        <span>{item.dueDate} ({item.dueStatus})</span>
                      </div>
                    ) : (
                      <div className="due-status upcoming-normal">
                        <CalendarIcon width={14} height={14} />
                        <span>{item.dueDate}</span>
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="td-actions">
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn-action-icon"
                        title="Preview Task Details"
                        onClick={() => setPreviewItem(item)}
                      >
                        <EyeIcon width={15} height={15} />
                      </button>
                      <button
                        type="button"
                        className="btn-action-icon"
                        title="More options"
                        onClick={() => {
                          showToast(`Opened actions for "${item.title.slice(0, 20)}..."`);
                        }}
                      >
                        <MoreHorizontalIcon width={16} height={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="td-empty">
                  <div className="empty-state-box">
                    <SlidersIcon width={32} height={32} style={{ color: "#94a3b8", margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "14px" }}>
                      No checklist tasks found
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "12px" }}>
                      Try clearing your search query or adjusting your status filters.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================================================================
          MODAL: ADD TASK
          ========================================================================= */}
      {isAddTaskOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddTaskOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Checklist Task</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddTaskOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTaskSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Description *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Conduct accessibility audit on landing page"
                    className="form-input"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label className="form-label">Target Board</label>
                    <select
                      className="form-select"
                      value={newTaskBoard}
                      onChange={(e) => setNewTaskBoard(e.target.value)}
                    >
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label className="form-label">Priority</label>
                    <select
                      className="form-select"
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value)}
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label className="form-label">Parent Card Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newTaskCard}
                      onChange={(e) => setNewTaskCard(e.target.value)}
                    />
                  </div>

                  <div className="form-group flex-1">
                    <label className="form-label">Checklist Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newTaskChecklist}
                      onChange={(e) => setNewTaskChecklist(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label className="form-label">Assignee</label>
                    <select
                      className="form-select"
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                    >
                      {assignees.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.initials})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group flex-1">
                    <label className="form-label">Due Date</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newTaskDue}
                      onChange={(e) => setNewTaskDue(e.target.value)}
                      placeholder="e.g. Oct 28 or Oct 23"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsAddTaskOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EXPORT OPTIONS
          ========================================================================= */}
      {isExportOpen && (
        <div className="modal-backdrop" onClick={() => setIsExportOpen(false)}>
          <div className="modal-dialog max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Export Checklist Summary</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsExportOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
                Select your preferred export format for the current view ({filteredItems.length} tasks):
              </p>

              <div className="export-options-list">
                <button
                  type="button"
                  className="export-tile"
                  onClick={handleExportMarkdown}
                >
                  <CopyIcon width={20} height={20} className="export-tile-icon" />
                  <div className="export-tile-text">
                    <strong>Copy Markdown Report</strong>
                    <span>Ideal for pasting into Trello Card Comments or Slack/Teams updates</span>
                  </div>
                </button>

                <button
                  type="button"
                  className="export-tile"
                  onClick={handleExportCSV}
                >
                  <DownloadIcon width={20} height={20} className="export-tile-icon" />
                  <div className="export-tile-text">
                    <strong>Download CSV Spreadsheet</strong>
                    <span>Full dataset with item status, parent card, boards, and assignees</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: TASK PREVIEW DETAILS
          ========================================================================= */}
      {previewItem && (
        <div className="modal-backdrop" onClick={() => setPreviewItem(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className={`priority-tag ${
                  previewItem.priority === "CRITICAL"
                    ? "priority-critical"
                    : previewItem.priority === "HIGH"
                    ? "priority-high"
                    : previewItem.priority === "MEDIUM"
                    ? "priority-medium"
                    : "priority-low"
                }`}>
                  {previewItem.priority}
                </span>
                <h2 className="modal-title" style={{ fontSize: "15px" }}>
                  Task Inspector
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewItem(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <h3 style={{ margin: "0 0 14px", fontSize: "16px", color: "#0f172a", lineHeight: 1.4 }}>
                {previewItem.title}
              </h3>

              <div className="preview-detail-grid">
                <div className="preview-prop">
                  <span className="prop-label">Status</span>
                  <span className="prop-val">
                    {previewItem.state === "complete" ? "✅ Completed" : "⏳ Incomplete / Pending"}
                  </span>
                </div>
                <div className="preview-prop">
                  <span className="prop-label">Due Date</span>
                  <span className="prop-val">
                    {previewItem.dueDate} ({previewItem.dueStatus})
                  </span>
                </div>
                <div className="preview-prop">
                  <span className="prop-label">Parent Card</span>
                  <span className="prop-val">{previewItem.parentCardFull}</span>
                </div>
                <div className="preview-prop">
                  <span className="prop-label">Checklist Name</span>
                  <span className="prop-val">{previewItem.checklistName}</span>
                </div>
                <div className="preview-prop">
                  <span className="prop-label">Board</span>
                  <span className="prop-val">
                    {INITIAL_BOARDS.find((b) => b.id === previewItem.boardId)?.name}
                  </span>
                </div>
                <div className="preview-prop">
                  <span className="prop-label">Assignee</span>
                  <span className="prop-val">
                    {INITIAL_ASSIGNEES.find((u) => u.id === previewItem.assigneeId)?.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => {
                  toggleItemState(previewItem.id);
                  setPreviewItem((prev) => ({
                    ...prev,
                    state: prev.state === "complete" ? "incomplete" : "complete",
                  }));
                }}
              >
                {previewItem.state === "complete" ? "Mark Incomplete" : "Mark as Done"}
              </button>
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setPreviewItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: SETTINGS
          ========================================================================= */}
      {isSettingsOpen && (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-dialog max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Power-Up Settings</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSettingsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div className="assignee-avatar" style={{ background: "#2563eb", width: "42px", height: "42px", fontSize: "16px" }}>
                  CS
                </div>
                <div>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>Checklist Summarizer</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>Version 2.4.0 (Enterprise)</p>
                </div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>
                <p style={{ margin: "0 0 6px" }}><strong>Trello Integration Status:</strong></p>
                <p style={{ margin: 0 }}>Active and synced with 3 boards, 20 checklist tasks, and 5 team assignees.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setIsSettingsOpen(false);
                  showToast("Settings preserved.");
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && <div className="dashboard-toast">{toastMsg}</div>}
    </div>
  );
}
