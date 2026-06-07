// Sophia PWA - App Logic

(function(){

const App = {

  state: {

    screen: "chat",

    dashboardTab: "growth",

    chatMode: "free",

    welcomeVisible: true,

    theme: "system",

    currentSessionId: null,

    notesFilter: "all"

  },

  data: { sessions: [], notes: [], models: [] },
  _errorData: {},
  _drawerError: null,
  _errorList: null,
  _errorListIdx: 0,
  _sendLock: false,

  init() {

    this.loadData();

    this.bindNavigation();

    this.bindChat();

    this.bindDashboard();

    this.bindAnalysis();
    this.bindNotes();

    this.bindSettings();

    this.bindDrawer();

    this.applyTheme();

    this.renderNotes();

    this.renderModels();

    this.updateModelLabel();

    this.updateTime();

    setInterval(() => this.updateTime(), 30000);

  },

  loadData() {

    try {

      const d = JSON.parse(localStorage.getItem("sophia_data"));

      if (d && (d.sessions || d.notes || d.models)) {

        this.data.sessions = d.sessions || [];

        this.data.notes = d.notes || [];

        this.data.models = d.models || [];

        // Auto-inject Zhipu test model if missing
        if (!this.data.models.some(m => m.baseUrl && m.baseUrl.includes("bigmodel"))) {
          this.data.models.push({id:"m2", name:"Zhipu AI (Example)", baseUrl:"https://open.bigmodel.cn/api/paas/v4", param:"glm-4-flash", apiKey:"", active:false});
        }

        this.state.theme = d.theme || "system";

      } else {

        // Seed demo data

        const now = new Date().toISOString();

        this.data.notes = [

          {id:"vocab-log", title:"Vocabulary Upgrade", body:"", createdAt:now, updatedAt:now, source:"chat_correction"},

          {id:"fav-log", title:"Favorite Sentences", body:"", createdAt:now, updatedAt:now, source:"favorite_sentence"},

          {id:"n1", title:"Prepositions: in, on, at", body:"in + months/years\non + days/dates\nat + specific times\nExample: in March, on Monday, at 5pm", createdAt:now, updatedAt:now, source:"user"},

          {id:"how-to-say-log", title:"How to Say", body:"1.工作 \u2192 job, occupation\n2.消息 \u2192 news, information\n3.帮助 \u2192 help, aid\n4.改变 \u2192 change, transform\n5.结束 \u2192 end, conclude\n", createdAt:now, updatedAt:now, source:"how_to_say"}

        ];

        this.data.models = [
          {id:"m1", name:"Zhipu AI (Example)", baseUrl:"https://open.bigmodel.cn/api/paas/v4", param:"glm-4-flash", apiKey:"", active:true}
        ];

        this.saveData();

      }

    } catch(e) {

      // If parsing fails, use defaults above

    }

  },

  saveCurrentSession() {

    const msgArea = document.getElementById("chatMessages");

    if (!msgArea) return;

    const msgEls = msgArea.querySelectorAll(".msg");

    if (msgEls.length === 0) return;

    const messages = Array.from(msgEls).map(m => ({

      role: m.classList.contains("user") ? "user" : "assistant",

      text: m.textContent

    }));

    const mode = this.state.chatMode || "free";

    if (this.state.currentSessionId) {

      const existing = this.data.sessions.find(s => s.id === this.state.currentSessionId);

      if (existing) {

        existing.messages = messages;

        existing.mode = mode;

        existing.updatedAt = new Date().toISOString();

        this.saveData();

        return;

      }

    }

    const session = {

      id: "s" + Date.now(),

      createdAt: new Date().toISOString(),

      updatedAt: new Date().toISOString(),

      messages: messages,

      mode: mode

    };

    this.data.sessions.push(session);

    this.state.currentSessionId = session.id;

    this.saveData();

  },

  saveData() {

    try {

      localStorage.setItem("sophia_data", JSON.stringify({

        sessions: this.data.sessions,

        notes: this.data.notes,

        models: this.data.models,

        theme: this.state.theme

      }));

    } catch(e) {}

  },

  updateTime() {

    const el = document.getElementById("statusTime");

    if (!el) return;

    const d = new Date();

    el.textContent = d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");

  },

  bindNavigation() {

    document.querySelectorAll(".tab-btn").forEach(btn => {

      btn.addEventListener("click", () => {

        const screen = btn.dataset.screen;

        this.switchScreen(screen);

      });

    });

  },

  switchScreen(name) {

    this.state.screen = name;

    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

    document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));

    const screenEl = document.getElementById("screen-" + name);

    if (screenEl) screenEl.classList.add("active");

    const tabEl = document.querySelector('.tab-btn[data-screen="' + name + '"]');

    if (tabEl) tabEl.classList.add("active");

    this.closeSidebar();

    if (name === "notes") this.renderNotes();

    if (name === "settings") this.updateDataStats();

  },

  bindChat() {

    document.querySelectorAll(".mode-btn").forEach(btn => {

      btn.addEventListener("click", () => {

        if (!this.state.welcomeVisible) return;

        document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        this.state.chatMode = btn.dataset.mode;

      });

    });

    const sendBtn = document.getElementById("sendBtn");

    const input = document.getElementById("messageInput");

    if (sendBtn && input) {

      sendBtn.addEventListener("click", () => this.sendMessage());

      input.addEventListener("keydown", (e) => {

        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }

      });

      input.addEventListener("input", () => {

        input.style.height = "auto";

        input.style.height = Math.min(input.scrollHeight, 120) + "px";

      });

    }

    const endBtn = document.getElementById("endConversationBtn");

    if (endBtn) endBtn.addEventListener("click", () => this.endConversation());

    const modelLabel = document.getElementById("modelLabel");

    if (modelLabel) modelLabel.addEventListener("click", () => this.switchScreen("settings"));

    const sidebarToggle = document.getElementById("sidebarToggle");

    if (sidebarToggle) sidebarToggle.addEventListener("click", () => this.toggleSidebar());

    // Delegated click for error badge
    document.getElementById("chatMessages").addEventListener("click", (e) => {
      const badge = e.target.closest(".error-badge");
      if (!badge) return;
      const msgId = badge.dataset.msgid;
      const entry = this._errorData[msgId];
      if (!entry) return;
      const errors = entry.errors;
      if (errors && errors.length > 0) {
        this._errorList = errors;
        this._errorListIdx = 0;
        this._drawerSentence = entry.text;
        this.openCorrection(errors[0]);
      }
    });

  },

  sendMessage() {

    const input = document.getElementById("messageInput");

    const text = input.value.trim();

    if (!text) return;

    input.value = "";

    input.style.height = "auto";

    const msgArea = document.getElementById("chatMessages");

    if (this.state.welcomeVisible) {

      this.state.welcomeVisible = false;

      const card = document.getElementById("welcomeCard");

      if (card) card.style.display = "none";

      const endBtn = document.getElementById("endConversationBtn");

      if (endBtn && this.state.chatMode === "free") endBtn.style.display = "";

    }

    // Debounce — prevent rapid-fire API calls
    if (this._sendLock) { this.showToast("Please wait..."); return; }
    this._sendLock = true;

    this.addMessage("user", text);

    const typingDiv = document.createElement("div");

    typingDiv.className = "msg assistant";

    typingDiv.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';

    typingDiv.id = "typingIndicator";

    msgArea.appendChild(typingDiv);

    msgArea.scrollTop = msgArea.scrollHeight;

    // Find active model with API key
    const activeModel = this.data.models.find(m => m.active);
    if (!activeModel || !activeModel.apiKey) {
      const ti = document.getElementById("typingIndicator");
      if (ti) ti.remove();
      this.addMessage("assistant", "⚠️ No API model is configured. Go to Settings to add your API model and key first.");
      this.saveCurrentSession();
      this._sendLock = false;
      return;
    }

    // Build conversation history
    const messages = [
      { role: "system", content: "You are Sophia, a warm and friendly English conversation partner. Help the user practice English naturally. Keep responses engaging and conversational. Respond in English only." }
    ];

    const session = this.data.sessions.find(s => s.id === this.state.currentSessionId);
    if (session && session.messages) {
      const recent = session.messages.slice(-16);
      recent.forEach(m => messages.push({ role: m.role, content: m.text }));
    }

    messages.push({ role: "user", content: text });

    // Build API URL and make request
    let baseUrl = activeModel.baseUrl.replace(/\/+$/, "");
    const url = baseUrl + "/chat/completions";

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + activeModel.apiKey },
      body: JSON.stringify({
        model: activeModel.param,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
      return res.json();
    })
    .then(data => {
      const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
      const ti = document.getElementById("typingIndicator");
      if (ti) ti.remove();
      this.addMessage("assistant", reply);

      if (this.state.chatMode === "learning") {
        const userMsgs = document.querySelectorAll("#chatMessages .msg.user");
        const lastMsg = userMsgs[userMsgs.length - 1];
        const msgId = lastMsg?.dataset?.msgid;
        if (msgId) this.analyzeErrors(text, activeModel, msgId);
      }

      this.saveCurrentSession();
      this._sendLock = false;

      // Fire-and-forget: How to Say & Vocab Upgrade
      if (/[一-鿿]{2,}/.test(text)) this.checkHowToSayWords(text, activeModel);
      if (/[a-zA-Z]{4,}/.test(text)) this.checkVocabularyUpgrade(text, activeModel);
    })
    .catch(err => {
      const ti = document.getElementById("typingIndicator");
      if (ti) ti.remove();
      const msg = err.message || "";
      if (msg.includes("401")) {
        this.addMessage("assistant", "⚠️ API key rejected. Check your key in Settings.");
      } else if (msg.includes("429")) {
        this.addMessage("assistant", "⚠️ Too many requests. Wait a moment and try again.");
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        this.addMessage("assistant", "⚠️ Cannot reach the API server. Check your network and the Base URL in Settings.");
      } else {
        this.addMessage("assistant", "⚠️ Something went wrong. Check your model config in Settings and try again.");
      }
      this.saveCurrentSession();
      this._sendLock = false;
    });

  },

  addMessage(role, text) {

    const msgArea = document.getElementById("chatMessages");

    const div = document.createElement("div");

    div.className = "msg " + role;

    if (role === "user") {
      const msgId = "m" + Date.now() + Math.random().toString(36).slice(2,6);
      div.dataset.msgid = msgId;
    }

    div.textContent = text;

    msgArea.appendChild(div);

    msgArea.scrollTop = msgArea.scrollHeight;

  },

  endConversation() {

    this.saveCurrentSession();

    this.showToast("Generating report...");

    setTimeout(() => {

      this.switchScreen("dashboard");

      const analysisBtn = document.querySelector('.seg-btn[data-tab="analysis"]');

      if (analysisBtn) analysisBtn.click();

      this.showToast("Report ready!");

    }, 800);

  },

  startPractice(type) {

    const msgs = {

      daily: "Daily Test: 8 questions ready!",

      weekly: "Weekly Test: 12 questions covering this week.",

      monthly: "Monthly Test: 20 comprehensive questions.",

      fossilized: "Fossilized Errors: 5 rule migration exercises.",

      vocab: "Vocabulary Upgrade: 10 context-based exercises."

    };

    this.showToast(msgs[type] || "Starting practice...");

  },

  bindDashboard() {

    document.querySelectorAll(".seg-btn").forEach(btn => {

      btn.addEventListener("click", () => {

        document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        const tab = btn.dataset.tab;

        document.querySelectorAll(".dash-panel").forEach(p => p.classList.remove("active"));

        const panel = document.getElementById(tab + "View");

        if (panel) panel.classList.add("active");

      });

    });

    document.querySelectorAll(".time-btn").forEach(btn => {

      btn.addEventListener("click", () => {

        document.querySelectorAll(".time-btn").forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

      });

    });

  },


  GRAMMAR_CATEGORIES: {
    verbs: { name: "Verbs & Phrasal Verbs", count: 2, errors: [
      { text: "look forward to go", note: "Use gerund: looking forward to going" },
      { text: "She can sings", note: "Modal + base verb: She can sing" }
    ]},
    tenses: { name: "Tenses & Voices", count: 3, errors: [
      { text: "I go to school yesterday", note: "Past tense needed: went" },
      { text: "She have finished", note: "Has + past participle: She has" },
      { text: "They was playing", note: "Plural subject: They were" }
    ]},
    nonfinite: { name: "Non-finite Verbs", count: 1, errors: [
      { text: "I enjoy to swim", note: "Use gerund: I enjoy swimming" }
    ]},
    nouns: { name: "Nouns & Articles", count: 2, errors: [
      { text: "I saw a elephant", note: "Use 'an' before vowel: an elephant" },
      { text: "She gave me advices", note: "Uncountable: advice (no plural)" }
    ]},
    pronouns: { name: "Pronouns", count: 1, errors: [
      { text: "Me and Tom went there", note: "Subject pronoun: Tom and I went" }
    ]},
    adjadv: { name: "Adjectives & Adverbs", count: 1, errors: [
      { text: "She sings beautiful", note: "Use adverb: She sings beautifully" }
    ]},
    preps: { name: "Prepositions & Conjunctions", count: 2, errors: [
      { text: "interested on", note: "Use 'interested in'" },
      { text: "depend of", note: "Use 'depend on'" }
    ]},
    clauses: { name: "Clauses & Connectives", count: 1, errors: [
      { text: "Although she was tired, but she kept working", note: "Double conjunction: drop 'but'" }
    ]},
    agreement: { name: "Subject-Verb Agreement", count: 1, errors: [
      { text: "The team are winning", note: "Collective noun: The team is" }
    ]},
    subjunctive: { name: "Subjunctive Mood & Special Patterns", count: 1, errors: [
      { text: "I wish I am taller", note: "Subjunctive: I wish I were taller" }
    ]}
  },

  bindAnalysis() {
    // Use event delegation for category rows and back button
    const list = document.getElementById("grammarCategoryList");
    if (list) {
      list.addEventListener("click", (e) => {
        const row = e.target.closest(".cat-row");
        if (row && row.dataset.category) {
          this.showCategoryDetail(row.dataset.category);
        }
      });
    }
    const backBtn = document.querySelector(".cat-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => this.hideCategoryDetail());
    }
  },

  showCategoryDetail(catId) {
    const cat = this.GRAMMAR_CATEGORIES[catId];
    if (!cat) return;
    document.getElementById("grammarCategoryList").style.display = "none";
    document.getElementById("categoryDetail").style.display = "block";
    document.getElementById("detailTitle").textContent = cat.name;
    document.getElementById("detailCount").textContent = cat.count + " error" + (cat.count !== 1 ? "s" : "");
    const list = document.getElementById("categoryErrorList");
    list.innerHTML = cat.errors.map(e =>
      '<div class="detail-error-item">' +
        '<div class="detail-error-text">' + this.escHtml(e.text) + '</div>' +
        '<div class="detail-error-note">' + this.escHtml(e.note) + '</div>' +
      '</div>'
    ).join("");
    // Keep scroll position — don't force scrollTop to avoid viewport jump
  },

  hideCategoryDetail() {
    document.getElementById("grammarCategoryList").style.display = "";
    document.getElementById("categoryDetail").style.display = "none";
  },
  bindNotes() {

    document.getElementById("newNoteBtn")?.addEventListener("click", () => this.openNoteEditor());

    document.getElementById("notesSearchInput")?.addEventListener("input", () => this.renderNotes());

    document.querySelectorAll(".notes-filter-btn").forEach(btn => {

      btn.addEventListener("click", () => {

        document.querySelectorAll(".notes-filter-btn").forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        this.state.notesFilter = btn.dataset.filter;

        try { this.renderNotes(); } catch(e) { console.warn(e); }

      });

    });

    document.getElementById("noteSaveBtn")?.addEventListener("click", () => this.saveNote());

    document.getElementById("noteDeleteBtn")?.addEventListener("click", () => this.deleteNote());

    document.getElementById("noteModalClose")?.addEventListener("click", () => this.closeNoteEditor());

    document.getElementById("noteModalOverlay")?.addEventListener("click", () => this.closeNoteEditor());

  },

  renderNotes() {

    const list = document.getElementById("notesList");

    if (!list) return;

    const query = (document.getElementById("notesSearchInput")?.value || "").toLowerCase();

    let notes = this.data.notes || [];

    if (!Array.isArray(notes)) notes = [];

    if (query) notes = notes.filter(n => (n.title||"").toLowerCase().includes(query) || (n.body||"").toLowerCase().includes(query));

    const filter = this.state.notesFilter || "all";

    if (filter !== "all") notes = notes.filter(n => n.source === filter);

    notes.sort((a, b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt));

    if (notes.length === 0) {

      list.innerHTML = '<p style="text-align:center;color:var(--ink-faint);padding:40px;font-size:14px">' + (query ? "No results" : "No notes yet") + '</p>';

      return;

    }

    list.innerHTML = notes.map(n => {

      let tag = '', tagCls = '';

      if (n.source === "chat_correction") { tag = "Vocab"; tagCls = "vocab"; }

      else if (n.source === "how_to_say") { tag = "How to Say"; tagCls = "how-to-say"; }

      else if (n.source === "favorite_sentence") { tag = "Favorite"; tagCls = "favorite"; }

      const tagHtml = tag ? '<span class="note-tag ' + tagCls + '">' + tag + '</span>' : "";

      let preview = (n.body||"").substring(0, 60);

      if (n.id === "how-to-say-log") {

        const count = (n.body||"").split("\n").filter(function(l) { return l.match(/^\d+\./); }).length;

        preview = count + " entr" + (count!==1?"ies":"y") + " total";

      } else if (n.id === "vocab-log" || n.id === "fav-log") {

        const lines = (n.body||"").split("\n").filter(function(l) { return l.trim(); });

        preview = lines.length > 0 ? lines[0].replace(/^\d+\.\s*|\u00b7\s*/, "") : "No entries";

        if (preview.length > 55) preview = preview.substring(0, 55) + "...";

      }

      const date = new Date(n.updatedAt||n.createdAt);

      const ds = date.toLocaleDateString("en-US", {month:"short", day:"numeric"});

      return '<div class="note-item" data-id="' + n.id + '"><h4>' + tagHtml + n.title + '</h4><p>' + preview + '</p><div class="note-date">' + ds + '</div></div>';

    }).join("");

    list.querySelectorAll(".note-item").forEach(el => {

      el.addEventListener("click", () => {

        const note = this.data.notes.find(n => n.id === el.dataset.id);

        if (note) this.openNoteEditor(note);

      });

    });

  },

  noteEditingId: null,

  openNoteEditor(note) {

    this.noteEditingId = note ? note.id : null;

    document.getElementById("noteTitleInput").value = note ? note.title : "";

    document.getElementById("noteBodyInput").value = note ? note.body : "";

    document.getElementById("noteModalOverlay").classList.remove("hidden");

    document.getElementById("noteModal").classList.remove("hidden");

    document.getElementById("noteDeleteBtn").style.display = note ? "" : "none";

  },

  closeNoteEditor() {

    document.getElementById("noteModalOverlay").classList.add("hidden");

    document.getElementById("noteModal").classList.add("hidden");

    this.noteEditingId = null;

  },

  saveNote() {

    const title = document.getElementById("noteTitleInput").value.trim() || "Untitled";

    const body = document.getElementById("noteBodyInput").value.trim();

    if (!body) { this.showToast("Write something"); return; }

    const now = new Date().toISOString();

    if (this.noteEditingId) {

      const note = this.data.notes.find(n => n.id === this.noteEditingId);

      if (note) { note.title = title; note.body = body; note.updatedAt = now; }

    } else {

      this.data.notes.unshift({ id: "n"+Date.now(), title, body, createdAt: now, updatedAt: now, source: "user" });

    }

    this.saveData();

    this.renderNotes();

    this.closeNoteEditor();

    this.showToast("Note saved!");

  },

  deleteNote() {

    if (!this.noteEditingId) return;

    if (!confirm("Delete this note?")) return;

    this.data.notes = this.data.notes.filter(n => n.id !== this.noteEditingId);

    this.saveData();

    this.renderNotes();

    this.closeNoteEditor();

    this.showToast("Note deleted");

  },

  bindSettings() {

    document.querySelectorAll(".appearance-btn").forEach(btn => {

      btn.addEventListener("click", () => {

        document.querySelectorAll(".appearance-btn").forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        this.state.theme = btn.dataset.themeVal;

        this.applyTheme();

        this.saveData();

      });

    });

    document.getElementById("addModelBtn")?.addEventListener("click", () => this.openModelForm());

    document.getElementById("cancelModelBtn")?.addEventListener("click", () => this.closeModelForm());

    document.getElementById("modelFormOverlay")?.addEventListener("click", () => this.closeModelForm());

    document.getElementById("saveModelBtn")?.addEventListener("click", () => this.saveModel());

    document.getElementById("testConnectionBtn")?.addEventListener("click", () => this.testModel());

    document.getElementById("toggleKeyBtn")?.addEventListener("click", () => {

      const inp = document.getElementById("modelApiKey");

      inp.type = inp.type === "password" ? "text" : "password";

    });

    document.getElementById("exportDataBtn")?.addEventListener("click", () => this.exportData());

    document.getElementById("clearDataBtn")?.addEventListener("click", () => this.clearData());

    document.getElementById("sidebarClose")?.addEventListener("click", () => this.closeSidebar());

    document.getElementById("sidebarOverlay")?.addEventListener("click", () => this.closeSidebar());

    document.getElementById("newChatBtn")?.addEventListener("click", () => this.newChat());

  },

  applyTheme() {

    const t = this.state.theme;

    if (t === "system") {

      document.documentElement.removeAttribute("data-theme");

      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;

      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");

    } else {

      document.documentElement.setAttribute("data-theme", t);

    }

  },

  renderModels() {

    const list = document.getElementById("modelList");

    if (!list) return;

    if (this.data.models.length === 0) {

      list.innerHTML = '<p style="font-size:13px;color:var(--ink-faint);text-align:center;padding:20px">No models configured</p>';

      return;

    }

    list.innerHTML = this.data.models.map(m => {

      const active = m.active ? '<span class="active-dot"></span>' : "";

      return '<div class="model-item' + (m.active ? " active" : "") + '" data-id="' + m.id + '"><div><div class="model-name">' + m.name + ' ' + active + '</div><div class="model-param">' + (m.param||"") + '</div></div><button class="del-btn" data-id="' + m.id + '">&times;</button></div>';

    }).join("");

    list.querySelectorAll(".model-item").forEach(el => {

      el.addEventListener("click", (e) => {

        if (e.target.classList.contains("del-btn")) return;

        this.data.models.forEach(m => m.active = false);

        const m = this.data.models.find(m => m.id === el.dataset.id);

        if (m) m.active = true;

        this.saveData();

        this.renderModels();

      });

    });

    list.querySelectorAll(".del-btn").forEach(btn => {

      btn.addEventListener("click", (e) => {

        e.stopPropagation();

        if (!confirm("Remove this model?")) return;

        this.data.models = this.data.models.filter(m => m.id !== btn.dataset.id);

        this.saveData();

        this.renderModels();

      });

    });

    this.updateModelLabel();

  },

  updateModelLabel() {
    const label = document.getElementById("modelLabel");
    if (!label) return;
    const active = this.data.models.find(m => m.active);
    label.textContent = active ? active.name : "No Model";
  },

  openModelForm() {

    document.getElementById("modelFormOverlay").classList.remove("hidden");

    document.getElementById("modelForm").classList.remove("hidden");

    document.getElementById("testResult").classList.add("hidden");

  },

  closeModelForm() {

    document.getElementById("modelFormOverlay").classList.add("hidden");

    document.getElementById("modelForm").classList.add("hidden");

    ["modelName","modelBaseUrl","modelParam","modelApiKey"].forEach(id => document.getElementById(id).value = "");

  },

  saveModel() {

    const name = document.getElementById("modelName").value.trim();

    const baseUrl = document.getElementById("modelBaseUrl").value.trim();

    const param = document.getElementById("modelParam").value.trim();

    const apiKey = document.getElementById("modelApiKey").value.trim();

    if (!name || !baseUrl || !param || !apiKey) { this.showToast("All fields including API Key are required"); return; }

    this.data.models.forEach(m => m.active = false);

    this.data.models.push({ id: "m"+Date.now(), name, baseUrl, param, apiKey, active: true });

    this.saveData();

    this.renderModels();

    this.closeModelForm();

    this.showToast("Model saved!");

  },

  testModel() {

    const el = document.getElementById("testResult");

    el.classList.remove("hidden","success","fail");

    el.textContent = "Testing...";

    const baseUrl = document.getElementById("modelBaseUrl").value.trim();

    const param = document.getElementById("modelParam").value.trim() || "glm-4-flash";

    const apiKey = document.getElementById("modelApiKey").value.trim();

    if (!baseUrl || !apiKey) {

      el.classList.add("fail");

      el.textContent = "Please enter Base URL and API Key first.";

      return;

    }

    let url = baseUrl.replace(/\/+$/, "") + "/chat/completions";

    fetch(url, {

      method: "POST",

      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },

      body: JSON.stringify({

        model: param,

        messages: [{ role: "user", content: "Say 'Hello' and nothing else." }],

        max_tokens: 10

      })

    })

    .then(res => {

      if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);

      return res.json();

    })

    .then(data => {

      el.classList.add("success");

      el.textContent = "Connection successful!";

    })

    .catch(err => {

      el.classList.add("fail");

      const msg = err.message || "";
      if (msg.includes("401")) el.textContent = "Connection failed: Invalid API key.";
      else if (msg.includes("404")) el.textContent = "Connection failed: Endpoint not found. Check Base URL.";
      else if (msg.includes("Failed to fetch")) el.textContent = "Connection failed: Cannot reach server. Check URL and network.";
      else el.textContent = "Connection failed: " + msg;

    });

  },

  exportData() {

    const data = { notes: this.data.notes, sessions: this.data.sessions, exportedAt: new Date().toISOString() };

    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = "sophia-export.json";

    a.click();

    URL.revokeObjectURL(url);

    this.showToast("Exported!");

  },

  bindDrawer() {

    document.getElementById("drawerClose")?.addEventListener("click", () => this.closeDrawer());

    document.getElementById("drawerOverlay")?.addEventListener("click", () => this.closeDrawer());

    document.getElementById("saveToNotesBtn")?.addEventListener("click", () => this.saveCorrectionToNotes());

    document.getElementById("favSentenceBtn")?.addEventListener("click", () => this.saveFavoriteSentence());

    document.getElementById("errorNavPrev")?.addEventListener("click", () => this._navigateError(-1));

    document.getElementById("errorNavNext")?.addEventListener("click", () => this._navigateError(1));

  },

  closeDrawer() {

    document.getElementById("drawerOverlay").classList.add("hidden");

    document.getElementById("correctionDrawer").classList.add("hidden");

    this._drawerError = null;

    this._errorList = null;

    this._errorListIdx = 0;

  },

  saveCorrectionToNotes() {
    const err = this._drawerError;
    if (!err) return;
    const sentence = this._drawerSentence || err.word;
    const now = new Date().toISOString();
    const collector = this.data.notes.find(n => n.id === "vocab-log");
    if (collector && collector.body.includes(sentence)) {
      this.showToast("Already saved!"); return;
    }
    const n = collector ? (collector.body.match(/\d+\./g)||[]).length : 0;
    const entry = (n + 1) + ". " + sentence + "\n" +
      "   ✗ " + err.word + " → ✓ " + err.correction + "  [" + err.type + "]\n" +
      "   " + err.explanation + "\n" +
      (err.tip ? "   💡 " + err.tip + "\n" : "") + "\n";
    if (collector) { collector.body += entry; collector.updatedAt = now; }
    else { this.data.notes.unshift({ id: "vocab-log", title: "Vocabulary Upgrade", body: entry, createdAt: now, updatedAt: now, source: "chat_correction" }); }
    this.saveData();
    this.renderNotes();
    this.closeDrawer();
    this.showToast("Saved to Notes!");
  },
  toggleSidebar() {

    const sidebar = document.getElementById("sidebar");

    const overlay = document.getElementById("sidebarOverlay");

    if (!sidebar || !overlay) return;

    const isOpen = !sidebar.classList.contains("hidden");

    if (isOpen) { this.closeSidebar(); return; }

    sidebar.classList.remove("hidden");

    overlay.classList.remove("hidden");

    this.renderSidebar();

  },

  closeSidebar() {

    document.getElementById("sidebar")?.classList.add("hidden");

    document.getElementById("sidebarOverlay")?.classList.add("hidden");

  },

  newChat() {

    this.saveCurrentSession();

    this.closeSidebar();

    this.switchScreen("chat");

    this.state.welcomeVisible = true;

    this.state.chatMode = null;

    this.state.currentSessionId = null;

    const card = document.getElementById("welcomeCard");

    if (card) card.style.display = "";

    const msgArea = document.getElementById("chatMessages");

    if (msgArea) msgArea.querySelectorAll(".msg").forEach(m => m.remove());

    const modeSel = document.getElementById("modeSelector");

    if (modeSel) modeSel.style.display = "";

    const inputArea = document.getElementById("chatInputArea");

    if (inputArea) inputArea.style.display = "none";

    const endBtn = document.getElementById("endConversationBtn");

    if (endBtn) endBtn.style.display = "none";

  },

  renderSidebar() {

    const list = document.getElementById("sidebarList");

    if (!list) return;

    const sessions = this.data.sessions || [];

    if (sessions.length === 0) {

      list.innerHTML = '<p style="font-size:13px;color:var(--ink-faint);text-align:center;padding:20px">No sessions yet</p>';

      return;

    }

    list.innerHTML = sessions.slice(-20).reverse().map(s => {

      const date = new Date(s.createdAt || Date.now());

      const dateStr = date.toLocaleDateString(undefined, {month:"short", day:"numeric", hour:"2-digit", minute:"2-digit"});

      const preview = (s.messages && s.messages[0] && s.messages[0].text) ? s.messages[0].text.substring(0,50) : "Conversation";

      return '<div class="sidebar-session" data-id="' + s.id + '"><div class="session-date">' + dateStr + '</div><div class="session-preview">' + this.escHtml(preview) + '</div><div class="session-mode">' + (s.mode || "free") + '</div></div>';

    }).join("");

    list.querySelectorAll(".sidebar-session").forEach(el => {

      el.addEventListener("click", () => {

        this.closeSidebar();

        this.loadSession(el.dataset.id);

      });

    });

  },

  loadSession(id) {

    const s = this.data.sessions.find(s => s.id === id);

    if (!s) return;

    this.state.currentSessionId = id;

    this.switchScreen("chat");

    this.state.welcomeVisible = false;

    const card = document.getElementById("welcomeCard");

    if (card) card.style.display = "none";

    const msgArea = document.getElementById("chatMessages");

    if (!msgArea) return;

    msgArea.querySelectorAll(".msg").forEach(m => m.remove());

    if (s.messages) s.messages.forEach(m => this.addMessage(m.role, m.text));

    const endBtn = document.getElementById("endConversationBtn");

    if (endBtn) endBtn.style.display = s.mode === "free" ? "" : "none";

    this.state.chatMode = s.mode || "free";

  },

  updateDataStats() {

    const sessions = this.data.sessions || [];

    const notes = this.data.notes || [];

    const sEl = document.getElementById("statSessions");

    const nEl = document.getElementById("statNotes");

    if (sEl) sEl.textContent = sessions.length;

    if (nEl) nEl.textContent = notes.length;

  },

  clearData() {

    if (!confirm("Are you sure you want to clear all data? This cannot be undone.")) return;

    this.data.sessions = [];

    this.data.notes = [];

    this.saveData();

    this.renderNotes();

    this.updateDataStats();

    this.showToast("All data cleared");

  },

  checkHowToSayWords(userText, model) {
    const cnChars = userText.match(/[\u4e00-\u9fff]{2,}/g);
    if (!cnChars || !cnChars.length) return;
    const word = cnChars[0];
    let baseUrl = model.baseUrl.replace(/\/+$/, "");
    const url = baseUrl + "/chat/completions";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + model.apiKey },
      body: JSON.stringify({ model: model.param, messages: [
        { role: "system", content: "You are a translator. Respond with ONLY the Chinese word followed by ' \u2192 ' then 2-3 English equivalents separated by commas. No explanations, no extra text." },
        { role: "user", content: "Translate \"" + word + "\" to natural English." }
      ], max_tokens: 60, temperature: 0.1 })
    })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const aiText = data.choices?.[0]?.message?.content || "";
      const line = aiText.split("\n").filter(l => l.includes("\u2192"))[0];
      if (!line) return;
      const eng = line.split("\u2192")[1]?.trim();
      if (!eng) return;
      this._saveHowToSayEntry(word, eng);
    })
    .catch(() => {});
  },
  _saveHowToSayEntry(chinese, eng) {
    const now = new Date().toISOString();
    const coll = this.data.notes.find(n => n.id === "how-to-say-log");
    if (coll && coll.body.includes(chinese + " \u2192 ")) return;
    const n = coll ? (coll.body.match(/\d+\./g)||[]).length : 0;
    const entry = (n + 1) + "." + chinese + " \u2192 " + eng + "\n";
    if (coll) { coll.body += entry; coll.updatedAt = now; }
    else { this.data.notes.unshift({ id: "how-to-say-log", title: "How to Say", body: entry, createdAt: now, updatedAt: now, source: "how_to_say" }); }
    this.showToast("How to Say: " + chinese + " \u2192 " + eng);
    this.saveData();
  },
  checkVocabularyUpgrade(text, model) {
    if (!/[a-zA-Z]{4,}/.test(text)) return;
    let baseUrl = model.baseUrl.replace(/\/+$/, "");
    const url = baseUrl + "/chat/completions";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + model.apiKey },
      body: JSON.stringify({ model: model.param, messages: [
        { role: "system", content: "Identify A1-A2 level words in the user's message. For each, suggest 2 B2-C1 alternatives. Output format: word \u2192 alternative1, alternative2. One per line. No explanations." },
        { role: "user", content: text }
      ], max_tokens: 100, temperature: 0.1 })
    })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const aiText = data.choices?.[0]?.message?.content || "";
      const lines = aiText.split("\n").filter(l => l.includes("\u2192"));
      if (!lines.length) return;
      const userWords = new Set(text.toLowerCase().split(/\W+/).filter(w => w.length > 1));
      const coll = this.data.notes.find(n => n.id === "vocab-log");
      let added = 0;
      const now = new Date().toISOString();
      lines.forEach(line => {
        const parts = line.split("\u2192");
        const w = parts[0]?.trim().toLowerCase().replace(/^\d+\.\s*/, "");
        const alts = parts[1]?.trim();
        if (!w || !alts || !userWords.has(w)) return;
        if (coll && coll.body.includes(w + " \u2192 ")) return;
        const n = coll ? (coll.body.match(/\d+\./g)||[]).length : 0;
        const entry = (n + added + 1) + "." + w + " \u2192 " + alts + "\n";
        if (coll) { coll.body += entry; }
        else { this.data.notes.unshift({ id: "vocab-log", title: "Vocabulary Upgrade", body: entry, createdAt: now, updatedAt: now, source: "chat_correction" }); }
        added++;
      });
      if (added) { if (coll) coll.updatedAt = now; this.saveData(); this.showToast(added + " vocab upgrades saved!"); }
    })
    .catch(() => {});
  },

  analyzeErrors(text, model, msgId) {
    let baseUrl = (model.baseUrl || "").replace(/\/+$/, "");
    if (!baseUrl || !model.apiKey) return;
    const url = baseUrl + "/chat/completions";
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + model.apiKey },
      body: JSON.stringify({
        model: model.param,
        messages: [
          { role: "system", content:
            "You are a STRICT English grammar checker. Find EVERY grammatical error — be thorough, not lenient.\n\n" +
            "ERROR TYPES (flag ANY that apply):\n" +
            "- Plural Form: singular where plural required, or vice versa. CRITICAL: 'some'/'many'/'few'/'several'/'a lot of'/'a couple of'/'a few'/'a number of'/'one of the' BEFORE a singular countable noun IS AN ERROR. 'I have some apple' → 'apples'. 'Many student came' → 'students'. 'One of the book' → 'books'. Also flag plural where singular is needed: 'I have two apple' → 'apples'. Uncountable nouns used with plural forms.\n" +
            "- Article: missing a/an/the, or wrong article. 'I saw elephant' → 'an elephant'. 'She is teacher' → 'a teacher'. 'I love the music in general' → 'I love music'.\n" +
            "- Verb Tense: wrong tense. 'I go to school yesterday' → 'went'. 'She has went' → 'gone'. Time markers mismatch with tense.\n" +
            "- Subject-Verb Agreement: subject-verb mismatch. 'He go' → 'goes'. 'They was' → 'were'. 'The team are' (collective) → check context.\n" +
            "- Preposition: wrong preposition. 'Interested on' → 'in'. 'Good in English' → 'at'. 'Depend of' → 'on'.\n" +
            "- Word Form: wrong part of speech. 'I feel happily' → 'happy' (adjective after feel). 'She sings beautiful' → 'beautifully' (adverb for verb).\n" +
            "- Word Choice: wrong word, not grammar. 'I make a photo' → 'take'. 'I do a mistake' → 'make'. 'I explain you' → 'explain to you'.\n" +
            "- Non-finite Verb: verb form error. 'I enjoy to swim' → 'swimming'. 'He made me to go' → 'go'. 'Let me to help' → 'help'.\n" +
            "- Pronoun: wrong pronoun. 'Me and Tom went' → 'Tom and I'. 'Give it to he' → 'him'. 'The book is her' → 'hers'.\n" +
            "- Adjective/Adverb: adjective-adverb confusion. 'She runs quick' → 'quickly'. 'This is more better' → 'better' (double comparative).\n" +
            "- Clause/Connective: wrong connector or doubled. 'Although tired, but she worked' → drop 'but'. 'Because I was late, so I ran' → drop 'so'.\n" +
            "- Noun/Article: noun form error. 'She gave me advices' → 'advice' (uncountable). 'I need a information' → 'information' (no article with uncountable).\n" +
            "- Subjunctive Mood: mood error. 'I wish I am taller' → 'were'. 'If I was you' → 'were'. 'It is important that he goes' → 'go'.\n\n" +
            "RULES:\n" +
            "1. 'some'/'many'/'few'/'several'/'a lot of'/'a couple of'/'a few'/'a number of'/'one of the' + singular countable noun = ERROR (Plural Form).\n" +
            "2. 'much'/'a little'/'a great deal of' + countable plural noun = ERROR.\n" +
            "3. Check every word. Be strict. If it is grammatically wrong, flag it.\n" +
            "4. Only return [] if the sentence has ZERO grammatical errors. Do NOT be lenient.\n" +
            "5. Do NOT flag stylistic or word-choice preferences that are grammatically correct.\n\n" +
            "EXAMPLES:\n" +
            "Input: 'I have some apple.' → [{\"word\":\"apple\",\"correction\":\"apples\",\"type\":\"Plural Form\",\"explanation\":\"...\",\"tip\":\"...\"}]\n" +
            "Input: 'Who are you?' → []\n" +
            "Input: 'He go to school every day.' → [{\"word\":\"go\",\"correction\":\"goes\",\"type\":\"Subject-Verb Agreement\",\"explanation\":\"...\",\"tip\":\"...\"}]\n" +
            "Input: 'I like to play football.' → []\n" +
            "Input: 'I saw dog in the park.' → [{\"word\":\"dog\",\"correction\":\"a dog\",\"type\":\"Article\",\"explanation\":\"...\",\"tip\":\"...\"}]\n\n" +
            "Each error: {\"word\":...,\"correction\":...,\"type\":... (exact from list above),\"explanation\":... (2-3 sentences: why it's wrong + the rule + how to fix),\"tip\":... (one memorable line)}\n\n" +
            "Return ONLY the JSON array. No markdown, no backticks, no text before or after." },
          { role: "user", content: text }
        ],
        max_tokens: 300,
        temperature: 0
      })
    })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      const raw = data.choices?.[0]?.message?.content || "[]";
      console.log("[grammar] AI raw:", raw);
      let errors = this._parseErrorJson(raw);
      if (!Array.isArray(errors)) errors = [];
      console.log("[grammar] parsed:", errors.length, "errors");
      if (errors.length === 0) return;
      this._errorData[msgId] = { text, errors };
      this._showErrorBadge(msgId, errors);
    })
    .catch(e => { console.warn("[grammar] failed:", e.message || e); });
  },

  _parseErrorJson(raw) {
    const s = raw.trim();
    // Strategy 1: try direct parse
    try { return JSON.parse(s); } catch(e) {}
    // Strategy 2: strip markdown fences
    try {
      const cleaned = s.replace(/```(?:json)?\s*/g, "").trim();
      return JSON.parse(cleaned);
    } catch(e) {}
    // Strategy 3: extract array via regex
    try {
      const match = s.match(/\[[\s\S]*?\]/);
      if (match) return JSON.parse(match[0]);
    } catch(e) {}
    console.warn("[grammar] failed to parse:", raw);
    return [];
  },

  _showErrorBadge(msgId, errors) {
    const msgEl = document.querySelector('.msg.user[data-msgid="' + msgId + '"]');
    if (!msgEl) return;
    const old = msgEl.querySelector(".error-badge");
    if (old) old.remove();
    const badge = document.createElement("span");
    badge.className = "error-badge";
    badge.textContent = "✏️ " + errors.length;
    badge.dataset.msgid = msgId;
    msgEl.appendChild(badge);
  },

  openCorrection(errData) {
    this._drawerError = errData;
    document.getElementById("drawerOverlay").classList.remove("hidden");
    document.getElementById("correctionDrawer").classList.remove("hidden");
    const cEl = document.getElementById("correctionContent");
    if (cEl) {
      const tipHtml = errData.tip ? '<div class="corr-tip">💡 ' + this.escHtml(errData.tip) + '</div>' : '';
      cEl.innerHTML =
        '<div class="corr-row"><span class="corr-word">' + this.escHtml(errData.word) + '</span><span class="corr-arrow">→</span><span class="corr-fix">' + this.escHtml(errData.correction) + '</span></div>' +
        '<div class="corr-type">' + this.escHtml(errData.type) + '</div>' +
        '<div class="corr-explain">' + this.escHtml(errData.explanation) + '</div>' +
        tipHtml;
    }
    this._updateErrorNav();
  },

  _updateErrorNav() {
    const nav = document.getElementById("errorNav");
    if (!nav) return;
    const total = this._errorList ? this._errorList.length : 0;
    const idx = this._errorListIdx || 0;
    if (total <= 1) { nav.style.display = "none"; return; }
    nav.style.display = "flex";
    const countEl = nav.querySelector(".error-nav-count");
    if (countEl) countEl.textContent = (idx + 1) + " / " + total;
    const prevBtn = nav.querySelector(".error-nav-prev");
    const nextBtn = nav.querySelector(".error-nav-next");
    if (prevBtn) prevBtn.style.visibility = idx > 0 ? "visible" : "hidden";
    if (nextBtn) nextBtn.style.visibility = idx < total - 1 ? "visible" : "hidden";
  },

  _navigateError(dir) {
    if (!this._errorList) return;
    const newIdx = this._errorListIdx + dir;
    if (newIdx < 0 || newIdx >= this._errorList.length) return;
    this._errorListIdx = newIdx;
    const err = this._errorList[newIdx];
    this._drawerError = err;
    const cEl = document.getElementById("correctionContent");
    if (cEl) {
      const tipHtml = err.tip ? '<div class="corr-tip">💡 ' + this.escHtml(err.tip) + '</div>' : '';
      cEl.innerHTML =
        '<div class="corr-row"><span class="corr-word">' + this.escHtml(err.word) + '</span><span class="corr-arrow">→</span><span class="corr-fix">' + this.escHtml(err.correction) + '</span></div>' +
        '<div class="corr-type">' + this.escHtml(err.type) + '</div>' +
        '<div class="corr-explain">' + this.escHtml(err.explanation) + '</div>' +
        tipHtml;
    }
    this._updateErrorNav();
  },

  saveFavoriteSentence() {
    const err = this._drawerError;
    if (!err) return;
    const sentence = this._drawerSentence || err.word;
    const now = new Date().toISOString();
    const collector = this.data.notes.find(n => n.id === "fav-log");
    if (collector && collector.body.includes(sentence)) { this.showToast("Already saved!"); return; }
    const entry = "\u00b7 " + sentence + "\n" +
      "   \u2717 " + err.word + " \u2192 \u2713 " + err.correction + "  [" + err.type + "]\n" +
      "   " + err.explanation + "\n" +
      (err.tip ? "   \ud83d\udca1 " + err.tip + "\n" : "") + "\n";
    if (collector) { collector.body += entry; collector.updatedAt = now; }
    else { this.data.notes.unshift({ id: "fav-log", title: "Favorite Sentences", body: entry, createdAt: now, updatedAt: now, source: "favorite_sentence" }); }
    this.saveData();
    this.renderNotes();
    this.closeDrawer();
    this.showToast("Favorited!");
  },

  escHtml(str) {

    const div = document.createElement("div");

    div.textContent = str;

    return div.innerHTML;

  },

  showToast(msg) {

    const el = document.getElementById("toast");

    if (!el) return;

    el.textContent = msg;

    el.classList.remove("hidden");

    el.style.opacity = "1";

    clearTimeout(this._toastTimer);

    this._toastTimer = setTimeout(() => {

      el.style.opacity = "0";

      setTimeout(() => el.classList.add("hidden"), 300);

    }, 2500);

  }

};

window.App = App;

window.startPractice = function(t) { App.startPractice(t); };
// Category drill-down now uses event delegation via bindAnalysis()
// Inline onclick no longer needed

if (document.readyState === "loading") {

  document.addEventListener("DOMContentLoaded", () => App.init());

} else {

  App.init();

}

if ("serviceWorker" in navigator) {

  window.addEventListener("load", () => {

    navigator.serviceWorker.register("sw.js").catch(() => {});

  });

}

// Online/offline detection
function updateOnlineStatus() {
  const wasOffline = document.body.classList.contains("offline");
  document.body.classList.toggle("offline", !navigator.onLine);
  if (!navigator.onLine && !wasOffline) {
    App.showToast?.("You're offline — some features may be unavailable");
  } else if (navigator.onLine && wasOffline) {
    App.showToast?.("Back online!");
  }
}
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

})();

