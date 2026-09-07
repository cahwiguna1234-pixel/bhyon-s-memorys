/* ============================================================
   bhyon's memorys — dashboard logic
   ============================================================ */

const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const MEDIA_BUCKET = "memory-media";
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_MEDIA_TYPES = ["image/png", "image/jpeg", "video/mp4"];

let allEntries = [];
let editingId = null;   // null = creating new
let pendingDeleteId = null;

let currentMedia = { url: null, path: null, type: null }; // media already saved on the entry being edited
let selectedFile = null;    // newly chosen file, not uploaded yet
let removeMediaFlag = false; // true = clear existing media on save

const el = {
  loginScreen: document.getElementById("loginScreen"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  loginBtn: document.getElementById("loginBtn"),

  dashApp: document.getElementById("dashApp"),
  signOutBtn: document.getElementById("signOutBtn"),

  rows: document.getElementById("rows"),
  dashSearch: document.getElementById("dashSearch"),
  dashFilterYear: document.getElementById("dashFilterYear"),
  dashFilterCategory: document.getElementById("dashFilterCategory"),
  dashFilterType: document.getElementById("dashFilterType"),

  addMemoryBtn: document.getElementById("addMemoryBtn"),
  addStoryBtn: document.getElementById("addStoryBtn"),

  entryModalBackdrop: document.getElementById("entryModalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  entryForm: document.getElementById("entryForm"),
  entryId: document.getElementById("entryId"),
  entryType: document.getElementById("entryType"),
  entryTitle: document.getElementById("entryTitle"),
  entryDate: document.getElementById("entryDate"),
  entryCategory: document.getElementById("entryCategory"),
  entryContent: document.getElementById("entryContent"),
  entryContentLabel: document.getElementById("entryContentLabel"),
  entryMediaFile: document.getElementById("entryMediaFile"),
  mediaPreview: document.getElementById("mediaPreview"),
  mediaPreviewActions: document.getElementById("mediaPreviewActions"),
  removeMediaBtn: document.getElementById("removeMediaBtn"),
  cancelEntryBtn: document.getElementById("cancelEntryBtn"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  saveEntryBtn: document.getElementById("saveEntryBtn"),

  deleteModalBackdrop: document.getElementById("deleteModalBackdrop"),
  deleteCancelBtn: document.getElementById("deleteCancelBtn"),
  deleteModalCloseBtn: document.getElementById("deleteModalCloseBtn"),
  deleteConfirmBtn: document.getElementById("deleteConfirmBtn"),

  birthdayForm: document.getElementById("birthdayForm"),
  ownerName: document.getElementById("ownerName"),
  birthdayDate: document.getElementById("birthdayDate"),
  birthdayPreview: document.getElementById("birthdayPreview"),

  msgBadge: document.getElementById("msgBadge"),
  msgPanelSub: document.getElementById("msgPanelSub"),
  msgRows: document.getElementById("msgRows"),

  msgDeleteModalBackdrop: document.getElementById("msgDeleteModalBackdrop"),
  msgDeleteModalCloseBtn: document.getElementById("msgDeleteModalCloseBtn"),
  msgDeleteCancelBtn: document.getElementById("msgDeleteCancelBtn"),
  msgDeleteConfirmBtn: document.getElementById("msgDeleteConfirmBtn"),

  storyModalBackdrop: document.getElementById("storyModalBackdrop"),
  storyModalCloseBtn: document.getElementById("storyModalCloseBtn"),
  storyCanvas: document.getElementById("storyCanvas"),
  storyDownloadBtn: document.getElementById("storyDownloadBtn"),
  storyShareBtn: document.getElementById("storyShareBtn"),
};

/* ================= AUTH ================= */

db.auth.onAuthStateChange((_event, session) => {
  toggleAuthUI(!!session);
  if (session) bootDashboard();
});

(async function initAuth(){
  const { data: { session } } = await db.auth.getSession();
  toggleAuthUI(!!session);
  if (session) bootDashboard();
})();

function toggleAuthUI(isSignedIn){
  el.loginScreen.style.display = isSignedIn ? "none" : "flex";
  el.dashApp.classList.toggle("open", isSignedIn);
}

el.loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  el.loginError.textContent = "";
  el.loginBtn.disabled = true;
  el.loginBtn.textContent = "Memeriksa…";

  const { error } = await db.auth.signInWithPassword({
    email: el.loginEmail.value.trim(),
    password: el.loginPassword.value,
  });

  el.loginBtn.disabled = false;
  el.loginBtn.textContent = "Masuk";

  if (error){
    el.loginError.textContent = "Email atau kata sandi salah.";
    return;
  }
  el.loginPassword.value = "";
});

el.signOutBtn.addEventListener("click", async () => {
  await db.auth.signOut();
});

let dashboardBooted = false;
function bootDashboard(){
  if (dashboardBooted) return;
  dashboardBooted = true;
  loadEntries();
  loadBirthdaySettings();
  loadMessages();
}

/* ================= SIDEBAR NAV ================= */

document.querySelectorAll(".side-link[data-panel]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side-link[data-panel]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    document.getElementById(btn.dataset.panel).classList.add("active");
  });
});

