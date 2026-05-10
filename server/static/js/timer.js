/*
 * Live countdown for the index page.
 *
 * Polls /api/timer every 30s for the current target. The countdown itself
 * ticks every second client-side (no extra server load). Server returns
 * `target_time` in ISO-8601 (UTC); we compare against Date.now().
 *
 * Designed to be drop-in: include the script and add a <div id="countdown">
 * to your template.
 */
(function () {
  "use strict";

  const POLL_MS = 30_000;
  const TICK_MS = 1_000;

  const root = document.getElementById("countdown");
  if (!root) return;

  const labelEl = root.querySelector(".countdown-label");
  const timeEl  = root.querySelector(".countdown-time");
  const subEl   = root.querySelector(".countdown-sub");

  let target = null;          // Date | null
  let label = "";
  let isActive = false;

  function pad(n) { return String(n).padStart(2, "0"); }

  function format(ms) {
    if (ms <= 0) return "00:00";
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function render() {
    if (!isActive || !target) {
      labelEl.textContent = "Kein aktiver Timer";
      timeEl.textContent = "––:––";
      timeEl.classList.remove("fired");
      subEl.textContent = "Sobald der Admin einen Timer setzt, läuft er hier live.";
      return;
    }

    labelEl.textContent = label || "Nächstes Spiel";
    const remaining = target.getTime() - Date.now();

    if (remaining <= 0) {
      timeEl.textContent = "ES GEHT LOS!";
      timeEl.classList.add("fired");
      subEl.textContent = "";
    } else {
      timeEl.textContent = format(remaining);
      timeEl.classList.remove("fired");
      subEl.textContent = `Zielzeit: ${target.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
    }
  }

  async function refresh() {
    try {
      const res = await fetch("/api/timer", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error("api error");
      const data = await res.json();
      isActive = !!data.is_active && !!data.target_time;
      label = data.label || "";
      target = data.target_time ? new Date(data.target_time) : null;
    } catch (_) {
      // Network blip → keep previous state. Don't blank the UI.
    }
    render();
  }

  // Initial fetch + ticking.
  refresh();
  setInterval(render, TICK_MS);
  setInterval(refresh, POLL_MS);
})();
