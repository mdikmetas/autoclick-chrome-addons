const $ = (id) => document.getElementById(id);
const DEFAULTS = { interval: 100, count: 10, unlimited: false, hotkey: "Ctrl+Shift+X" };

async function tab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}
async function send(msg) {
  const t = await tab();
  try {
    return await chrome.tabs.sendMessage(t.id, msg);
  } catch (e) {
    // İçerik betiği yüklü değilse (eklenti sonradan kurulduysa) elle enjekte et
    try {
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["content.js"] });
      return await chrome.tabs.sendMessage(t.id, msg);
    } catch (e2) {
      $("status").textContent = "Bu sayfada çalışmıyor (chrome:// sayfaları, Web Mağazası ve PDF desteklenmez). Normal bir web sitesinde dene.";
      return null;
    }
  }
}

function showPos(pos) {
  $("pos").textContent = pos ? `Konum: x=${Math.round(pos.x)}, y=${Math.round(pos.y)}` : "Konum: seçilmedi";
}
function toggleCount() { $("count").disabled = $("unlimited").checked; }

async function init() {
  const s = Object.assign({}, DEFAULTS, await chrome.storage.local.get(Object.keys(DEFAULTS)));
  $("interval").value = s.interval;
  $("count").value = s.count;
  $("unlimited").checked = s.unlimited;
  $("hotkey").value = s.hotkey;
  toggleCount();
  const st = await send({ type: "STATUS" });
  if (st) {
    showPos(st.pos);
    $("status").textContent = st.running ? `Çalışıyor: ${st.done}${st.total ? "/" + st.total : ""}` : "Hazır.";
  }
}

$("unlimited").addEventListener("change", toggleCount);

$("pick").addEventListener("click", async () => {
  const r = await send({ type: "PICK" });
  if (r) window.close(); // popup kapanır, sayfada istediğin yere tıkla
});

$("hotkey").addEventListener("keydown", (e) => {
  e.preventDefault();
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
  if (!(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) && e.key !== "Escape") {
    $("status").textContent = "Kısayol en az bir Ctrl/Alt/Shift içermeli."; return;
  }
  const p = [];
  if (e.ctrlKey) p.push("Ctrl");
  if (e.altKey) p.push("Alt");
  if (e.shiftKey) p.push("Shift");
  if (e.metaKey) p.push("Meta");
  p.push(e.code.replace(/^Key/, "").replace(/^Digit/, ""));
  const combo = p.join("+");
  $("hotkey").value = combo;
  chrome.storage.local.set({ hotkey: combo });
  $("status").textContent = "Kısayol kaydedildi: " + combo;
});

$("start").addEventListener("click", async () => {
  const settings = {
    interval: Number($("interval").value) || 100,
    count: Number($("count").value) || 1,
    unlimited: $("unlimited").checked,
    hotkey: $("hotkey").value
  };
  await chrome.storage.local.set(settings);
  const r = await send({ type: "START", settings });
  if (r && r.ok) window.close();
  else if (r) $("status").textContent = r.error;
});

$("stop").addEventListener("click", async () => {
  await send({ type: "STOP" });
  $("status").textContent = "Durduruldu.";
});

init();
