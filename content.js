(() => {
  if (window.__autoclickLoaded) return;
  window.__autoclickLoaded = true;

  const POS_KEY = "pos_" + location.origin;
  let pos = null, running = false, timer = null, done = 0, total = 0;
  let marker = null, badge = null, picking = false, hotkey = "Ctrl+Shift+X";

  chrome.storage.local.get([POS_KEY, "hotkey"], (r) => {
    if (r[POS_KEY]) { pos = r[POS_KEY]; showMarker(); }
    if (r.hotkey) hotkey = r.hotkey;
  });
  chrome.storage.onChanged.addListener((c) => { if (c.hotkey) hotkey = c.hotkey.newValue; });

  function combo(e) {
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return null;
    const p = [];
    if (e.ctrlKey) p.push("Ctrl");
    if (e.altKey) p.push("Alt");
    if (e.shiftKey) p.push("Shift");
    if (e.metaKey) p.push("Meta");
    p.push(e.code.replace(/^Key/, "").replace(/^Digit/, ""));
    return p.join("+");
  }

  window.addEventListener("keydown", (e) => {
    if ((running || picking) && (combo(e) === hotkey || e.key === "Escape")) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (picking) cancelPick();
      stop();
    }
  }, true);

  function mk(css) {
    const d = document.createElement("div");
    d.style.cssText = css + ";position:fixed;z-index:2147483647;pointer-events:none;";
    document.documentElement.appendChild(d);
    return d;
  }

  function showMarker() {
    if (!pos) return;
    if (!marker) {
      marker = document.createElement("div");
      marker.style.cssText = "position:absolute;z-index:2147483647;pointer-events:none;width:16px;height:16px;margin:-8px 0 0 -8px;border:2px solid #e53935;border-radius:50%;background:rgba(229,57,53,.25);";
      document.documentElement.appendChild(marker);
    }
    marker.style.left = pos.x + "px";
    marker.style.top = pos.y + "px";
  }

  function updateBadge() {
    if (!running) { if (badge) { badge.remove(); badge = null; } return; }
    if (!badge) badge = mk("right:16px;bottom:16px;background:#212121;color:#fff;padding:10px 14px;border-radius:8px;font:13px sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.4)");
    badge.textContent = `AutoClick: ${done}${total ? "/" + total : ""} — durdur: ${hotkey}`;
  }

  // --- Konum seçme ---
  const swallow = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
  function onPickClick(e) {
    swallow(e);
    pos = { x: e.pageX, y: e.pageY };
    chrome.storage.local.set({ [POS_KEY]: pos });
    cancelPick();
    showMarker();
  }
  let pickStyle = null, pickBanner = null;
  function startPick() {
    picking = true;
    pickStyle = document.createElement("style");
    pickStyle.textContent = "*{cursor:crosshair !important}";
    document.documentElement.appendChild(pickStyle);
    pickBanner = mk("left:50%;top:16px;transform:translateX(-50%);background:#1976d2;color:#fff;padding:10px 18px;border-radius:8px;font:14px sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.4)");
    pickBanner.textContent = "Tıklanacak yeri seçmek için sayfada bir noktaya tıkla (iptal: Esc)";
    ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach((t) => window.addEventListener(t, swallow, true));
    window.addEventListener("click", onPickClick, true);
  }
  function cancelPick() {
    picking = false;
    if (pickStyle) { pickStyle.remove(); pickStyle = null; }
    if (pickBanner) { pickBanner.remove(); pickBanner = null; }
    ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach((t) => window.removeEventListener(t, swallow, true));
    window.removeEventListener("click", onPickClick, true);
  }

  // --- Tıklama ---
  function clickOnce() {
    const cx = pos.x - window.scrollX, cy = pos.y - window.scrollY;
    const el = document.elementFromPoint(cx, cy);
    if (!el) return;
    const o = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy,
                screenX: cx, screenY: cy, button: 0, buttons: 1 };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    if (el.focus) el.focus({ preventScroll: true });
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
    el.dispatchEvent(new MouseEvent("click", o));
  }

  function start(s) {
    if (!pos) return { ok: false, error: "Önce bir konum kaydet." };
    stop();
    const interval = Math.max(10, Number(s.interval) || 100);
    total = s.unlimited ? 0 : Math.max(1, Number(s.count) || 1);
    done = 0; running = true;
    const tick = () => {
      if (!running) return;
      clickOnce(); done++; updateBadge();
      if (total && done >= total) { stop(); return; }
      timer = setTimeout(tick, interval);
    };
    tick();
    return { ok: true };
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    updateBadge();
  }

  chrome.runtime.onMessage.addListener((m, _s, reply) => {
    if (m.type === "PICK") { startPick(); reply({ ok: true }); }
    else if (m.type === "START") reply(start(m.settings));
    else if (m.type === "STOP") { stop(); reply({ ok: true }); }
    else if (m.type === "STATUS") reply({ running, done, total, pos });
  });
})();
