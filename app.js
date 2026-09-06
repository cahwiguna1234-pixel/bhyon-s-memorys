/* ============================================================
   bhyon's memorys — public vault logic
   ============================================================ */

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

let allEntries = [];   // everything fetched from supabase
let filtered = [];     // after search + filters

const el = {
  timeline: document.getElementById("timeline"),
  search: document.getElementById("searchInput"),
  year: document.getElementById("filterYear"),
  month: document.getElementById("filterMonth"),
  category: document.getElementById("filterCategory"),
  type: document.getElementById("filterType"),
  resultLine: document.getElementById("resultLine"),
  countdownValue: document.getElementById("countdownValue"),
  countdownGrid: document.getElementById("countdownGrid"),
  countdownSub: document.getElementById("countdownSub"),
  cdDays: document.getElementById("cdDays"),
  cdHours: document.getElementById("cdHours"),
  cdMinutes: document.getElementById("cdMinutes"),
  cdSeconds: document.getElementById("cdSeconds"),
};

init();

async function init(){
  await Promise.all([loadEntries(), loadBirthday()]);
}

/* ---------------- data loading ---------------- */

async function loadEntries(){
  const { data, error } = await db
    .from("memories")
    .select("*")
    .order("memory_date", { ascending: false });

  if (error){
    renderError(error.message);
    return;
  }

  allEntries = data || [];
  populateFilterOptions();
  applyFilters();
}

async function loadBirthday(){
  const { data, error } = await db
    .from("vault_settings")
    .select("owner_name, birthday")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data || !data.birthday){
    el.countdownGrid.style.display = "none";
    el.countdownValue.style.display = "block";
    el.countdownValue.textContent = "—";
    el.countdownSub.textContent = "Tanggal lahir belum diatur.";
    return;
  }

  startCountdown(data.birthday, data.owner_name);
}

let countdownTimer;
function startCountdown(birthdayStr, ownerName){
  const bday = new Date(birthdayStr + "T00:00:00");
  const owner = ownerName || "Bhyon";

  const tick = () => {
    const now = new Date();
    const isToday = now.getMonth() === bday.getMonth() && now.getDate() === bday.getDate();

    if (isToday){
      const turningAge = now.getFullYear() - bday.getFullYear();
      el.countdownGrid.style.display = "none";
      el.countdownValue.style.display = "block";
      el.countdownValue.innerHTML = `Hari ini! <span>🎂</span>`;
      el.countdownSub.textContent = `${owner} genap ${turningAge} tahun`;
      return;
    }

    let next = new Date(now.getFullYear(), bday.getMonth(), bday.getDate(), 0, 0, 0, 0);
    if (next <= now) next = new Date(now.getFullYear() + 1, bday.getMonth(), bday.getDate(), 0, 0, 0, 0);
    const turningAge = next.getFullYear() - bday.getFullYear();

    let diff = next - now;
    const days = Math.floor(diff / 86400000); diff -= days * 86400000;
    const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
    const minutes = Math.floor(diff / 60000); diff -= minutes * 60000;
    const seconds = Math.floor(diff / 1000);

    el.countdownValue.style.display = "none";
    el.countdownGrid.style.display = "grid";
    el.cdDays.textContent = days;
    el.cdHours.textContent = String(hours).padStart(2, "0");
    el.cdMinutes.textContent = String(minutes).padStart(2, "0");
    el.cdSeconds.textContent = String(seconds).padStart(2, "0");
    el.countdownSub.textContent = `menuju usia ${turningAge} tahun · ${next.getDate()} ${MONTHS_ID[next.getMonth()]}`;
  };

  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
}

/* ---------------- filters ---------------- */

function populateFilterOptions(){
  const years = new Set();
  const categories = new Set();

  allEntries.forEach(e => {
    const d = new Date(e.memory_date + "T00:00:00");
    years.add(d.getFullYear());
    if (e.category) categories.add(e.category);
  });

  el.year.innerHTML = `<option value="">Semua tahun</option>` +
    [...years].sort((a,b) => b - a).map(y => `<option value="${y}">${y}</option>`).join("");

  el.month.innerHTML = `<option value="">Semua bulan</option>` +
    MONTHS_ID.map((m, i) => `<option value="${i}">${m}</option>`).join("");

  el.category.innerHTML = `<option value="">Semua kategori</option>` +
    [...categories].sort().map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
}

