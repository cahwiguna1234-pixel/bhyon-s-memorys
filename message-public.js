/* ============================================================
   bhyon's memorys — anonymous messages (public/index side)
   Sends anonymous messages into the `messages` table so they
   show up in the dashboard's "Pesan" panel.
   Requires `db` (supabase client) to already exist — created
   by supabase-config.js, loaded before this file.
   ============================================================ */

(function () {
  const MAX_LEN = 500;

  const msgEl = {
    openBtn: document.getElementById("openMsgBtn"),
    backdrop: document.getElementById("msgModalBackdrop"),
    closeBtn: document.getElementById("msgModalCloseBtn"),
    cancelBtn: document.getElementById("msgCancelBtn"),
    form: document.getElementById("msgForm"),
    content: document.getElementById("msgContent"),
    count: document.getElementById("msgCount"),
    error: document.getElementById("msgError"),
    sendBtn: document.getElementById("msgSendBtn"),
    formWrap: document.getElementById("msgFormWrap"),
    sentWrap: document.getElementById("msgSentWrap"),
    closeAfterSendBtn: document.getElementById("msgCloseAfterSendBtn"),
  };

  // Bail quietly if this page doesn't have the message widget.
  if (!msgEl.openBtn || !msgEl.backdrop || !msgEl.form) return;

  function openMsgModal() {
    msgEl.formWrap.style.display = "";
    msgEl.sentWrap.style.display = "none";
    msgEl.form.reset();
    msgEl.error.textContent = "";
    updateCount();
    msgEl.backdrop.classList.add("open");
    setTimeout(() => msgEl.content.focus(), 50);
  }

  function closeMsgModal() {
    msgEl.backdrop.classList.remove("open");
  }

  msgEl.openBtn.addEventListener("click", openMsgModal);
  msgEl.closeBtn.addEventListener("click", closeMsgModal);
  msgEl.cancelBtn.addEventListener("click", closeMsgModal);
  msgEl.closeAfterSendBtn.addEventListener("click", closeMsgModal);
  msgEl.backdrop.addEventListener("click", (ev) => {
    if (ev.target === msgEl.backdrop) closeMsgModal();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && msgEl.backdrop.classList.contains("open")) closeMsgModal();
  });

  function updateCount() {
    const len = msgEl.content.value.length;
    msgEl.count.textContent = `${len} / ${MAX_LEN}`;
  }
  msgEl.content.addEventListener("input", updateCount);

  msgEl.form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    msgEl.error.textContent = "";

    const content = msgEl.content.value.trim();
    if (!content) return;
    if (content.length > MAX_LEN) {
      msgEl.error.textContent = `Maksimal ${MAX_LEN} karakter.`;
      return;
    }

    msgEl.sendBtn.disabled = true;
    msgEl.sendBtn.textContent = "Mengirim…";

    try {
      const { error } = await db.from("messages").insert({ content });
      if (error) throw error;

      msgEl.formWrap.style.display = "none";
      msgEl.sentWrap.style.display = "";
    } catch (err) {
      msgEl.error.textContent = "Gagal mengirim. Coba lagi sebentar lagi.";
      console.error("[bhyon's memorys] send message error:", err);
    } finally {
      msgEl.sendBtn.disabled = false;
      msgEl.sendBtn.textContent = "Kirim";
    }
  });
})();