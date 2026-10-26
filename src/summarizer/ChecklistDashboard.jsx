import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  INITIAL_BOARDS,
  INITIAL_ASSIGNEES,
  INITIAL_CHECKLIST_ITEMS,
} from "../data/mockDashboardData.js";
import {
  isAuthorized,
  getToken,
  saveToken,
  clearToken,
  buildAuthorizeUrl,
  AUTH_MESSAGE_SOURCE,
} from "../lib/auth.js";
import {
  getBoardCardsWithChecklists,
  getBoardLists,
  getBoardMembers,
  updateCheckItemState,
  getCurrentMember,
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
  const [sortBy, setSortBy] = useState("dueDate"); // dueDate | title | priority | assignee | board | parentCard
  const [sortOrder, setSortOrder] = useState("asc"); // asc | desc
  const [groupBy, setGroupBy] = useState("none"); // none | board | priority

  // Refs & Row menu
  const searchInputRef = useRef(null);
  const [activeMenuRowId, setActiveMenuRowId] = useState(null);

  // Modals
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Settings & Authorization state
  const [authStatus, setAuthStatus] = useState("checking"); // checking | connected | unauthenticated
  const [currentMember, setCurrentMember] = useState(null);
  const [manualToken, setManualToken] = useState("");
  const [showManualToken, setShowManualToken] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false);

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

  // Reliable cross-browser clipboard copy with fallback for embedded iframes
  async function copyToClipboard(text) {
    if (!text) return false;
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn("navigator.clipboard.writeText failed in iframe, using execCommand fallback:", err);
      }
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "-9999px";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch (e) {
      console.error("execCommand copy failed:", e);
      return false;
    }
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

  // Check auth status
  const checkAuthStatus = useCallback(async () => {
    setAuthStatus("checking");
    try {
      const authed = await isAuthorized(t);
      if (!authed) {
        setAuthStatus("unauthenticated");
        setCurrentMember(null);
        return;
      }
      const member = await getCurrentMember(t).catch(() => null);
      if (member) {
        setCurrentMember(member);
      }
      setAuthStatus("connected");
    } catch (e) {
      setAuthStatus("unauthenticated");
      setCurrentMember(null);
    }
  }, [t]);

  // Auto-load on mount
  useEffect(() => {
    loadRealData();
    checkAuthStatus();
  }, [loadRealData, checkAuthStatus]);

  // Listen for popup auth messages from Trello authorization popup
  useEffect(() => {
    async function handleAuthMessage(event) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== AUTH_MESSAGE_SOURCE) return;
      if (event.data.token) {
        await saveToken(t, event.data.token);
        showToast("Connected to Trello successfully!");
        setAuthStatus("connected");
        setNeedsAuth(false);
        await checkAuthStatus();
        await loadRealData();
      }
    }
    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [t, loadRealData, checkAuthStatus]);

  // Keyboard shortcut: '/' focuses search input; 'Escape' closes modals & menus
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsAddTaskOpen(false);
        setIsExportOpen(false);
        setIsSettingsOpen(false);
        setPreviewItem(null);
        setActiveMenuRowId(null);
      }
    }
    function handleClickOutside() {
      setActiveMenuRowId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // Connect Trello handler
  function handleConnectTrello() {
    const returnUrl = `${window.location.origin}/authorized.html`;
    const authUrl = buildAuthorizeUrl(returnUrl);
    if (t && typeof t.popup === "function") {
      t.popup({
        title: "Authorize Checklist Summarizer",
        url: "./auth.html",
        height: 380,
      });
    } else {
      const width = 580;
      const height = 750;
      const screenWidth = window.screen?.availWidth || 1280;
      const screenHeight = window.screen?.availHeight || 800;
      const left = Math.max(0, Math.round((screenWidth - width) / 2));
      const top = Math.max(0, Math.round((screenHeight - height) / 2));
      window.open(
        authUrl,
        "trelloAuthPopup",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
    }
  }

  // Save manual token handler
  async function handleSaveManualToken(e) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    setIsSavingToken(true);
    try {
      await saveToken(t, manualToken.trim());
      showToast("Token saved! Loading live board data...");
      setManualToken("");
      setShowManualToken(false);
      setNeedsAuth(false);
      await checkAuthStatus();
      await loadRealData();
    } catch (err) {
      showToast("Failed to save token: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingToken(false);
    }
  }

  // Disconnect Trello handler
  async function handleDisconnectTrello() {
    await clearToken(t);
    setIsLive(false);
    setAuthStatus("unauthenticated");
    setCurrentMember(null);
    setItems(INITIAL_CHECKLIST_ITEMS);
    showToast("Disconnected from Trello.");
  }

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

  // Bulk Actions
  function handleBulkComplete() {
    setItems((prev) =>
      prev.map((it) => {
        if (!selectedItemIds.has(it.id)) return it;
        if (isLive && it._rawCardId && it._rawCheckItemId && it.state !== "complete") {
          updateCheckItemState(t, it._rawCardId, it._rawCheckItemId, "complete").catch(() => {});
        }
        return {
          ...it,
          state: "complete",
          dueStatus: "Completed",
        };
      })
    );
    showToast(`Marked ${selectedItemIds.size} task(s) as complete`);
    setSelectedItemIds(new Set());
  }

  function handleBulkIncomplete() {
    setItems((prev) =>
      prev.map((it) => {
        if (!selectedItemIds.has(it.id)) return it;
        if (isLive && it._rawCardId && it._rawCheckItemId && it.state !== "incomplete") {
          updateCheckItemState(t, it._rawCardId, it._rawCheckItemId, "incomplete").catch(() => {});
        }
        return {
          ...it,
          state: "incomplete",
          dueStatus: it.isOverdue ? "Overdue" : it.isDueToday ? "Today" : "Upcoming",
        };
      })
    );
    showToast(`Marked ${selectedItemIds.size} task(s) as incomplete`);
    setSelectedItemIds(new Set());
  }

  function handleBulkExportMarkdown() {
    const selected = filteredItems.filter((i) => selectedItemIds.has(i.id));
    if (selected.length === 0) return;
    let md = `### Selected Checklist Tasks (${selected.length})\n\n`;
    selected.forEach((item) => {
      const check = item.state === "complete" ? "[x]" : "[ ]";
      const assignee = assignees.find((u) => u.id === item.assigneeId)?.name || "Unassigned";
      md += `- ${check} **${item.title}** (${item.priority}) — *${item.parentCard}* [@${assignee}] — Due: ${item.dueDate}\n`;
    });
    copyToClipboard(md).then((ok) => {
      if (ok) showToast(`Copied ${selected.length} selected task(s) to clipboard as Markdown!`);
      else showToast("Unable to copy to clipboard.");
    });
  }

  // Column header click sort
  function handleHeaderSort(column) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
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
          valA = (a.title || "").toLowerCase();
          valB = (b.title || "").toLowerCase();
        } else if (sortBy === "priority") {
          const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          valA = rank[a.priority] || 0;
          valB = rank[b.priority] || 0;
        } else if (sortBy === "assignee") {
          const uA = assignees.find((u) => u.id === a.assigneeId)?.name || "";
          const uB = assignees.find((u) => u.id === b.assigneeId)?.name || "";
          valA = uA.toLowerCase();
          valB = uB.toLowerCase();
        } else if (sortBy === "parentCard") {
          valA = (a.parentCard || "").toLowerCase();
          valB = (b.parentCard || "").toLowerCase();
        } else if (sortBy === "board") {
          const bA = boards.find((b) => b.id === a.boardId)?.name || "";
          const bB = boards.find((b) => b.id === b.boardId)?.name || "";
          valA = bA.toLowerCase();
          valB = bB.toLowerCase();
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
  }, [items, searchQuery, statusFilter, boardFilter, assigneeFilter, dueFilter, sortBy, sortOrder, boards, assignees]);

  // Grouped items computation
  const groupedItems = useMemo(() => {
    if (groupBy === "none") return null;

    if (groupBy === "board") {
      const groupMap = {};
      boards.forEach((b) => {
        groupMap[b.id] = {
          id: b.id,
          title: b.name,
          icon: b.icon,
          color: b.color || "#388bfd",
          items: [],
        };
      });
      groupMap["_other"] = {
        id: "_other",
        title: "Other / Unassigned",
        icon: "cloud",
        color: "#8b949e",
        items: [],
      };

      filteredItems.forEach((item) => {
        if (groupMap[item.boardId]) {
          groupMap[item.boardId].items.push(item);
        } else {
          groupMap["_other"].items.push(item);
        }
      });

      return Object.values(groupMap).filter((g) => g.items.length > 0);
    }

    if (groupBy === "priority") {
      const priorityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
      const priorityConfigs = {
        CRITICAL: { title: "Critical Priority", color: "#f85149" },
        HIGH: { title: "High Priority", color: "#d29922" },
        MEDIUM: { title: "Medium Priority", color: "#388bfd" },
        LOW: { title: "Low Priority", color: "#8b949e" },
      };

      const groupMap = {};
      priorityOrder.forEach((p) => {
        groupMap[p] = {
          id: p,
          title: priorityConfigs[p].title,
          color: priorityConfigs[p].color,
          items: [],
        };
      });

      filteredItems.forEach((item) => {
        const p = item.priority || "MEDIUM";
        if (groupMap[p]) {
          groupMap[p].items.push(item);
        } else {
          groupMap["MEDIUM"].items.push(item);
        }
      });

      return priorityOrder.map((p) => groupMap[p]).filter((g) => g.items.length > 0);
    }

    return null;
  }, [filteredItems, groupBy, boards]);

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

    copyToClipboard(md).then((ok) => {
      if (ok) {
        showToast("Markdown summary copied to clipboard!");
        setIsExportOpen(false);
      } else {
        showToast("Unable to copy to clipboard.");
      }
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
              {isLive && (
                <span className="live-sync-chip" title="Real-time data synced from Trello board">
                  <span className="live-pulse-dot" />
                  <span>Live Sync ({items.length})</span>
                </span>
              )}
              {isLoading && (
                <span className="loading-sync-chip">
                  <span className="spin-icon"><RefreshCwIcon width={11} height={11} /></span>
                  <span>Syncing…</span>
                </span>
              )}
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

      {/* ── Optional Auth Alert Banner (Only when authorization is needed) ───────── */}
      {!isLoading && needsAuth && (
        <div className="auth-notice-banner">
          <div className="auth-notice-left">
            <AlertCircleIcon width={15} height={15} className="auth-notice-icon" />
            <span>Connect your Trello account to sync real checklists across your boards:</span>
          </div>
          <div className="auth-notice-actions">
            <button
              type="button"
              className="btn-auth-notice-connect"
              onClick={handleConnectTrello}
            >
              Connect Trello
            </button>
            <button
              type="button"
              className="btn-auth-notice-settings"
              onClick={() => setIsSettingsOpen(true)}
            >
              Settings
            </button>
          </div>
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
            <SlidersIcon width={15} height={15} className="metric-icon-muted" />
          </div>
          <div className="metric-value">{totalItems}</div>
          <div className="metric-subtext">Across synced cards</div>
        </div>

        {/* Card 2: Completion Rate */}
        <div className="metric-card">
          <div className="metric-card-top">
            <span className="metric-label">Completion</span>
            <CheckCircleIcon width={15} height={15} className="metric-icon-green" />
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
            <span className="metric-label">Pending</span>
            <ClockIcon width={15} height={15} className="metric-icon-blue" />
          </div>
          <div className="metric-value">{pendingCount}</div>
          <div className="metric-subtext">Require action</div>
        </div>

        {/* Card 4: Overdue */}
        <div className="metric-card card-overdue">
          <div className="metric-card-top">
            <span className="metric-label red">Overdue</span>
            <AlertTriangleIcon width={15} height={15} className="metric-icon-red" />
          </div>
          <div className="metric-value red">{overdueCount}</div>
          <div className="metric-subtext red">Past deadline</div>
        </div>

        {/* Card 5: Due Today */}
        <div className="metric-card card-due-today">
          <div className="metric-card-top">
            <span className="metric-label amber">Due Today</span>
            <CalendarIcon width={15} height={15} className="metric-icon-amber" />
          </div>
          <div className="metric-value amber">{dueTodayCount}</div>
          <div className="metric-subtext amber">Action needed</div>
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
            <SearchIcon width={14} height={14} className="search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search checklist tasks, cards, members... (/ to focus)"
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
            <LayersIcon width={14} height={14} style={{ color: "var(--text-muted)" }} />
            <select
              className="custom-select"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="none">Group: Flat Table</option>
              <option value="board">Group: By Board</option>
              <option value="priority">Group: By Priority</option>
            </select>
            <ChevronDownIcon width={11} height={11} className="select-chevron" />
          </div>

          {/* Sort Dropdown */}
          <div className="dropdown-control-wrapper">
            <ArrowUpDownIcon width={14} height={14} style={{ color: "var(--text-muted)" }} />
            <select
              className="custom-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="dueDate">Sort: Due Date</option>
              <option value="title">Sort: Checklist Item</option>
              <option value="parentCard">Sort: Parent Card</option>
              <option value="board">Sort: Board</option>
              <option value="priority">Sort: Priority</option>
              <option value="assignee">Sort: Assignee</option>
            </select>
            <ChevronDownIcon width={11} height={11} className="select-chevron" />
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
              <UserIcon width={13} height={13} className="filter-item-icon" />
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
              <th className="th-item th-sortable" onClick={() => handleHeaderSort("title")}>
                <span className="th-inner">
                  CHECKLIST ITEM
                  {sortBy === "title" && (
                    <span className="sort-arrow-active">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
              <th className="th-card th-sortable" onClick={() => handleHeaderSort("parentCard")}>
                <span className="th-inner">
                  PARENT CARD
                  {sortBy === "parentCard" && (
                    <span className="sort-arrow-active">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
              <th className="th-board th-sortable" onClick={() => handleHeaderSort("board")}>
                <span className="th-inner">
                  BOARD
                  {sortBy === "board" && (
                    <span className="sort-arrow-active">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
              <th className="th-assignee th-sortable" onClick={() => handleHeaderSort("assignee")}>
                <span className="th-inner">
                  ASSIGNEE
                  {sortBy === "assignee" && (
                    <span className="sort-arrow-active">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
              <th className="th-due th-sortable" onClick={() => handleHeaderSort("dueDate")}>
                <span className="th-inner">
                  DUE DATE
                  {sortBy === "dueDate" && (
                    <span className="sort-arrow-active">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  )}
                </span>
              </th>
              <th className="th-actions">
                <span className="th-inner">ACTIONS</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Helper function to render each item row */}
            {(() => {
              const renderTableRow = (item) => {
                const isChecked = item.state === "complete";
                const isSelected = selectedItemIds.has(item.id);
                const board = boards.find((b) => b.id === item.boardId);
                const assignee = assignees.find((u) => u.id === item.assigneeId);
                const isMenuOpen = activeMenuRowId === item.id;

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
                    } ${isMenuOpen ? "row-menu-active" : ""}`}
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

                        <div className={`row-menu-container ${isMenuOpen ? "menu-active" : ""}`}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            title="More options"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuRowId((prev) => (prev === item.id ? null : item.id));
                            }}
                          >
                            <MoreHorizontalIcon width={16} height={16} />
                          </button>

                          {isMenuOpen && (
                            <div
                              className="row-dropdown-menu"
                              ref={(el) => {
                                if (el) {
                                  const rect = el.getBoundingClientRect();
                                  if (rect.bottom > window.innerHeight - 12) {
                                    el.style.top = "auto";
                                    el.style.bottom = "100%";
                                    el.style.marginTop = "0";
                                    el.style.marginBottom = "5px";
                                  }
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="row-menu-item"
                                onClick={() => {
                                  toggleItemState(item.id);
                                  setActiveMenuRowId(null);
                                }}
                              >
                                <CheckIcon width={13} height={13} />
                                <span>{isChecked ? "Mark Incomplete" : "Mark Complete"}</span>
                              </button>

                              <button
                                type="button"
                                className="row-menu-item"
                                onClick={() => {
                                  setPreviewItem(item);
                                  setActiveMenuRowId(null);
                                }}
                              >
                                <EyeIcon width={13} height={13} />
                                <span>Inspect Details</span>
                              </button>

                              <button
                                type="button"
                                className="row-menu-item"
                                onClick={async () => {
                                  const ok = await copyToClipboard(item.title);
                                  if (ok) showToast("Task title copied!");
                                  else showToast("Unable to copy title.");
                                  setActiveMenuRowId(null);
                                }}
                              >
                                <CopyIcon width={13} height={13} />
                                <span>Copy Title</span>
                              </button>

                              <div className="row-menu-divider" />

                              <button
                                type="button"
                                className="row-menu-item"
                                onClick={async () => {
                                  const md = `- [${isChecked ? "x" : " "}] ${item.title} (${item.priority}) — *${item.parentCard}* Due: ${item.dueDate}`;
                                  const ok = await copyToClipboard(md);
                                  if (ok) showToast("Task Markdown copied!");
                                  else showToast("Unable to copy task.");
                                  setActiveMenuRowId(null);
                                }}
                              >
                                <CopyIcon width={13} height={13} />
                                <span>Copy Markdown</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              };

              // Grouped mode rendering
              if (groupedItems && groupedItems.length > 0) {
                return groupedItems.map((group) => {
                  const groupTotal = group.items.length;
                  const groupCompleted = group.items.filter((i) => i.state === "complete").length;
                  const groupPercent = groupTotal > 0 ? Math.round((groupCompleted / groupTotal) * 100) : 0;

                  return (
                    <React.Fragment key={group.id}>
                      <tr className="group-header-row">
                        <td colSpan={7}>
                          <div className="group-header-content">
                            <div className="group-header-left">
                              <span
                                className="group-color-dot"
                                style={{ background: group.color || "#388bfd" }}
                              />
                              <span className="group-badge-indicator">{group.title}</span>
                              <span className="group-badge-pill">{groupTotal} task{groupTotal !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="group-header-stats">
                              <span>{groupCompleted}/{groupTotal} done ({groupPercent}%)</span>
                              <div className="group-progress-bar-wrapper">
                                <div
                                  className="group-progress-fill"
                                  style={{ width: `${groupPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {group.items.map((item) => renderTableRow(item))}
                    </React.Fragment>
                  );
                });
              }

              // Flat mode rendering
              return filteredItems.map((item) => renderTableRow(item));
            })()}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={7} className="td-empty">
                  <div className="empty-state-box">
                    <SlidersIcon width={32} height={32} style={{ color: "#94a3b8", margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 600, color: "#e2e8f0", fontSize: "14px" }}>
                      No checklist tasks found
                    </p>
                    <p style={{ margin: "4px 0 0", color: "#8b949e", fontSize: "12px" }}>
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
          FLOATING BULK ACTIONS TOOLBAR
          ========================================================================= */}
      {selectedItemIds.size > 0 && (
        <div className="bulk-action-bar">
          <div className="bulk-info">
            <span className="bulk-badge">{selectedItemIds.size}</span>
            <span>task{selectedItemIds.size !== 1 ? "s" : ""} selected</span>
          </div>

          <div className="bulk-actions-btns">
            <button
              type="button"
              className="btn-bulk btn-bulk-complete"
              onClick={handleBulkComplete}
              title="Mark all selected as complete"
            >
              <CheckIcon width={13} height={13} />
              <span>Mark Complete</span>
            </button>

            <button
              type="button"
              className="btn-bulk btn-bulk-incomplete"
              onClick={handleBulkIncomplete}
              title="Mark all selected as incomplete"
            >
              <span>Mark Incomplete</span>
            </button>

            <button
              type="button"
              className="btn-bulk btn-bulk-export"
              onClick={handleBulkExportMarkdown}
              title="Copy markdown of selected tasks"
            >
              <CopyIcon width={13} height={13} />
              <span>Copy Markdown</span>
            </button>

            <button
              type="button"
              className="btn-bulk btn-bulk-clear"
              onClick={() => setSelectedItemIds(new Set())}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

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
          <div className="modal-dialog export-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <DownloadIcon width={17} height={17} style={{ color: "var(--blue)" }} />
                <h2 className="modal-title">Export Checklist Summary</h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsExportOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body export-modal-body">
              <p className="export-subtitle">
                Select your preferred export format for the active view (<strong>{filteredItems.length}</strong> task{filteredItems.length !== 1 ? "s" : ""}):
              </p>

              <div className="export-options-list">
                <button
                  type="button"
                  className="export-tile"
                  onClick={handleExportMarkdown}
                >
                  <div className="export-tile-icon-box icon-markdown">
                    <CopyIcon width={20} height={20} />
                  </div>
                  <div className="export-tile-text">
                    <div className="export-tile-title-row">
                      <span className="export-tile-title">Copy Markdown Report</span>
                      <span className="export-format-tag tag-md">Markdown</span>
                    </div>
                    <span className="export-tile-desc">
                      Ideal for pasting into Trello Card Comments or Slack/Teams updates.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className="export-tile"
                  onClick={handleExportCSV}
                >
                  <div className="export-tile-icon-box icon-csv">
                    <DownloadIcon width={20} height={20} />
                  </div>
                  <div className="export-tile-text">
                    <div className="export-tile-title-row">
                      <span className="export-tile-title">Download CSV Spreadsheet</span>
                      <span className="export-format-tag tag-csv">.CSV</span>
                    </div>
                    <span className="export-tile-desc">
                      Full dataset with item status, parent card, boards, and assignees.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setIsExportOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: TASK PREVIEW DETAILS / INSPECTOR
          ========================================================================= */}
      {previewItem && (() => {
        const board = boards.find((b) => b.id === previewItem.boardId);
        const assignee = assignees.find((u) => u.id === previewItem.assigneeId);
        const isCompleted = previewItem.state === "complete";

        return (
          <div className="modal-backdrop" onClick={() => setPreviewItem(null)}>
            <div className="modal-dialog inspector-dialog" onClick={(e) => e.stopPropagation()}>
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
                  <h2 className="modal-title" style={{ fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <EyeIcon width={16} height={16} style={{ color: "var(--blue)" }} />
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

              <div className="modal-body inspector-body">
                {/* Hero card with interactive checkbox and title */}
                <div className={`inspector-hero-card ${isCompleted ? "is-done" : ""}`}>
                  <button
                    type="button"
                    className={`item-toggle-circle ${isCompleted ? "done" : ""}`}
                    style={{ marginTop: "2px" }}
                    onClick={() => {
                      toggleItemState(previewItem.id);
                      setPreviewItem((prev) => ({
                        ...prev,
                        state: prev.state === "complete" ? "incomplete" : "complete",
                        dueStatus: prev.state === "complete" ? (prev.isOverdue ? "Overdue" : prev.isDueToday ? "Today" : "Upcoming") : "Completed",
                      }));
                    }}
                    title={isCompleted ? "Mark incomplete" : "Mark complete"}
                  >
                    {isCompleted && <CheckIcon width={11} height={11} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className={`inspector-task-title ${isCompleted ? "is-done" : ""}`}>
                      {previewItem.title}
                    </h3>
                  </div>
                </div>

                {/* Structured property cards */}
                <div className="preview-detail-grid">
                  {/* Status */}
                  <div className="preview-prop">
                    <div className="prop-header">
                      <ClockIcon width={13} height={13} className="prop-icon" />
                      <span className="prop-label">Status</span>
                    </div>
                    <div className="prop-val">
                      {isCompleted ? (
                        <span className="inspector-badge badge-completed">
                          <CheckCircleIcon width={12} height={12} />
                          Completed
                        </span>
                      ) : (
                        <span className="inspector-badge badge-pending">
                          <ClockIcon width={12} height={12} />
                          Incomplete / Pending
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="preview-prop">
                    <div className="prop-header">
                      <CalendarIcon width={13} height={13} className="prop-icon" />
                      <span className="prop-label">Due Date</span>
                    </div>
                    <div className="prop-val">
                      {isCompleted ? (
                        <span className="inspector-badge badge-upcoming">
                          <CalendarIcon width={12} height={12} />
                          {previewItem.dueDate || "No date"} ({previewItem.dueStatus || "Completed"})
                        </span>
                      ) : previewItem.isOverdue ? (
                        <span className="inspector-badge badge-overdue">
                          <AlertCircleIcon width={12} height={12} />
                          {previewItem.dueDate || "Overdue"} (Overdue)
                        </span>
                      ) : previewItem.isDueToday ? (
                        <span className="inspector-badge badge-today">
                          <CalendarIcon width={12} height={12} />
                          {previewItem.dueDate || "Today"} (Today)
                        </span>
                      ) : (
                        <span className="inspector-badge badge-upcoming">
                          <CalendarIcon width={12} height={12} />
                          {previewItem.dueDate || "No due date"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Parent Card */}
                  <div className="preview-prop">
                    <div className="prop-header">
                      <LayersIcon width={13} height={13} className="prop-icon" />
                      <span className="prop-label">Parent Card</span>
                    </div>
                    <div className="prop-val prop-text-highlight" title={previewItem.parentCardFull || previewItem.parentCard}>
                      {previewItem.parentCardFull || previewItem.parentCard || "—"}
                    </div>
                  </div>

                  {/* Checklist Name */}
                  <div className="preview-prop">
                    <div className="prop-header">
                      <SlidersIcon width={13} height={13} className="prop-icon" />
                      <span className="prop-label">Checklist Name</span>
                    </div>
                    <div className="prop-val">
                      {previewItem.checklistName || "Checklist"}
                    </div>
                  </div>

                  {/* Board */}
                  <div className="preview-prop">
                    <div className="prop-header">
                      <span
                        className="prop-color-dot"
                        style={{ background: board?.color || "#388bfd" }}
                      />
                      <span className="prop-label">Board</span>
                    </div>
                    <div className="prop-val">
                      {board?.name || "Current Board"}
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="preview-prop">
                    <div className="prop-header">
                      <UserIcon width={13} height={13} className="prop-icon" />
                      <span className="prop-label">Assignee</span>
                    </div>
                    <div className="prop-val">
                      {assignee ? (
                        <div className="assignee-wrapper">
                          <div
                            className="assignee-avatar"
                            style={{ background: assignee.bg || "#388bfd" }}
                          >
                            {assignee.initials || assignee.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="assignee-name">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="unassigned-text">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer inspector-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  title="Copy Markdown representation"
                  onClick={async () => {
                    const md = `- [${isCompleted ? "x" : " "}] ${previewItem.title} (${previewItem.priority}) — *${previewItem.parentCardFull || previewItem.parentCard}* Due: ${previewItem.dueDate}`;
                    const ok = await copyToClipboard(md);
                    if (ok) showToast("Task Markdown copied!");
                    else showToast("Unable to copy task.");
                  }}
                >
                  <CopyIcon width={13} height={13} />
                  <span>Copy Markdown</span>
                </button>

                <div className="inspector-actions-right">
                  <button
                    type="button"
                    className={isCompleted ? "btn-modal-secondary" : "btn-modal-success"}
                    onClick={() => {
                      toggleItemState(previewItem.id);
                      setPreviewItem((prev) => ({
                        ...prev,
                        state: prev.state === "complete" ? "incomplete" : "complete",
                        dueStatus: prev.state === "complete" ? (prev.isOverdue ? "Overdue" : prev.isDueToday ? "Today" : "Upcoming") : "Completed",
                      }));
                    }}
                  >
                    <CheckIcon width={13} height={13} />
                    <span>{isCompleted ? "Mark Incomplete" : "Mark as Done"}</span>
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
          </div>
        );
      })()}

      {/* =========================================================================
          MODAL: SETTINGS & TRELLO INTEGRATION
          ========================================================================= */}
      {isSettingsOpen && (
        <div className="modal-backdrop" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-dialog max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Power-Up Settings &amp; Integration</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSettingsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Account Status Card */}
              <div className="auth-status-card">
                {authStatus === "connected" ? (
                  <>
                    <div className="auth-member-row">
                      {currentMember?.avatarUrl ? (
                        <img
                          src={`${currentMember.avatarUrl}/50.png`}
                          alt={currentMember.fullName}
                          className="auth-member-avatar"
                        />
                      ) : (
                        <div className="auth-member-avatar">
                          {currentMember?.initials || "TR"}
                        </div>
                      )}
                      <div>
                        <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                          {currentMember?.fullName || "Trello Member"}
                        </strong>
                        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                          @{currentMember?.username || "authenticated"}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--green)", fontSize: "12px", fontWeight: "600", marginBottom: "8px" }}>
                      <CheckCircleIcon width={14} height={14} />
                      <span>Connected &amp; Authorized</span>
                    </div>

                    <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Live synchronization active. Checklist items and completion status sync with your board in real time.
                    </p>

                    <button
                      type="button"
                      className="btn-trello-disconnect"
                      onClick={handleDisconnectTrello}
                    >
                      Disconnect Account
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--amber)", fontSize: "13px", fontWeight: "700", marginBottom: "8px" }}>
                      <AlertCircleIcon width={16} height={16} />
                      <span>Not Connected to Trello</span>
                    </div>
                    <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.45 }}>
                      Authorize Checklist Summarizer to read live card checklists and check items directly from this Trello board.
                    </p>

                    <button
                      type="button"
                      className="btn-trello-connect"
                      onClick={handleConnectTrello}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffffff">
                        <path d="M19.5 2H4.5C3.12 2 2 3.12 2 4.5v15C2 20.88 3.12 22 4.5 22h15c1.38 0 2.5-1.12 2.5-2.5v-15C22 3.12 20.88 2 19.5 2zm-8.25 15.25c0 .41-.34.75-.75.75H6c-.41 0-.75-.34-.75-.75V6.75c0-.41.34-.75.75-.75h4.5c.41 0 .75.34.75.75v10.5zm7.5-5.25c0 .41-.34.75-.75.75h-4.5c-.41 0-.75-.34-.75-.75V6.75c0-.41.34-.75.75-.75h4.5c.41 0 .75.34.75.75V12z"/>
                      </svg>
                      <span>Connect Trello Account</span>
                    </button>
                  </>
                )}
              </div>

              {/* Manual Token Option */}
              <div style={{ marginTop: "12px" }}>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "var(--blue-hover)", fontSize: "12px", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  onClick={() => setShowManualToken((prev) => !prev)}
                >
                  {showManualToken ? "▲ Hide manual token entry" : "▼ Or enter Trello API token manually"}
                </button>

                {showManualToken && (
                  <form onSubmit={handleSaveManualToken} className="manual-token-card">
                    <label style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "block" }}>
                      Paste your Trello User Token:
                    </label>
                    <input
                      type="password"
                      className="manual-token-input"
                      placeholder="e.g. ATTA..."
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="submit"
                        disabled={isSavingToken || !manualToken.trim()}
                        className="btn-modal-primary"
                        style={{ padding: "6px 12px", fontSize: "12px", flex: 1 }}
                      >
                        {isSavingToken ? "Saving…" : "Save & Sync Board"}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Demo Mode Toggle */}
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--text-primary)", display: "block" }}>
                      Demo / Sample Data
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {isLive ? "Currently showing live Trello board data" : "Currently showing mock sprint sample data"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-light-action"
                    style={{ padding: "5px 10px", fontSize: "11px" }}
                    onClick={() => {
                      if (isLive) {
                        setIsLive(false);
                        setItems(INITIAL_CHECKLIST_ITEMS);
                        showToast("Loaded demo sample dataset.");
                      } else {
                        loadRealData();
                      }
                    }}
                  >
                    {isLive ? "Load Demo Data" : "Refresh Board"}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setIsSettingsOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="dashboard-toast">
          <CheckCircleIcon width={15} height={15} style={{ color: "var(--green)" }} />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