let searchDebounce;
el.search.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(applyFilters, 180);
});
[el.year, el.month, el.category, el.type].forEach(sel => sel.addEventListener("change", applyFilters));

function applyFilters(){
  const q = el.search.value.trim().toLowerCase();
  const yearVal = el.year.value;
  const monthVal = el.month.value;
  const catVal = el.category.value;
  const typeVal = el.type.value;

  filtered = allEntries.filter(e => {
    const d = new Date(e.memory_date + "T00:00:00");

    if (yearVal && String(d.getFullYear()) !== yearVal) return false;
    if (monthVal && String(d.getMonth()) !== monthVal) return false;
    if (catVal && e.category !== catVal) return false;
    if (typeVal && e.type !== typeVal) return false;

    if (q){
      const haystack = `${e.title || ""} ${e.content || ""} ${e.category || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  renderResultLine(q);
  renderTimeline();
}

function renderResultLine(q){
  const count = filtered.length;
  const hasActiveFilter = q || el.year.value || el.month.value || el.category.value || el.type.value;

  if (!hasActiveFilter){
    el.resultLine.textContent = count ? `${count} kenangan tersimpan` : "";
    return;
  }

  el.resultLine.innerHTML = `${count} hasil ditemukan &nbsp;·&nbsp; <button id="clearFilters">bersihkan filter</button>`;
  document.getElementById("clearFilters").addEventListener("click", () => {
    el.search.value = "";
    el.year.value = "";
    el.month.value = "";
    el.category.value = "";
    el.type.value = "";
    applyFilters();
  });
}

/* ---------------- rendering ---------------- */

function renderTimeline(){
  if (!filtered.length){
    el.timeline.classList.remove("timeline");
    el.timeline.innerHTML = `
      <div class="state-block">
        <h3>Belum ada kenangan yang cocok</h3>
        <p>Coba kata kunci lain, atau ubah filter yang sedang aktif.</p>
      </div>`;
    return;
  }
  el.timeline.classList.add("timeline");

  let html = "";
  let lastYear = null;

  filtered.forEach(e => {
    const d = new Date(e.memory_date + "T00:00:00");
    const year = d.getFullYear();
    if (year !== lastYear){
      html += `<div class="year-heading">${year}</div>`;
      lastYear = year;
    }
    html += renderEntry(e, d);
  });

  el.timeline.innerHTML = html;
}

function renderEntry(e, d){
  const dateLabel = `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
  const typeLabel = e.type === "story" ? "Story" : "Memory";

  return `
    <article class="entry" data-type="${e.type}">
      <div class="entry-head">
        <div>
          <div class="entry-date">${dateLabel}</div>
          <div class="entry-title">${escapeHtml(e.title)}</div>
        </div>
      </div>
      <div class="entry-tags">
        <span class="tag tag-${e.type}">${typeLabel}</span>
        ${e.category ? `<span class="tag">${escapeHtml(e.category)}</span>` : ""}
      </div>
      ${e.content ? `<div class="entry-body">${escapeHtml(e.content)}</div>` : ""}
      ${e.media_url ? renderMedia(e.media_url, e.media_type) : ""}
    </article>`;
}

function renderMedia(url, type){
  if (type === "video"){
    return `<video class="entry-media" src="${escapeAttr(url)}" controls preload="metadata"></video>`;
  }
  return `<img class="entry-media" src="${escapeAttr(url)}" alt="" loading="lazy" onerror="this.remove()">`;
}

function renderError(message){
  el.timeline.classList.remove("timeline");
  el.timeline.innerHTML = `
    <div class="state-block">
      <h3>Vault belum terhubung</h3>
      <p>${escapeHtml(message)}<br>Periksa SUPABASE_URL &amp; SUPABASE_ANON_KEY di js/supabase-config.js.</p>
    </div>`;
}

/* ---------------- helpers ---------------- */

function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str){ return escapeHtml(str); }