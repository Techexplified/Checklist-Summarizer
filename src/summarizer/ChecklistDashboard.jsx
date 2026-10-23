import React, { useState, useMemo } from "react";
import {
  INITIAL_BOARDS,
  INITIAL_ASSIGNEES,
  INITIAL_CHECKLIST_ITEMS,
} from "../data/mockDashboardData.js";
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
} from "../lib/icons.jsx";

export default function ChecklistDashboard({ t }) {
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

  // Toggle item state
  function toggleItemState(id) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextState = item.state === "complete" ? "incomplete" : "complete";
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
        if (statusFilter === "OVERDUE" && (!item.isOverdue || item.state === "complete")) return false;

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
          const board = INITIAL_BOARDS.find((b) => b.id === item.boardId);
          const matchesBoard = board ? board.name.toLowerCase().includes(q) : false;
          const assignee = INITIAL_ASSIGNEES.find((u) => u.id === item.assigneeId);
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
          const uA = INITIAL_ASSIGNEES.find((u) => u.id === a.assigneeId)?.name || "";
          const uB = INITIAL_ASSIGNEES.find((u) => u.id === b.assigneeId)?.name || "";
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
      const assignee = INITIAL_ASSIGNEES.find((u) => u.id === item.assigneeId)?.name || "Unassigned";
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
      const board = INITIAL_BOARDS.find((b) => b.id === item.boardId)?.name || "";
      const assignee = INITIAL_ASSIGNEES.find((u) => u.id === item.assigneeId)?.name || "";
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

      {/* =========================================================================
      {/* =========================================================================
          SPACIOUS 3-CARD METRICS STRIP (Uncrowded & Clean)
          ========================================================================= */}
      <div className="metrics-grid">
        {/* Card 1: Checklist Progress */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Checklist Progress</span>
            <span className="metric-badge green">{completionPercent}%</span>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{completedCount}</span>
            <span className="metric-count">of {totalItems} completed</span>
          </div>
          <div className="metric-progress-track">
            <div
              className="metric-progress-fill"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="metric-subtext">Across {INITIAL_BOARDS.length} synced boards</div>
        </div>

        {/* Card 2: Tasks To Do */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Tasks To Do</span>
            <span className="metric-badge blue">Active</span>
          </div>
          <div className="metric-value-row">
            <span className="metric-value">{pendingCount}</span>
            <span className="metric-count">pending tasks</span>
          </div>
          <div className="metric-subtext" style={{ marginTop: "10px" }}>
            Require action before milestone
          </div>
        </div>

        {/* Card 3: Deadlines & Alerts */}
        <div className="metric-card card-alerts">
          <div className="metric-card-top">
            <span className="metric-label">Deadlines &amp; Alerts</span>
            {overdueCount > 0 ? (
              <span className="metric-badge red">Urgent</span>
            ) : (
              <span className="metric-badge green">All Clear</span>
            )}
          </div>
          <div className="metric-alerts-row">
            <div
              className="alert-pill overdue-pill"
              onClick={() => { setStatusFilter("OVERDUE"); setDueFilter("ALL"); }}
              title="Filter to overdue tasks"
            >
              <AlertTriangleIcon width={14} height={14} />
              <span className="alert-num">{overdueCount}</span>
              <span className="alert-text">Overdue</span>
            </div>
            <div
              className="alert-pill today-pill"
              onClick={() => { setStatusFilter("ALL"); setDueFilter("TODAY"); }}
              title="Filter to tasks due today"
            >
              <CalendarIcon width={14} height={14} />
              <span className="alert-num">{dueTodayCount}</span>
              <span className="alert-text">Due Today</span>
            </div>
          </div>
          <div className="metric-subtext">Click pill to filter tasks</div>
        </div>
      </div>

      {/* =========================================================================
      {/* =========================================================================
          FILTER & CONTROL BAR
          ========================================================================= */}
      <div className="controls-card">
        {/* Top Controls Row */}
        <div className="controls-top-row">
          {/* Search Input */}
          <div className="search-box-wrapper">
            <SearchIcon width={14} height={14} className="search-icon" />
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
              onClick={() => { setStatusFilter("ALL"); setDueFilter("ALL"); }}
            >
              All ({totalItems})
            </button>
            <button
              type="button"
              className={`segmented-btn ${statusFilter === "INCOMPLETE" ? "active" : ""}`}
              onClick={() => { setStatusFilter("INCOMPLETE"); setDueFilter("ALL"); }}
            >
              Incomplete ({pendingCount})
            </button>
            <button
              type="button"
              className={`segmented-btn ${statusFilter === "COMPLETED" ? "active" : ""}`}
              onClick={() => { setStatusFilter("COMPLETED"); setDueFilter("ALL"); }}
            >
              Completed ({completedCount})
            </button>
            <button
              type="button"
              className={`segmented-btn ${statusFilter === "OVERDUE" ? "active" : ""}`}
              onClick={() => { setStatusFilter("OVERDUE"); setDueFilter("ALL"); }}
            >
              Overdue ({overdueCount})
            </button>
          </div>
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
                  <option value="ALL">All Boards ({INITIAL_BOARDS.length})</option>
                  {INITIAL_BOARDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon width={10} height={10} className="sub-filter-chevron" />
              </div>
            </div>

            {/* Assignee Filter */}
            <div className="inline-filter-item">
              <UserIcon width={13} height={13} className="filter-item-icon" />
              <span className="filter-item-label">Assignee:</span>
              <div className="inline-select-container">
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="sub-filter-select"
                >
                  <option value="ALL">Everyone</option>
                  {INITIAL_ASSIGNEES.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon width={10} height={10} className="sub-filter-chevron" />
              </div>
            </div>

            {/* Due Date Filter */}
            <div className="inline-filter-item">
              <CalendarIcon width={13} height={13} className="filter-item-icon" />
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
                <ChevronDownIcon width={10} height={10} className="sub-filter-chevron" />
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="inline-filter-item">
              <span className="filter-item-label">Sort:</span>
              <div className="inline-select-container">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sub-filter-select"
                >
                  <option value="dueDate">Due Date</option>
                  <option value="title">Checklist Item</option>
                  <option value="priority">Priority</option>
                  <option value="assignee">Assignee</option>
                </select>
                <ChevronDownIcon width={10} height={10} className="sub-filter-chevron" />
              </div>

              <button
                type="button"
                className="btn-sort-dir"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                title="Toggle sort direction"
                style={{ background: "transparent", border: "none", color: "var(--dash-text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "2px 4px" }}
              >
                {sortOrder === "asc" ? (
                  <ArrowUpIcon width={12} height={12} />
                ) : (
                  <ArrowDownIcon width={12} height={12} />
                )}
              </button>
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
              <th className="th-item">CHECKLIST TASK</th>
              <th className="th-card">CARD &amp; BOARD</th>
              <th className="th-assignee">ASSIGNEE</th>
              <th className="th-due">
                <span className="th-sortable" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                  DUE DATE {sortOrder === 'asc' ? '↑' : '↓'}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const isChecked = item.state === "complete";
              const isSelected = selectedItemIds.has(item.id);
              const board = INITIAL_BOARDS.find((b) => b.id === item.boardId);
              const assignee = INITIAL_ASSIGNEES.find((u) => u.id === item.assigneeId);

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
                          <span>{item.checklistName}</span>
                          <span className="dot-divider">·</span>
                          <span className={`priority-tag ${priorityClass}`}>
                            {item.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Parent Card & Board */}
                  <td className="td-card">
                    <div className="parent-card-name" title={item.parentCardFull}>
                      {item.parentCard}
                    </div>
                    <div className="card-board-subline">
                      <span>{item.listName}</span>
                      <span className="dot-divider">·</span>
                      <span className="board-pill-tag">
                        <span className="board-dot" style={{ background: board?.color || "#10b981" }} />
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
                        <AlertCircleIcon width={13} height={13} />
                        <span>{item.dueDate}</span>
                      </div>
                    ) : item.state === "incomplete" && item.isDueToday ? (
                      <div className="due-status due-today-amber">
                        <CalendarIcon width={13} height={13} />
                        <span>Today</span>
                      </div>
                    ) : item.state === "complete" ? (
                      <div className="due-status completed-muted">
                        <CheckIcon width={13} height={13} />
                        <span>Done</span>
                      </div>
                    ) : (
                      <div className="due-status upcoming-normal">
                        <span>{item.dueDate}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={5} className="td-empty">
                  <div className="empty-state-box" style={{ padding: "40px 16px", textAlign: "center" }}>
                    <SlidersIcon width={28} height={28} style={{ color: "var(--dash-text-subtle)", margin: "0 auto 8px" }} />
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--dash-text-dark)", fontSize: "13px" }}>
                      No checklist tasks found
                    </p>
                    <p style={{ margin: "4px 0 0", color: "var(--dash-text-muted)", fontSize: "11.5px" }}>
                      Try clearing your search query or adjusting your filters.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================================================================
          FOOTER BAR
          ========================================================================= */}
      <footer className="dashboard-footer-bar">
        <div className="footer-left">
          {selectedItemIds.size > 0 ? (
            <div className="selection-actions-bar">
              <span className="selected-count-badge">{selectedItemIds.size} selected</span>
              <button
                type="button"
                className="btn-batch-action"
                onClick={() => {
                  setItems((prev) =>
                    prev.map((i) =>
                      selectedItemIds.has(i.id) ? { ...i, state: "complete", dueStatus: "Completed" } : i
                    )
                  );
                  setSelectedItemIds(new Set());
                  showToast("Selected items marked complete!");
                }}
              >
                Mark Complete
              </button>
              <button
                type="button"
                className="btn-batch-action secondary"
                onClick={() => setSelectedItemIds(new Set())}
              >
                Deselect
              </button>
            </div>
          ) : (
            <span className="footer-tip">Tip: Click checkboxes to check off tasks in real-time</span>
          )}
        </div>
        <div className="footer-right">
          <span className="footer-brand">
            Explified &bull;{" "}
            <a href="mailto:support@explified.com" className="footer-email">
              support@explified.com
            </a>
          </span>
        </div>
      </footer>

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
                      {INITIAL_BOARDS.map((b) => (
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
                      {INITIAL_ASSIGNEES.map((u) => (
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
