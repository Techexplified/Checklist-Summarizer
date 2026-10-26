// Single source of truth for member's Trello authentication token for Checklist Summarizer Power-Up.
//
// Stored in Trello's member-scoped private plugin storage:
// `t.set('member', 'private', 'token', token)`.
// It is scoped to that single member on the current board and cannot be read
// by any other board member. It is never stored on external servers.

export const APP_KEY =
  import.meta.env.VITE_TRELLO_APP_KEY || "3e288f2527bfbb6b61a6fcf3979917ef";
export const APP_NAME = "Checklist Summarizer Power-Up";

// Shared message tag validated by authorized.js and AuthPopup.jsx
export const AUTH_MESSAGE_SOURCE = "checklist-summarizer-powerup-auth";

const TOKEN_KEY = "token";

/**
 * Retrieves the stored token from Trello member-private storage with localStorage fallback.
 * @param {object} t - Trello Power-Up client instance
 * @returns {Promise<string|null>}
 */
export async function getToken(t) {
  let token = null;
  if (t && typeof t.get === "function") {
    try {
      token = await t.get("member", "private", TOKEN_KEY);
    } catch (e) {
      token = null;
    }
  }

  if (!token) {
    try {
      token = localStorage.getItem("trello_token");
      // If found in localStorage, backfill into Trello member storage for future calls
      if (token && t && typeof t.set === "function") {
        t.set("member", "private", TOKEN_KEY, token).catch(() => {});
      }
    } catch (e) {}
  }

  return token || null;
}

/**
 * Saves the authenticated token into Trello member-private storage and localStorage.
 * @param {object} t - Trello Power-Up client instance
 * @param {string} token - Trello member OAuth token
 * @returns {Promise<void>}
 */
export async function saveToken(t, token) {
  try {
    if (token) {
      localStorage.setItem("trello_token", token);
    } else {
      localStorage.removeItem("trello_token");
    }
  } catch (e) {}

  if (t && typeof t.set === "function") {
    try {
      await t.set("member", "private", TOKEN_KEY, token);
    } catch (e) {}
  }
}

/**
 * Clears the stored token from Trello member-private storage and localStorage.
 * @param {object} t - Trello Power-Up client instance
 * @returns {Promise<void>}
 */
export async function clearToken(t) {
  try {
    localStorage.removeItem("trello_token");
  } catch (e) {}

  if (t && typeof t.remove === "function") {
    try {
      await t.remove("member", "private", TOKEN_KEY);
    } catch (e) {}
  }
}

/**
 * Checks whether the member currently has an authorized token.
 * @param {object} t - Trello Power-Up client instance
 * @returns {Promise<boolean>}
 */
export async function isAuthorized(t) {
  const token = await getToken(t);
  return Boolean(token);
}

/**
 * Constructs the Trello OAuth authorization URL for Checklist Summarizer.
 * @param {string} returnUrl - Full URL to authorized.html on the current origin
 * @returns {string} Complete authorization URL
 */
export function buildAuthorizeUrl(returnUrl) {
  const params = new URLSearchParams({
    expiration: "never",
    name: APP_NAME,
    scope: "read,write",
    response_type: "token",
    key: APP_KEY || "",
    return_url: returnUrl,
  });

  return `https://trello.com/1/authorize?${params.toString()}`;
}
