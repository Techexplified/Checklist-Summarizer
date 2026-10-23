/* global TrelloPowerUp */
import { isAuthorized } from "../lib/auth.js";

const ICON_URL =
  typeof window !== "undefined" && window.location.origin
    ? `${window.location.origin}/icons/icon.svg`
    : "./icons/icon.svg";

TrelloPowerUp.initialize({
  // Capability: Check authorization status
  "authorization-status": async function (t) {
    const authorized = await isAuthorized(t);
    return { authorized };
  },

  // Capability: Show authorization popup
  "show-authorization": function (t) {
    return t.popup({
      title: "Authorize Checklist Summarizer",
      url: "./auth.html",
      height: 350,
    });
  },

  // Capability: Show Power-Up settings
  "show-settings": function (t) {
    return t.popup({
      title: "Checklist Summarizer Settings",
      url: "./settings.html",
      height: 320,
    });
  },

  // Capability: Board header button for board-wide checklist dashboard
  "board-buttons": function () {
    return [
      {
        icon: {
          dark: ICON_URL,
          light: ICON_URL,
        },
        text: "Checklists Overview",
        callback: async function (t) {
          const authorized = await isAuthorized(t);
          if (!authorized) {
            return t.popup({
              title: "Authorize Checklist Summarizer",
              url: "./auth.html",
              height: 350,
            });
          }

          return t.modal({
            url: "./summarizer.html?view=board",
            accentColor: "#0f172a",
            height: 720,
            fullscreen: true,
            title: "Board Checklists Overview",
          });
        },
      },
    ];
  },

  // Capability: Card button to open the Checklist Summarizer modal
  "card-buttons": async function () {
    return [
      {
        icon: ICON_URL,
        text: "Checklist Summary",
        callback: async function (t) {
          const authorized = await isAuthorized(t);
          if (!authorized) {
            return t.popup({
              title: "Authorize Checklist Summarizer",
              url: "./auth.html",
              height: 350,
            });
          }

          let cardParam = "";
          try {
            const cardInfo = await t.card("id").catch(() => null);
            if (cardInfo && cardInfo.id) {
              cardParam = `?cardId=${encodeURIComponent(cardInfo.id)}`;
            }
          } catch (e) {}

          return t.modal({
            url: `./summarizer.html${cardParam}`,
            accentColor: "#0f172a",
            height: 680,
            fullscreen: false,
            title: "Checklist Summarizer",
          });
        },
      },
    ];
  },

  // Capability: Front-of-card badges showing checklist progress
  "card-badges": async function (t) {
    try {
      const card = await t.card("badges", "checklists").catch(() => null);
      if (!card) return [];

      let total = 0;
      let complete = 0;

      if (card.badges && typeof card.badges.checkItems === "number") {
        total = card.badges.checkItems;
        complete = card.badges.checkItemsChecked || 0;
      } else if (Array.isArray(card.checklists) && card.checklists.length > 0) {
        card.checklists.forEach((cl) => {
          if (Array.isArray(cl.checkItems)) {
            total += cl.checkItems.length;
            complete += cl.checkItems.filter((i) => i.state === "complete").length;
          }
        });
      }

      if (total === 0) return [];

      const percent = Math.round((complete / total) * 100);
      let color = "blue";
      if (percent === 100) {
        color = "green";
      } else if (percent < 40) {
        color = "yellow";
      }

      return [
        {
          text: `📋 ${complete}/${total} (${percent}%)`,
          icon: ICON_URL,
          color: color,
        },
      ];
    } catch (e) {
      return [];
    }
  },

  // Capability: Embeds checklist summary directly inside the card back
  "card-back-section": function (t) {
    let cardParam = "";
    try {
      const ctx = typeof t.getContext === "function" ? t.getContext() : null;
      if (ctx && ctx.card) {
        cardParam = `&cardId=${encodeURIComponent(ctx.card)}`;
      }
    } catch (e) {}

    return {
      title: "Checklist Summary",
      icon: ICON_URL,
      content: {
        type: "iframe",
        url: t.signUrl(`./summarizer.html?view=card-back-section${cardParam}`),
        height: 240,
      },
      action: {
        text: "Open Full Summary",
        callback: async function (t) {
          let cardParam = "";
          try {
            const cardInfo = await t.card("id").catch(() => null);
            if (cardInfo && cardInfo.id) {
              cardParam = `?cardId=${encodeURIComponent(cardInfo.id)}`;
            }
          } catch (e) {}

          return t.modal({
            url: `./summarizer.html${cardParam}`,
            accentColor: "#0f172a",
            height: 680,
            fullscreen: false,
            title: "Checklist Summarizer",
          });
        },
      },
    };
  },

  // Capability: Detail badge on card back
  "card-detail-badges": async function (t) {
    try {
      const card = await t.card("badges").catch(() => null);
      if (!card || !card.badges || !card.badges.checkItems) return [];

      const total = card.badges.checkItems;
      const complete = card.badges.checkItemsChecked || 0;
      const percent = Math.round((complete / total) * 100);

      return [
        {
          title: "Checklists",
          text: `${percent}% done (${complete}/${total})`,
          color: percent === 100 ? "green" : "blue",
          callback: function (t) {
            return t.modal({
              url: "./summarizer.html",
              accentColor: "#0f172a",
              height: 680,
              fullscreen: false,
              title: "Checklist Summarizer",
            });
          },
        },
      ];
    } catch (e) {
      return [];
    }
  },
});
