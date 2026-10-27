/* Hostile Ground Training Academy — public class listings.
   Content is loaded from academy-sessions.json. No client-side reservations are collected. */
(() => {
  "use strict";
  const container = document.getElementById("academy-session-list");
  const empty = document.getElementById("academy-empty");
  if (!container || !empty) return;

  const levels = {
    foundation: "Level I / Foundation",
    development: "Level II / Development",
    advanced: "Level III / Advanced"
  };
  const statuses = {
    interest: "Discord interest open — organizer confirmation required",
    full: "Class full — contact organizers for further information",
    closed: "Enrollment closed"
  };

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  }

  function approvedDiscordLink(raw) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") return null;
      if (url.hostname === "discord.com" && /^\/events\/\d+\/\d+\/?$/.test(url.pathname)) return url.href;
      if (url.hostname === "discord.gg" && /^\/[^/]+\/?$/.test(url.pathname) && /^\d+$/.test(url.searchParams.get("event") || "")) return url.href;
    } catch (_) { /* Invalid link, omit session. */ }
    return null;
  }

  function validSession(s) {
    if (!s || typeof s !== "object") return false;
    const fields = ["title", "level", "startAt", "endAt", "timeZone", "location", "description", "prerequisites", "eventUrl", "status"];
    if (!fields.every(k => typeof s[k] === "string" && s[k].trim())) return false;
    if (!levels[s.level] || !statuses[s.status] || !approvedDiscordLink(s.eventUrl)) return false;
    const start = new Date(s.startAt);
    const end = new Date(s.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return false;
    // Require an explicit UTC offset to avoid ambiguous local-time parsing.
    if (!/[+-]\d\d:\d\d$/.test(s.startAt) || !/[+-]\d\d:\d\d$/.test(s.endAt)) return false;
    try { new Intl.DateTimeFormat("en-US", { timeZone: s.timeZone }); }
    catch (_) { return false; }
    if (s.capacity !== undefined && (!Number.isInteger(s.capacity) || s.capacity < 1)) return false;
    return true;
  }

  function addDetail(dl, label, detail) {
    dl.append(element("dt", "", label), element("dd", "", detail));
  }

  function renderSession(s) {
    const card = element("article", "academy-session-card");
    card.appendChild(element("span", "tag", levels[s.level]));
    card.appendChild(element("h3", "", s.title));
    card.appendChild(element("p", "", s.description));

    const opts = { timeZone: s.timeZone };
    const start = new Date(s.startAt), end = new Date(s.endAt);
    const dateFmt = new Intl.DateTimeFormat("en-US", { ...opts, weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const timeFmt = new Intl.DateTimeFormat("en-US", { ...opts, hour: "numeric", minute: "2-digit" });
    const tzFmt = new Intl.DateTimeFormat("en-US", { ...opts, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const startDay = dateFmt.format(start), endDay = dateFmt.format(end);
    const when = startDay === endDay
      ? startDay + " · " + timeFmt.format(start) + "–" + tzFmt.format(end)
      : startDay + " " + timeFmt.format(start) + " – " + endDay + " " + tzFmt.format(end);

    const dl = element("dl");
    addDetail(dl, "When", when);
    addDetail(dl, "Where", s.location);
    addDetail(dl, "Prerequisites", s.prerequisites);
    addDetail(dl, "Enrollment", statuses[s.status]);
    if (s.capacity !== undefined) addDetail(dl, "Planned capacity", s.capacity + " participants (confirm availability with organizers)");
    card.appendChild(dl);

    const link = element("a", "button secondary", "View Discord Class Event ↗");
    link.href = approvedDiscordLink(s.eventUrl);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.appendChild(link);
    return card;
  }

  fetch("academy-sessions.json", { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error("Unable to load Academy session data");
      return response.json();
    })
    .then(data => {
      if (!data || data.schemaVersion !== 1 || !Array.isArray(data.sessions)) throw new Error("Unsupported Academy session data");
      if (!data.sessions.length) return; // Preserve the accessible empty-state notice.
      if (!data.sessions.every(validSession)) throw new Error("Incomplete Academy session listing");
      const sorted = [...data.sessions].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
      const fragment = document.createDocumentFragment();
      for (const s of sorted) fragment.appendChild(renderSession(s));
      container.replaceChildren(fragment);
      empty.hidden = true;
    })
    .catch(error => {
      console.error("Training Academy:", error);
      empty.textContent = "Training session listings are temporarily unavailable. Check the official Hostile Ground Discord for class announcements.";
    });
})();