/* ================= LOAD & RENDER ENTRIES ================= */

async function loadEntries(){
  const { data, error } = await db
    .from("memories")
    .select("*")
    .order("memory_date", { ascending: false });

  if (error){
    showToast(error.message, true);
    return;
  }
  allEntries = data || [];
  populateDashFilters();
  renderRows();
}

function populateDashFilters(){
  const years = new Set();
  const categories = new Set();
  allEntries.forEach(e => {
    years.add(new Date(e.memory_date + "T00:00:00").getFullYear());
    if (e.category) categories.add(e.category);
  });

  el.dashFilterYear.innerHTML = `<option value="">Semua tahun</option>` +
    [...years].sort((a,b) => b - a).map(y => `<option value="${y}">${y}</option>`).join("");

  el.dashFilterCategory.innerHTML = `<option value="">Semua kategori</option>` +
    [...categories].sort().map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
}

[el.dashSearch].forEach(i => i.addEventListener("input", debounce(renderRows, 150)));
[el.dashFilterYear, el.dashFilterCategory, el.dashFilterType].forEach(s => s.addEventListener("change", renderRows));

function getFilteredEntries(){
  const q = el.dashSearch.value.trim().toLowerCase();
  const yearVal = el.dashFilterYear.value;
  const catVal = el.dashFilterCategory.value;
  const typeVal = el.dashFilterType.value;

  return allEntries.filter(e => {
    const d = new Date(e.memory_date + "T00:00:00");
    if (yearVal && String(d.getFullYear()) !== yearVal) return false;
    if (catVal && e.category !== catVal) return false;
    if (typeVal && e.type !== typeVal) return false;
    if (q){
      const hay = `${e.title || ""} ${e.content || ""} ${e.category || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderRows(){
  const list = getFilteredEntries();

  if (!list.length){
    el.rows.innerHTML = `
      <div class="state-block">
        <h3>Belum ada entri</h3>
        <p>Tambahkan memory atau story pertama lewat tombol di atas.</p>
      </div>`;
    return;
  }

  el.rows.innerHTML = list.map(e => {
    const d = new Date(e.memory_date + "T00:00:00");
    const dateLabel = `${d.getDate()} ${MONTHS_ID[d.getMonth()].slice(0,3)}<br>${d.getFullYear()}`;
    const typeLabel = e.type === "story" ? "Story" : "Memory";
    const thumb = e.media_url
      ? (e.media_type === "video"
          ? `<video class="row-thumb" src="${escapeAttr(e.media_url)}" muted></video>`
          : `<img class="row-thumb" src="${escapeAttr(e.media_url)}" alt="" loading="lazy">`)
      : `<div class="row-thumb row-thumb-empty"></div>`;
    return `
      <div class="row" data-id="${e.id}">
        <div class="row-date">${dateLabel}</div>
        ${thumb}
        <div class="row-main">
          <div class="row-title">${escapeHtml(e.title)}</div>
          <div class="row-meta">
            <span class="tag tag-${e.type}">${typeLabel}</span>
            ${e.category ? `<span class="tag">${escapeHtml(e.category)}</span>` : ""}
          </div>
          ${e.content ? `<div class="row-excerpt">${escapeHtml(e.content)}</div>` : ""}
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${e.id}">Ubah</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${e.id}">Hapus</button>
        </div>
      </div>`;
  }).join("");
}

el.rows.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "edit") openEditModal(id);
  if (btn.dataset.action === "delete") openDeleteModal(id);
});

/* ================= ADD / EDIT MODAL ================= */

el.addMemoryBtn.addEventListener("click", () => openCreateModal("memory"));
el.addStoryBtn.addEventListener("click", () => openCreateModal("story"));

function openCreateModal(type){
  editingId = null;
  el.entryForm.reset();
  el.entryId.value = "";
  el.entryType.value = type;
  el.entryDate.value = todayIso();
  el.modalTitle.textContent = type === "story" ? "Tambah story" : "Tambah memory";
  el.entryContentLabel.textContent = type === "story" ? "Isi cerita" : "Detail memory";
  resetMediaState();
  openModal(el.entryModalBackdrop);
  el.entryTitle.focus();
}

function openEditModal(id){
  const e = allEntries.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  el.entryId.value = e.id;
  el.entryType.value = e.type;
  el.entryTitle.value = e.title || "";
  el.entryDate.value = e.memory_date;
  el.entryCategory.value = e.category || "";
  el.entryContent.value = e.content || "";
  el.modalTitle.textContent = e.type === "story" ? "Ubah story" : "Ubah memory";
  el.entryContentLabel.textContent = e.type === "story" ? "Isi cerita" : "Detail memory";

  selectedFile = null;
  removeMediaFlag = false;
  el.entryMediaFile.value = "";
  currentMedia = { url: e.media_url || null, path: e.media_path || null, type: e.media_type || null };
  if (currentMedia.url){
    renderMediaPreview(currentMedia.url, currentMedia.type);
  } else {
    clearMediaPreview();
  }

  openModal(el.entryModalBackdrop);
  el.entryTitle.focus();
}

function resetMediaState(){
  selectedFile = null;
  removeMediaFlag = false;
  currentMedia = { url: null, path: null, type: null };
  el.entryMediaFile.value = "";
  clearMediaPreview();
}

// Cancel add/edit memory
el.cancelEntryBtn.addEventListener("click", closeEntryModal);
el.modalCloseBtn.addEventListener("click", closeEntryModal);
el.entryModalBackdrop.addEventListener("click", (ev) => {
  if (ev.target === el.entryModalBackdrop) closeEntryModal();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape"){
    closeEntryModal();
    closeModal(el.deleteModalBackdrop);
  }
});

function closeEntryModal(){
  closeModal(el.entryModalBackdrop);
  el.entryForm.reset();
  editingId = null;
  resetMediaState();
}

/* ---- media file picking & preview ---- */

el.entryMediaFile.addEventListener("change", () => {
  const file = el.entryMediaFile.files[0];
  if (!file) return;

  if (!ALLOWED_MEDIA_TYPES.includes(file.type)){
    showToast("Format harus PNG, JPG, atau MP4.", true);
    el.entryMediaFile.value = "";
    return;
  }
  if (file.size > MAX_MEDIA_BYTES){
    showToast("Ukuran file maksimal 20MB.", true);
    el.entryMediaFile.value = "";
    return;
  }

  selectedFile = file;
  removeMediaFlag = false;
  renderMediaPreview(URL.createObjectURL(file), file.type.startsWith("video") ? "video" : "image");
});

el.removeMediaBtn.addEventListener("click", () => {
  selectedFile = null;
  removeMediaFlag = true;
  el.entryMediaFile.value = "";
  clearMediaPreview();
});

function renderMediaPreview(url, type){
  el.mediaPreview.innerHTML = type === "video"
    ? `<video src="${url}" controls></video>`
    : `<img src="${url}" alt="">`;
  el.mediaPreviewActions.classList.add("show");
}

function clearMediaPreview(){
  el.mediaPreview.innerHTML = "";
  el.mediaPreviewActions.classList.remove("show");
}

/* ---- upload / delete on supabase storage ---- */

async function uploadMedia(file, entryType){
  const ext = (file.name.split(".").pop() || (file.type === "video/mp4" ? "mp4" : "jpg")).toLowerCase();
  const path = `${entryType}/${crypto.randomUUID()}.${ext}`;

  const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = db.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return {
    url: data.publicUrl,
    path,
    mediaType: file.type.startsWith("video") ? "video" : "image",
  };
}

async function deleteMediaObject(path){
  if (!path) return;
  try { await db.storage.from(MEDIA_BUCKET).remove([path]); }
  catch (e) { /* best-effort cleanup, ignore failures */ }
}

el.entryForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  el.saveEntryBtn.disabled = true;
  let oldPathToDelete = null;

  try{
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error("Sesi login berakhir. Muat ulang halaman dan masuk lagi.");

    let mediaUrl = currentMedia.url;
    let mediaPath = currentMedia.path;
    let mediaType = currentMedia.type;

    if (selectedFile){
      el.saveEntryBtn.textContent = "Mengunggah…";
      const uploaded = await uploadMedia(selectedFile, el.entryType.value);
      if (currentMedia.path) oldPathToDelete = currentMedia.path;
      mediaUrl = uploaded.url;
      mediaPath = uploaded.path;
      mediaType = uploaded.mediaType;
    } else if (removeMediaFlag){
      if (currentMedia.path) oldPathToDelete = currentMedia.path;
      mediaUrl = null; mediaPath = null; mediaType = null;
    }

    const payload = {
      type: el.entryType.value,
      title: el.entryTitle.value.trim(),
      content: el.entryContent.value.trim() || null,
      category: el.entryCategory.value.trim() || null,
      memory_date: el.entryDate.value,
      media_url: mediaUrl,
      media_path: mediaPath,
      media_type: mediaType,
    };

    el.saveEntryBtn.textContent = "Menyimpan…";

    let error;
    if (editingId){
      ({ error } = await db.from("memories").update(payload).eq("id", editingId));
    } else {
      ({ error } = await db.from("memories").insert(payload));
    }
    if (error) throw error;

    if (oldPathToDelete) await deleteMediaObject(oldPathToDelete);

    showToast(editingId ? "Perubahan disimpan." : "Kenangan ditambahkan.");
    closeEntryModal();
    await loadEntries();
  } catch (err){
    showToast(err.message || "Gagal menyimpan.", true);
  } finally {
    el.saveEntryBtn.disabled = false;
    el.saveEntryBtn.textContent = "Simpan";
  }
});

/* ================= DELETE ================= */

function openDeleteModal(id){
  pendingDeleteId = id;
  openModal(el.deleteModalBackdrop);
}
el.deleteCancelBtn.addEventListener("click", () => { pendingDeleteId = null; closeModal(el.deleteModalBackdrop); });
el.deleteModalCloseBtn.addEventListener("click", () => { pendingDeleteId = null; closeModal(el.deleteModalBackdrop); });
el.deleteModalBackdrop.addEventListener("click", (ev) => {
  if (ev.target === el.deleteModalBackdrop){ pendingDeleteId = null; closeModal(el.deleteModalBackdrop); }
});

el.deleteConfirmBtn.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  const entry = allEntries.find(x => x.id === pendingDeleteId);

  el.deleteConfirmBtn.disabled = true;
  el.deleteConfirmBtn.textContent = "Menghapus…";

  const { error } = await db.from("memories").delete().eq("id", pendingDeleteId);

  el.deleteConfirmBtn.disabled = false;
  el.deleteConfirmBtn.textContent = "Hapus";

  if (error){
    showToast(error.message, true);
    return;
  }
  if (entry && entry.media_path) await deleteMediaObject(entry.media_path);

  showToast("Kenangan dihapus.");
  pendingDeleteId = null;
  closeModal(el.deleteModalBackdrop);
  await loadEntries();
});

/* ================= BIRTHDAY SETTINGS ================= */

async function loadBirthdaySettings(){
  const { data, error } = await db
    .from("vault_settings")
    .select("owner_name, birthday")
    .eq("id", 1)
    .maybeSingle();

  if (error) return;
  if (data){
    el.ownerName.value = data.owner_name || "";
    el.birthdayDate.value = data.birthday || "";
    updateBirthdayPreview(data.owner_name, data.birthday);
  }
}

el.birthdayForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const owner_name = el.ownerName.value.trim();
  const birthday = el.birthdayDate.value;
  const saveBtn = el.birthdayForm.querySelector("button[type=submit]");

  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan…";

  try{
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error("Sesi login berakhir. Muat ulang halaman dan masuk lagi.");

    const { error } = await db
      .from("vault_settings")
      .upsert({ id: 1, owner_name, birthday });
    if (error) throw error;

    showToast("Pengaturan ulang tahun disimpan.");
    updateBirthdayPreview(owner_name, birthday);
  } catch (err){
    showToast(err.message || "Gagal menyimpan pengaturan.", true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan pengaturan";
  }
});

function updateBirthdayPreview(name, birthday){
  if (!birthday){ el.birthdayPreview.innerHTML = ""; return; }

  const ownerLabel = escapeHtml(name || "Bhyon");
  const d = new Date(birthday + "T00:00:00");
  const dateLabel = `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;

  const today = new Date(); today.setHours(0,0,0,0);
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  const diffDays = Math.round((next - today) / 86400000);
  const turningAge = next.getFullYear() - d.getFullYear();

  const countdownLine = diffDays === 0
    ? `Hari ini ulang tahun <strong>${ownerLabel}</strong> yang ke-${turningAge}! 🎂`
    : `<strong>${diffDays} hari lagi</strong> menuju ulang tahun <strong>${ownerLabel}</strong> yang ke-${turningAge}.`;

  el.birthdayPreview.innerHTML = `
    ${countdownLine}
    <br><span style="color:var(--ink-mute); font-size:0.82em;">Tanggal lahir tersimpan: ${dateLabel} · ini juga yang tampil di hitung mundur halaman publik.</span>`;
}

/* ================= ANONYMOUS MESSAGES ================= */

let allMessages = [];
let pendingDeleteMsgId = null;
let activeStoryMessage = null;

async function loadMessages(){
  const { data, error } = await db
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error){
    // Table might not exist yet if the SQL setup hasn't been run — fail quietly on the panel.
    el.msgRows.innerHTML = `
      <div class="state-block">
        <h3>Belum bisa memuat pesan</h3>
        <p>${escapeHtml(error.message)}</p>
      </div>`;
    return;
  }
  allMessages = data || [];
  renderMessageRows();
  updateMsgBadge();
}

function updateMsgBadge(){
  const count = allMessages.length;
  if (!count){
    el.msgBadge.style.display = "none";
    el.msgPanelSub.textContent = "Pesan anonim yang dikirim orang lewat halaman vault publik.";
    return;
  }
  el.msgBadge.style.display = "";
  el.msgBadge.textContent = count > 99 ? "99+" : String(count);
  el.msgPanelSub.textContent = `${count} pesan tersimpan.`;
}

function renderMessageRows(){
  if (!allMessages.length){
    el.msgRows.innerHTML = `
      <div class="state-block">
        <h3>Belum ada pesan</h3>
        <p>Bagikan link vault ini supaya orang bisa kirim pesan anonim ke kamu.</p>
      </div>`;
    return;
  }

  el.msgRows.innerHTML = allMessages.map(m => {
    const d = new Date(m.created_at);
    const dateLabel = `${d.getDate()} ${MONTHS_ID[d.getMonth()].slice(0,3)} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    return `
      <div class="msg-row" data-id="${m.id}">
        <div class="msg-row-top">
          <div class="msg-row-date">${dateLabel}</div>
        </div>
        <div class="msg-row-text">${escapeHtml(m.content)}</div>
        <div class="msg-row-actions">
          <button class="btn btn-teal btn-sm" data-action="story" data-id="${m.id}">Buat story</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${m.id}">Hapus</button>
        </div>
      </div>`;
  }).join("");
}

el.msgRows.addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const message = allMessages.find(x => x.id === id);
  if (!message) return;

  if (btn.dataset.action === "delete") openMsgDeleteModal(id);
  if (btn.dataset.action === "story") openStoryModal(message);
});

/* ---- delete ---- */

function openMsgDeleteModal(id){
  pendingDeleteMsgId = id;
  openModal(el.msgDeleteModalBackdrop);
}
el.msgDeleteCancelBtn.addEventListener("click", () => { pendingDeleteMsgId = null; closeModal(el.msgDeleteModalBackdrop); });
el.msgDeleteModalCloseBtn.addEventListener("click", () => { pendingDeleteMsgId = null; closeModal(el.msgDeleteModalBackdrop); });
el.msgDeleteModalBackdrop.addEventListener("click", (ev) => {
  if (ev.target === el.msgDeleteModalBackdrop){ pendingDeleteMsgId = null; closeModal(el.msgDeleteModalBackdrop); }
});

el.msgDeleteConfirmBtn.addEventListener("click", async () => {
  if (!pendingDeleteMsgId) return;

  el.msgDeleteConfirmBtn.disabled = true;
  el.msgDeleteConfirmBtn.textContent = "Menghapus…";

  const { error } = await db.from("messages").delete().eq("id", pendingDeleteMsgId);

  el.msgDeleteConfirmBtn.disabled = false;
  el.msgDeleteConfirmBtn.textContent = "Hapus";

  if (error){
    showToast(error.message, true);
    return;
  }
  showToast("Pesan dihapus.");
  pendingDeleteMsgId = null;
  closeModal(el.msgDeleteModalBackdrop);
  await loadMessages();
});

/* ---- story image generator ---- */

function cssVar(name, fallback){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function wrapCanvasText(ctx, text, maxWidth){
  const paragraphs = text.split("\n");
  const lines = [];
  paragraphs.forEach(par => {
    const words = par.split(" ");
    let line = "";
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line){
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    lines.push(line);
  });
  return lines;
}

async function drawStoryCanvas(message){
  const canvas = el.storyCanvas;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const bg = cssVar("--surface", "#f6f1e7");
  const line = cssVar("--line", "#e3dbca");
  const ink = cssVar("--ink", "#211c14");
  const inkMute = cssVar("--ink-mute", "#8b8271");
  const gold = cssVar("--gold", "#b8862f");

  // background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = line;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // eyebrow label
  ctx.fillStyle = gold;
  ctx.font = "600 32px 'IBM Plex Sans', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PESAN ANONIM", W / 2, 260);

  // quote mark
  ctx.fillStyle = gold;
  ctx.font = "italic 160px 'Fraunces', serif";
  ctx.fillText("“", W / 2, 420);

  // message body, auto-sized to fit
  const maxWidth = W - 180;
  let fontSize = 76;
  let lines = [];
  ctx.textAlign = "center";
  do {
    ctx.font = `italic 500 ${fontSize}px 'Fraunces', serif`;
    lines = wrapCanvasText(ctx, message.content, maxWidth);
    if (lines.length * (fontSize * 1.3) < H - 900) break;
    fontSize -= 4;
  } while (fontSize > 34);

  ctx.fillStyle = ink;
  const lineHeight = fontSize * 1.32;
  const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, startY + i * lineHeight);
  });

  // footer branding
  ctx.fillStyle = ink;
  ctx.font = "italic 44px 'Fraunces', serif";
  ctx.fillText("bhyon's memorys", W / 2, H - 200);

  ctx.fillStyle = inkMute;
  ctx.font = "400 30px 'IBM Plex Sans', sans-serif";
  ctx.fillText("kirim pesanmu juga → link di bio", W / 2, H - 145);
}

function openStoryModal(message){
  activeStoryMessage = message;
  openModal(el.storyModalBackdrop);
  drawStoryCanvas(message);
}
el.storyModalCloseBtn.addEventListener("click", () => closeModal(el.storyModalBackdrop));
el.storyModalBackdrop.addEventListener("click", (ev) => {
  if (ev.target === el.storyModalBackdrop) closeModal(el.storyModalBackdrop);
});

function canvasToBlob(canvas){
  return new Promise(resolve => canvas.toBlob(resolve, "image/png", 1));
}

el.storyDownloadBtn.addEventListener("click", async () => {
  const blob = await canvasToBlob(el.storyCanvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pesan-story-${activeStoryMessage ? activeStoryMessage.id.slice(0,8) : Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

el.storyShareBtn.addEventListener("click", async () => {
  const blob = await canvasToBlob(el.storyCanvas);
  const file = new File([blob], "pesan-story.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })){
    try{
      await navigator.share({ files: [file], title: "Pesan anonim" });
    } catch (err){
      // user cancelled the share sheet — no need to show an error
    }
  } else {
    showToast("Berbagi langsung tidak didukung di perangkat ini — unduh gambarnya lalu upload manual.", true);
  }
});

/* ================= MODAL HELPERS ================= */

function openModal(backdrop){ backdrop.classList.add("open"); }
function closeModal(backdrop){ backdrop.classList.remove("open"); }

/* ================= UTIL ================= */

function todayIso(){
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeAttr(str){ return escapeHtml(str); }

let toastTimer;
function showToast(message, isError){
  const t = document.getElementById("toast");
  t.textContent = message;
  t.classList.toggle("error", !!isError);
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), isError ? 6000 : 2800);
  if (isError) console.error("[bhyon's memorys]", message);
}
