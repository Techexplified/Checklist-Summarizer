/**
 * Service for analyzing, aggregating, and formatting Trello checklists
 * for single cards and board-wide views.
 */

/**
 * Computes comprehensive completion metrics and stats for a set of checklists.
 */
export function analyzeChecklists(checklists = [], cardTitle = "Card") {
  if (!Array.isArray(checklists) || checklists.length === 0) {
    return {
      cardTitle,
      totalChecklists: 0,
      totalItems: 0,
      completedItems: 0,
      incompleteItems: 0,
      percentComplete: 0,
      status: "Empty",
      statusColor: "#94a3b8",
      overdueCount: 0,
      overdueItems: [],
      categorized: [],
    };
  }

  const now = new Date();
  let totalItems = 0;
  let completedItems = 0;
  let overdueItems = [];

  const categorized = checklists.map((cl) => {
    const items = Array.isArray(cl.checkItems) ? cl.checkItems : [];
    const clTotal = items.length;
    const clCompleted = items.filter((it) => it.state === "complete").length;
    const clIncomplete = clTotal - clCompleted;
    const clPercent = clTotal > 0 ? Math.round((clCompleted / clTotal) * 100) : 0;

    totalItems += clTotal;
    completedItems += clCompleted;

    const analyzedItems = items.map((it) => {
      const isComplete = it.state === "complete";
      let isOverdue = false;
      if (!isComplete && it.due) {
        isOverdue = new Date(it.due) < now;
      }
      if (isOverdue) {
        overdueItems.push({
          ...it,
          checklistName: cl.name,
        });
      }
      return {
        id: it.id,
        name: it.name,
        state: it.state,
        isComplete,
        isOverdue,
        due: it.due || null,
        idMember: it.idMember || null,
      };
    });

    return {
      id: cl.id,
      name: cl.name || "Checklist",
      pos: cl.pos,
      total: clTotal,
      completed: clCompleted,
      incomplete: clIncomplete,
      percent: clPercent,
      items: analyzedItems,
    };
  });

  const incompleteItems = totalItems - completedItems;
  const percentComplete =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  let status = "In Progress";
  let statusColor = "#38bdf8"; // Sky blue

  if (totalItems === 0) {
    status = "No Items";
    statusColor = "#94a3b8";
  } else if (percentComplete === 100) {
    status = "All Complete";
    statusColor = "#10b981"; // Emerald
  } else if (overdueItems.length > 0) {
    status = "Overdue Items";
    statusColor = "#ef4444"; // Red
  } else if (percentComplete < 30) {
    status = "Just Started";
    statusColor = "#f59e0b"; // Amber
  }

  return {
    cardTitle,
    totalChecklists: checklists.length,
    totalItems,
    completedItems,
    incompleteItems,
    percentComplete,
    status,
    statusColor,
    overdueCount: overdueItems.length,
    overdueItems,
    categorized,
  };
}

/**
 * Creates an ASCII progress bar string (e.g. [████████░░] 80%).
 */
export function getAsciiProgressBar(percent, length = 12) {
  const filledCount = Math.round((percent / 100) * length);
  const emptyCount = Math.max(0, length - filledCount);
  return `[${"█".repeat(filledCount)}${"░".repeat(emptyCount)}] ${percent}%`;
}

/**
 * Generates clean, ready-to-paste or post Markdown for a card's checklist summary.
 */
export function generateMarkdownSummary(analysis, options = {}) {
  const { includeCompleted = true, includeOverdue = true } = options;
  const { cardTitle, percentComplete, totalItems, completedItems, categorized, overdueItems } = analysis;

  const bar = getAsciiProgressBar(percentComplete, 14);

  let md = `### 📋 Checklist Summary: **${cardTitle}**\n\n`;
  md += `**Overall Progress:** \`${bar}\` (${completedItems}/${totalItems} items completed)\n\n`;

  if (includeOverdue && overdueItems.length > 0) {
    md += `> ⚠️ **Attention:** ${overdueItems.length} checklist item(s) are currently overdue!\n\n`;
  }

  categorized.forEach((cl) => {
    const clBar = getAsciiProgressBar(cl.percent, 8);
    md += `#### ${cl.name} — \`${clBar}\` (${cl.completed}/${cl.total})\n`;

    cl.items.forEach((it) => {
      if (!includeCompleted && it.isComplete) return;

      const checkbox = it.isComplete ? "[x]" : "[ ]";
      let line = `- ${checkbox} ${it.name}`;
      if (it.isOverdue) {
        line += ` *(⚠️ Overdue: ${new Date(it.due).toLocaleDateString()})*`;
      }
      md += `${line}\n`;
    });

    md += "\n";
  });

  md += `*Generated with [Checklist Summarizer Power-Up](https://trello.com/power-ups)*\n`;
  return md;
}

/**
 * Generates an executive brief for busy teammates.
 */
export function generateExecutiveBrief(analysis) {
  const { totalItems, completedItems, incompleteItems, percentComplete, overdueCount } = analysis;

  if (totalItems === 0) {
    return "This card currently has no checklist items defined.";
  }

  if (percentComplete === 100) {
    return `🎉 All ${totalItems} checklist items have been verified and completed!`;
  }

  let brief = `Progress stands at ${percentComplete}% (${completedItems} of ${totalItems} tasks completed). `;
  brief += `There are ${incompleteItems} task(s) remaining.`;

  if (overdueCount > 0) {
    brief += ` ⚠️ Action required: ${overdueCount} task(s) have passed their due date.`;
  }

  return brief;
}

/**
 * Aggregates checklists across all cards on a board for the Board-level overview.
 */
export function analyzeBoardChecklists(cards = [], lists = []) {
  const listMap = {};
  lists.forEach((l) => {
    listMap[l.id] = l.name;
  });

  let totalBoardCardsWithChecklists = 0;
  let totalBoardItems = 0;
  let totalBoardCompleted = 0;
  let totalBoardOverdue = 0;

  const cardSummaries = cards
    .filter((c) => Array.isArray(c.checklists) && c.checklists.length > 0)
    .map((c) => {
      const analysis = analyzeChecklists(c.checklists, c.name);
      totalBoardCardsWithChecklists++;
      totalBoardItems += analysis.totalItems;
      totalBoardCompleted += analysis.completedItems;
      totalBoardOverdue += analysis.overdueCount;

      return {
        id: c.id,
        name: c.name,
        url: c.url,
        listId: c.idList,
        listName: listMap[c.idList] || "Unknown List",
        due: c.due,
        analysis,
      };
    });

  // Sort: lowest percent complete first (needing most attention)
  cardSummaries.sort((a, b) => a.analysis.percentComplete - b.analysis.percentComplete);

  const boardPercentComplete =
    totalBoardItems > 0
      ? Math.round((totalBoardCompleted / totalBoardItems) * 100)
      : 0;

  return {
    totalCardsWithChecklists: totalBoardCardsWithChecklists,
    totalItems: totalBoardItems,
    completedItems: totalBoardCompleted,
    incompleteItems: totalBoardItems - totalBoardCompleted,
    overdueCount: totalBoardOverdue,
    boardPercentComplete,
    cards: cardSummaries,
  };
}
