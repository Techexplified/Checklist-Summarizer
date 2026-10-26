/**
 * Fallback Trello PowerUp iframe client for local development & testing.
 * Automatically switches to window.TrelloPowerUp.iframe() when loaded inside Trello.
 */

const MOCK_BOARD_ID = "b_board_checklist_001";

const MOCK_LISTS = [
  { id: "list_1", name: "In Progress (Sprint 24)", pos: 1000 },
  { id: "list_2", name: "Code Review & QA", pos: 2000 },
  { id: "list_3", name: "Ready for Release", pos: 3000 },
  { id: "list_4", name: "Done / Completed", pos: 4000 },
];

const MOCK_MEMBERS = [
  {
    id: "m_1",
    fullName: "Elena Rostova",
    username: "elenarostova",
    initials: "ER",
    avatar: null,
  },
  {
    id: "m_2",
    fullName: "Marcus Ray",
    username: "marcusray",
    initials: "MR",
    avatar: null,
  },
  {
    id: "m_3",
    fullName: "Ava Sharma",
    username: "avasharma",
    initials: "AS",
    avatar: null,
  },
];

const MOCK_CARDS = [
  {
    id: "card_api_v2",
    name: "API v2 Auth & Rate Limiting Integration",
    desc: "Migrate public API endpoints to token-bucket rate limiting and Bearer auth validation.",
    idList: "list_1",
    idMembers: ["m_1"],
    due: "2026-10-25T18:00:00.000Z",
    dueComplete: false,
    url: "https://trello.com/c/mock-card-1",
    checklists: [
      {
        id: "cl_1",
        name: "Backend Security Checklist",
        pos: 1000,
        checkItems: [
          { id: "ci_1", name: "Add Redis-based token bucket middleware", state: "complete", pos: 100 },
          { id: "ci_2", name: "Validate JWT signature against JWKS endpoint", state: "complete", pos: 200 },
          { id: "ci_3", name: "Enforce CORS origin restrictions", state: "complete", pos: 300 },
          { id: "ci_4", name: "Add 429 Retry-After response headers", state: "incomplete", pos: 400 },
          { id: "ci_5", name: "Run OWASP automated vulnerability scan", state: "incomplete", pos: 500, due: "2026-10-20T12:00:00.000Z" }, // Overdue
        ],
      },
      {
        id: "cl_2",
        name: "Testing & Documentation",
        pos: 2000,
        checkItems: [
          { id: "ci_6", name: "Unit tests for rate limit headers (90%+ coverage)", state: "complete", pos: 100 },
          { id: "ci_7", name: "Update OpenAPI/Swagger 3.1 specification", state: "incomplete", pos: 200 },
          { id: "ci_8", name: "Share updated Postman collection with front-end team", state: "incomplete", pos: 300 },
        ],
      },
    ],
  },
  {
    id: "card_mobile_nav",
    name: "Mobile Responsive Navigation Polish",
    desc: "Refactor drawer menu animations and touch swipe gesture recognizers.",
    idList: "list_2",
    idMembers: ["m_2"],
    due: "2026-10-24T15:00:00.000Z",
    dueComplete: false,
    url: "https://trello.com/c/mock-card-2",
    checklists: [
      {
        id: "cl_3",
        name: "Cross-Device QA Matrix",
        pos: 1000,
        checkItems: [
          { id: "ci_9", name: "Test iOS Safari 17+ drawer transitions", state: "complete", pos: 100 },
          { id: "ci_10", name: "Test Android Chrome touch swipe bounce", state: "complete", pos: 200 },
          { id: "ci_11", name: "Verify iPad split screen responsive breakpoint", state: "incomplete", pos: 300 },
        ],
      },
    ],
  },
  {
    id: "card_onboarding_flow",
    name: "New User Onboarding Checklist & Tour",
    desc: "Interactive step-by-step product walkthrough modal and welcome email trigger.",
    idList: "list_3",
    idMembers: ["m_3"],
    due: "2026-10-26T20:00:00.000Z",
    dueComplete: false,
    url: "https://trello.com/c/mock-card-3",
    checklists: [
      {
        id: "cl_4",
        name: "Product Acceptance Criteria",
        pos: 1000,
        checkItems: [
          { id: "ci_12", name: "Welcome modal renders on first dashboard load", state: "complete", pos: 100 },
          { id: "ci_13", name: "Dismiss state persisted in member preferences", state: "complete", pos: 200 },
          { id: "ci_14", name: "Segment analytics event fired on step completion", state: "complete", pos: 300 },
          { id: "ci_15", name: "Copy review signed off by marketing lead", state: "complete", pos: 400 },
        ],
      },
    ],
  },
  {
    id: "card_db_migration",
    name: "PostgreSQL 16 Cluster Upgrade & Index Audit",
    desc: "Apply partition pruning and migrate cold archive tables.",
    idList: "list_1",
    idMembers: ["m_1", "m_2"],
    due: null,
    dueComplete: false,
    url: "https://trello.com/c/mock-card-4",
    checklists: [
      {
        id: "cl_5",
        name: "Migration Execution Plan",
        pos: 1000,
        checkItems: [
          { id: "ci_16", name: "Snapshot production database volume", state: "complete", pos: 100 },
          { id: "ci_17", name: "Dry-run migrations on staging read-replica", state: "complete", pos: 200 },
          { id: "ci_18", name: "Schedule 15min maintenance banner", state: "incomplete", pos: 300 },
          { id: "ci_19", name: "Run VACUUM ANALYZE across partitioned tables", state: "incomplete", pos: 400 },
          { id: "ci_20", name: "Verify latency on audit query log", state: "incomplete", pos: 500 },
        ],
      },
    ],
  },
];

