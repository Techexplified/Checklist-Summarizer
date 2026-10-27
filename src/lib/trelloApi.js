// Lightweight client for Trello REST API (https://api.trello.com/1).
// Authenticates with the member's private token stored in the Power-Up.

import { APP_KEY, getToken, clearToken } from "./auth.js";

export const NOT_AUTHORIZED = "NOT_AUTHORIZED";

/**
 * Executes an authenticated request against the Trello REST API.
 * Automatically clears the local token if the API returns 401.
 */
export async function apiFetch(
  t,
  path,
  { method = "GET", params = {}, body = null, headers = {} } = {}
) {
  const token = await getToken(t);
  if (!token) {
    throw new Error(NOT_AUTHORIZED);
  }

  const url = new URL(`https://api.trello.com/1${path}`);
  url.searchParams.set("key", APP_KEY);
  url.searchParams.set("token", token);

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, v);
    }
  }

  const fetchOptions = {
    method,
    headers: {
      ...headers,
    },
  };

  if (body) {
    if (typeof body === "object" && !(body instanceof FormData)) {
      fetchOptions.headers["Content-Type"] = "application/json";
      fetchOptions.body = JSON.stringify(body);
    } else {
      fetchOptions.body = body;
    }
  }

  const res = await fetch(url.toString(), fetchOptions);

  if (res.status === 401) {
    await clearToken(t);
    throw new Error(NOT_AUTHORIZED);
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `Trello API error ${res.status}: ${errorText || res.statusText}`
    );
  }

  return res.status === 204 ? null : res.json();
}

/**
 * Fetches the currently authenticated Trello member's profile.
 */
export function getCurrentMember(t) {
  return apiFetch(t, "/members/me", {
    params: {
      fields: "id,username,fullName,avatarUrl,initials",
    },
  });
}

/**
 * Disconnects the member from Checklist Summarizer by clearing the stored token.
 */
export async function disconnectMember(t) {
  await clearToken(t);
}

/**
 * Fetches all checklists on a specific card.
 * @param {object} t - Trello Power-Up client
 * @param {string} cardId - Card ID
 */
export function getCardChecklists(t, cardId) {
  return apiFetch(t, `/cards/${cardId}/checklists`, {
    params: {
      checkItems: "all",
      checkItem_fields: "name,state,pos,due,idMember",
      fields: "name,pos,idCard",
    },
  });
}

/**
 * Fetches cards on a Trello board with embedded checklists.
 * @param {object} t - Trello Power-Up client
 * @param {string} boardId - Board ID
 */
export function getBoardCardsWithChecklists(t, boardId) {
  return apiFetch(t, `/boards/${boardId}/cards`, {
    params: {
      filter: "visible",
      fields: "id,name,desc,idList,idMembers,due,dueComplete,badges,url,closed",
      checklists: "all",
      checklist_fields: "name,pos,idCard",
      checkItem_fields: "name,state,pos,due,idMember",
    },
  });
}

/**
 * Fetches lists on a Trello board.
 */
export function getBoardLists(t, boardId) {
  return apiFetch(t, `/boards/${boardId}/lists`, {
    params: {
      filter: "open",
      fields: "id,name,pos,closed",
    },
  });
}

/**
 * Posts a formatted markdown summary as a comment to a Trello card.
 * @param {object} t - Trello Power-Up client
 * @param {string} cardId - Target card ID
 * @param {string} commentText - Markdown formatted summary
 */
export function postCardComment(t, cardId, commentText) {
  return apiFetch(t, `/cards/${cardId}/actions/comments`, {
    method: "POST",
    params: {
      text: commentText,
    },
    body: { text: commentText },
  });
}

/**
 * Updates a check item state ('complete' | 'incomplete') directly from the summary UI.
 */
export function updateCheckItemState(t, cardId, checkItemId, state) {
  return apiFetch(t, `/cards/${cardId}/checkItem/${checkItemId}`, {
    method: "PUT",
    params: {
      state: state, // 'complete' or 'incomplete'
    },
  });
}

/**
 * Fetches members on a Trello board.
 */
export function getBoardMembers(t, boardId) {
  return apiFetch(t, `/boards/${boardId}/members`, {
    params: {
      fields: "id,fullName,username,initials,avatarUrl",
    },
  });
}

/**
 * Creates a new check item in a checklist on Trello.
 */
export function createCheckItem(t, checklistId, name, { due = null, idMember = null } = {}) {
  const params = { name };
  if (due) params.due = due;
  if (idMember) params.idMember = idMember;
  return apiFetch(t, `/checklists/${checklistId}/checkItems`, {
    method: "POST",
    params,
  });
}

/**
 * Creates a new checklist on a Trello card.
 */
export function createCardChecklist(t, cardId, name = "Checklist") {
  return apiFetch(t, `/cards/${cardId}/checklists`, {
    method: "POST",
    params: { name },
  });
}

/**
 * Creates a new card in a specified Trello list.
 */
export function createCard(t, idList, name, { desc = "", due = null, idMembers = [] } = {}) {
  const params = { idList, name };
  if (desc) params.desc = desc;
  if (due) params.due = due;
  if (Array.isArray(idMembers) && idMembers.length > 0) {
    params.idMembers = idMembers.join(",");
  } else if (typeof idMembers === "string" && idMembers.trim()) {
    params.idMembers = idMembers;
  }
  return apiFetch(t, "/cards", {
    method: "POST",
    params,
  });
}
