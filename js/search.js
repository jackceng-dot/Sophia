// Sophia Web Search — Tavily API integration
(function() {

'use strict';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

// Keywords that suggest the user wants real-time / web information
const TRIGGER_KEYWORDS = [
  // English
  'latest', 'recent', 'current', 'today', 'now',
  'news', 'weather', 'stock', 'price', 'rate',
  'search', 'find', 'google', 'look up', 'what is',
  'who is', 'where is', 'tell me about',
  '2024', '2025', '2026',
  'happening', 'update', 'forecast', 'trend',
  // Chinese
  '最新', '今天', '现在', '实时',
  '新闻', '天气', '股价', '汇率',
  '搜索', '查一下', '什么是',
  '\x80fd告诉我'
];

const Search = {

  // --- Configuration ---
  _configKey: 'sophia_search_config',

  getConfig() {
    try {
      const raw = localStorage.getItem(this._configKey);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { tavilyKey: '' };
  },

  saveConfig(cfg) {
    try {
      localStorage.setItem(this._configKey, JSON.stringify(cfg));
    } catch(e) {}
  },

  getTavilyKey() {
    return this.getConfig().tavilyKey || '';
  },

  setTavilyKey(key) {
    const cfg = this.getConfig();
    cfg.tavilyKey = key;
    this.saveConfig(cfg);
  },

  // --- Auto-detection ---
  isSearchQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    // Check for trigger keywords
    for (const kw of TRIGGER_KEYWORDS) {
      if (lower.includes(kw)) return true;
    }
    // Check for question words at the start
    if (/^(what|who|where|when|why|how)\s/i.test(text.trim())) return true;
    // Check for Chinese question patterns
    if (/[吗呢吧]/.test(text)) return true;
    return false;
  },

  // --- Search API ---
  async searchWeb(query, apiKey) {
    if (!apiKey) {
      throw new Error('No Tavily API key configured');
    }
    const res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5
      })
    });
    if (!res.ok) {
      let msg = 'Tavily API error: HTTP ' + res.status;
      try {
        const err = await res.json();
        if (err.message) msg = err.message;
      } catch(e) {}
      throw new Error(msg);
    }
    return res.json();
  },

  // --- Inject search context into system prompt ---
  buildSearchContext(systemPrompt, searchData) {
    if (!searchData || !searchData.results || searchData.results.length === 0) {
      return systemPrompt;
    }

    let context = '\n\n[Web Search Results]\n';
    searchData.results.forEach((r, i) => {
      context += `Source ${i + 1}: ${r.title}\n`;
      context += `URL: ${r.url}\n`;
      context += r.content ? r.content.substring(0, 500) + '\n\n' : '\n';
    });

    // If Tavily returned a summary answer, use it too
    if (searchData.answer) {
      context += `Summary: ${searchData.answer}\n`;
    }

    context += '[End of Web Search Results]\n';
    context += 'Note: The above web search results are real-time information retrieved from the internet. ';
    context += 'Base your response on these results when answering the user\'s question. ';
    context += 'Cite sources when you use information from them.';

    return systemPrompt + context;
  },

  // --- Render source links as HTML ---
  renderSources(results) {
    if (!results || results.length === 0) return '';
    const links = results.slice(0, 3).map(r => {
      const displayName = r.title || new URL(r.url).hostname;
      return `<a href="${this._escAttr(r.url)}" target="_blank" rel="noopener" class="search-source-link">${this._escHtml(displayName)}</a>`;
    }).join(' ');
    return `<div class="search-sources">📎 Sources: ${links}</div>`;
  },

  // --- Helpers ---
  _escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  _escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

};

window.Search = Search;

})();
