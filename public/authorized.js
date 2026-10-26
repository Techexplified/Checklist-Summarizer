(function () {
  // Trello OAuth redirects to this page with the token in the URL hash:
  // e.g. https://<domain>/authorized.html#token=ATTA...
  var hash = window.location.hash.substring(1);
  var params = new URLSearchParams(hash);
  var token = params.get("token");

  var titleEl = document.getElementById("status-title");
  var descEl = document.getElementById("status-desc");
  var spinnerContainer = document.getElementById("spinner-container");
  var statusPill = document.getElementById("status-pill");

  if (!token) {
    if (spinnerContainer) spinnerContainer.style.display = "none";
    if (titleEl) {
      titleEl.textContent = "Authorization Unsuccessful";
      titleEl.style.color = "#f87171";
    }
    if (descEl) {
      descEl.textContent =
        "No valid authorization token was returned from Trello. Please close this window and try again.";
      descEl.style.color = "#fca5a5";
    }
    if (statusPill) {
      statusPill.style.display = "none";
    }
    return;
  }

  // Remove the token from the browser address bar & history to prevent credential exposure
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, "", window.location.pathname);
  }

  // Store token in localStorage for cross-context persistence on this origin
  try {
    localStorage.setItem("trello_token", token);
    localStorage.setItem("trello_token_time", Date.now().toString());
  } catch (e) {}

  // Broadcast the token to any open tabs/iframes via BroadcastChannel
  try {
    var bc = new BroadcastChannel("checklist_summarizer_auth");
    bc.postMessage({
      source: "checklist-summarizer-powerup-auth",
      token: token,
    });
    setTimeout(function () {
      bc.close();
    }, 1000);
  } catch (e) {}

  // Post the token securely to the opener window if available
  if (window.opener) {
    try {
      window.opener.postMessage(
        {
          source: "checklist-summarizer-powerup-auth",
          token: token,
        },
        window.location.origin
      );
    } catch (e) {}
  }

  if (titleEl) titleEl.textContent = "Connection Successful!";
  if (descEl)
    descEl.textContent =
      "Checklist Summarizer Power-Up is now authorized with Trello. Closing window…";
  if (spinnerContainer) spinnerContainer.style.display = "none";

  // Attempt to close popup window automatically
  window.close();

  // In case browser policy prevents auto-close
  setTimeout(function () {
    if (descEl)
      descEl.textContent =
        "Authorization complete. You can close this window now.";
  }, 600);
})();