export function getTrelloClient() {
  if (
    typeof window !== "undefined" &&
    window.TrelloPowerUp &&
    typeof window.TrelloPowerUp.iframe === "function"
  ) {
    try {
      const realClient = window.TrelloPowerUp.iframe();
      if (realClient && typeof realClient.board === "function") {
        return realClient;
      }
    } catch (e) {
      // Fallback handled cleanly
    }
  }

  // Fallback rich mock for local development & preview
  let mockComments = [];

  return {
    get: (scope, visibility, key) => {
      try {
        const val = localStorage.getItem(
          `cs_powerup_${scope}_${visibility}_${key}`
        );
        return Promise.resolve(val);
      } catch (e) {
        return Promise.resolve(null);
      }
    },
    set: (scope, visibility, key, val) => {
      try {
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        localStorage.setItem(
          `cs_powerup_${scope}_${visibility}_${key}`,
          serialized
        );
      } catch (e) {}
      return Promise.resolve();
    },
    remove: (scope, visibility, key) => {
      try {
        localStorage.removeItem(`cs_powerup_${scope}_${visibility}_${key}`);
      } catch (e) {}
      return Promise.resolve();
    },
    closeModal: () => Promise.resolve(),
    closePopup: () => Promise.resolve(),
    showCard: (cardId) => {
      const c = MOCK_CARDS.find((x) => x.id === cardId) || MOCK_CARDS[0];
      if (c && c.url) window.open(c.url, "_blank");
      return Promise.resolve();
    },
    navigate: (opts) => {
      if (opts && opts.url) window.open(opts.url, "_blank");
      return Promise.resolve();
    },
    popup: (opts) => {
      if (opts && opts.url) {
        window.open(opts.url, "_blank");
      }
    },
    modal: (opts) => {
      if (opts && opts.url) {
        window.open(opts.url, "_blank");
      }
    },
    card: (field) => {
      // Return first mock card, or specific field
      return Promise.resolve(MOCK_CARDS[0]);
    },
    cards: (field) => {
      return Promise.resolve(MOCK_CARDS);
    },
    lists: (field) => {
      return Promise.resolve(MOCK_LISTS);
    },
    board: (field) => {
      return Promise.resolve({
        id: MOCK_BOARD_ID,
        name: "Engineering Sprint & Product Delivery",
        url: "https://trello.com/b/sprint-eng",
        members: MOCK_MEMBERS,
      });
    },
    member: (field) => {
      return Promise.resolve(MOCK_MEMBERS[0]);
    },
    signUrl: (url) => url,
    getContext: () => ({
      board: MOCK_BOARD_ID,
      card: MOCK_CARDS[0].id,
    }),
  };
}

export { MOCK_CARDS, MOCK_LISTS, MOCK_MEMBERS, MOCK_BOARD_ID };
