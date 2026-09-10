(() => {
  'use strict';

  const STORAGE = {
    categories: 'sbranapanda.categories.v1',
    theme: 'sbranapanda.theme.v1',
    sound: 'sbranapanda.sound.v1'
  };

  const DEFAULTS = {
    italian: [
      ['ANNI 20 30 40 50', true],
      ['ANNI 60', true],
      ['ANNI 70', true],
      ['ANNI 80', true],
      ['ANNI 90', true],
      ['ANNI 2000', true],
      ['MUSICA CONTEMPORANEA', true]
    ],
    challenge: [
      ['ROCK!', true],
      ['MUSICA CLASSICA!', true],
      ['CARTONI ANIMATI!', true],
      ['COLONNE SONORE!', true],
      ['LIRICA!', true],
      ['SANREMO!', true],
      ['INNI NAZIONALI', false],
      ['PUBBLICITA', false],
      ['LITURGICA', false],
      ['JAZZ & BLUES!', false],
      ["ZECCHINO D'ORO", false]
    ]
  };

  const makeDefaultState = () => ({
    italian: DEFAULTS.italian.map(([name, enabled]) => ({ id: cryptoId(), name, enabled })),
    challenge: DEFAULTS.challenge.map(([name, enabled]) => ({ id: cryptoId(), name, enabled }))
  });

  const els = {
    splash: document.getElementById('splash'),
    italianBtn: document.getElementById('italianBtn'),
    challengeBtn: document.getElementById('challengeBtn'),
    pandaBtn: document.getElementById('pandaBtn'),
    speechBubble: document.getElementById('speechBubble'),
    modeBadge: document.getElementById('modeBadge'),
    instruction: document.getElementById('instruction'),
    categoryStatus: document.getElementById('categoryStatus'),
    italianCount: document.getElementById('italianCount'),
    challengeCount: document.getElementById('challengeCount'),
    categoriesBtn: document.getElementById('categoriesBtn'),
    soundBtn: document.getElementById('soundBtn'),
    themeBtn: document.getElementById('themeBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    infoBtn: document.getElementById('infoBtn'),
    categoriesDialog: document.getElementById('categoriesDialog'),
    infoDialog: document.getElementById('infoDialog'),
    confirmDialog: document.getElementById('confirmDialog'),
    categoryList: document.getElementById('categoryList'),
    rowTemplate: document.getElementById('categoryRowTemplate'),
    addCategoryForm: document.getElementById('addCategoryForm'),
    newCategory: document.getElementById('newCategory'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    selectNoneBtn: document.getElementById('selectNoneBtn'),
    activeSummary: document.getElementById('activeSummary'),
    resetCategoriesBtn: document.getElementById('resetCategoriesBtn'),
    cancelResetBtn: document.getElementById('cancelResetBtn'),
    confirmResetBtn: document.getElementById('confirmResetBtn')
  };

  const sounds = {
    intro: new Audio('assets/intro.wav'),
    extraction: new Audio('assets/estrazione.wav'),
    pop: new Audio('assets/pop.wav')
  };
  sounds.intro.volume = 0.72;
  sounds.extraction.volume = 0.92;
  sounds.pop.volume = 1;

  let categories = loadCategories();
  let currentMode = null;
  let settingsTab = 'italian';
  let extracting = false;
  let soundOn = loadBoolean(STORAGE.sound, true);
  let bubbleTimer = null;

  initTheme();
  updateSoundUI();
  renderCounts();
  bindEvents();
  registerServiceWorker();

  // Splash: riprende l'introduzione del progetto Scratch, ma non rallenta gli avvii successivi.
  const firstThisSession = !sessionStorage.getItem('sbranapanda.seenSplash');
  if (firstThisSession) {
    sessionStorage.setItem('sbranapanda.seenSplash', '1');
    if (soundOn) playSound(sounds.intro);
    setTimeout(() => els.splash.classList.add('hidden'), 2350);
  } else {
    els.splash.classList.add('hidden');
  }

  function bindEvents() {
    els.italianBtn.addEventListener('click', () => chooseMode('italian'));
    els.challengeBtn.addEventListener('click', () => chooseMode('challenge'));
    els.pandaBtn.addEventListener('click', extractCategory);

    els.categoriesBtn.addEventListener('click', () => {
      settingsTab = currentMode || settingsTab;
      renderCategories();
      safeShowModal(els.categoriesDialog);
    });
    els.infoBtn.addEventListener('click', () => safeShowModal(els.infoDialog));

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => document.getElementById(btn.dataset.close)?.close());
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        settingsTab = tab.dataset.tab;
        renderCategories();
      });
    });

    els.selectAllBtn.addEventListener('click', () => setAll(true));
    els.selectNoneBtn.addEventListener('click', () => setAll(false));

    els.addCategoryForm.addEventListener('submit', event => {
      event.preventDefault();
      const name = normalizeName(els.newCategory.value);
      if (!name) return;
      categories[settingsTab].push({ id: cryptoId(), name, enabled: true });
      els.newCategory.value = '';
      saveCategories();
      renderCategories();
      renderCounts();
      playPop();
      requestAnimationFrame(() => els.categoryList.scrollTop = els.categoryList.scrollHeight);
    });

    els.resetCategoriesBtn.addEventListener('click', () => safeShowModal(els.confirmDialog));
    els.cancelResetBtn.addEventListener('click', () => els.confirmDialog.close());
    els.confirmResetBtn.addEventListener('click', () => {
      categories = makeDefaultState();
      saveCategories();
      els.confirmDialog.close();
      renderCategories();
      renderCounts();
      if (currentMode) chooseMode(currentMode, false);
      playPop();
    });

    els.soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      localStorage.setItem(STORAGE.sound, JSON.stringify(soundOn));
      updateSoundUI();
      if (soundOn) playPop(); else window.speechSynthesis?.cancel();
    });

    els.themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem(STORAGE.theme, document.body.classList.contains('dark') ? 'dark' : 'light');
      updateThemeUI();
    });

    els.fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', updateFullscreenUI);
  }

  function chooseMode(mode, doSound = true) {
    currentMode = mode;
    const isItalian = mode === 'italian';
    els.italianBtn.classList.toggle('selected', isItalian);
    els.challengeBtn.classList.toggle('selected', !isItalian);
    els.italianBtn.classList.toggle('dimmed', !isItalian);
    els.challengeBtn.classList.toggle('dimmed', isItalian);
    els.italianBtn.setAttribute('aria-pressed', String(isItalian));
    els.challengeBtn.setAttribute('aria-pressed', String(!isItalian));
    els.modeBadge.textContent = isItalian ? 'MUSICA ITALIANA' : 'SFIDA!';
    els.pandaBtn.classList.add('ready');
    const active = activeCategories(mode).length;
    els.categoryStatus.textContent = active ? `${active} ${active === 1 ? 'categoria attiva' : 'categorie attive'}` : 'Nessuna categoria attiva';
    els.instruction.textContent = active ? 'TOCCA IL PANDA PER ESTRARRE A CASO LA CATEGORIA' : 'ATTIVA ALMENO UNA CATEGORIA DAL PANNELLO CATEGORIE';
    if (doSound) playPop();
  }

  async function extractCategory() {
    if (extracting) return;
    if (!currentMode) {
      showBubble('Prima scegli una modalità!', false, 1900);
      return;
    }
    const available = activeCategories(currentMode);
    if (!available.length) {
      showBubble('Non ci sono categorie attive.', false, 2100);
      return;
    }

    extracting = true;
    els.pandaBtn.classList.remove('ready');
    els.pandaBtn.classList.add('extracting');
    window.speechSynthesis?.cancel();
    if (soundOn) {
      sounds.extraction.currentTime = 0;
      playSound(sounds.extraction);
    }

    showBubble('Siete pronti?');
    await wait(2000);
    showBubble('Bisogna indovinare…');
    await wait(2000);

    const selected = available[Math.floor(Math.random() * available.length)];
    showBubble(selected.name, true, 6200);
    els.categoryStatus.textContent = `Estratta: ${selected.name}`;
    speakItalian(selected.name);

    els.pandaBtn.classList.remove('extracting');
    els.pandaBtn.classList.add('ready');
    extracting = false;
  }

  function showBubble(text, result = false, autoHide = 0) {
    clearTimeout(bubbleTimer);
    els.speechBubble.textContent = text;
    els.speechBubble.classList.toggle('result', result);
    els.speechBubble.classList.add('show');
    if (autoHide) bubbleTimer = setTimeout(() => els.speechBubble.classList.remove('show'), autoHide);
  }

  function speakItalian(text) {
    if (!soundOn || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = 0.82;
    utterance.pitch = 0.68; // leggermente più "gigante", come la voce GIANT di Scratch
    utterance.volume = 1;
    const voices = speechSynthesis.getVoices();
    const italianVoice = voices.find(v => /^it(-|_)/i.test(v.lang)) || voices.find(v => /ital/i.test(v.name));
    if (italianVoice) utterance.voice = italianVoice;
    speechSynthesis.speak(utterance);
  }

  function renderCategories() {
    document.querySelectorAll('.tab').forEach(tab => {
      const active = tab.dataset.tab === settingsTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    els.categoryList.replaceChildren();
    categories[settingsTab].forEach(item => {
      const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
      const toggle = row.querySelector('.categoryToggle');
      const input = row.querySelector('.categoryName');
      const del = row.querySelector('.deleteCategory');
      toggle.checked = item.enabled;
      input.value = item.name;

      toggle.addEventListener('change', () => {
        item.enabled = toggle.checked;
        saveCategories();
        updateActiveSummary();
        renderCounts();
        if (currentMode === settingsTab) chooseMode(currentMode, false);
      });

      input.addEventListener('change', () => {
        const nextName = normalizeName(input.value);
        if (!nextName) {
          input.value = item.name;
          return;
        }
        item.name = nextName;
        input.value = nextName;
        saveCategories();
        renderCounts();
      });

      del.addEventListener('click', () => {
        categories[settingsTab] = categories[settingsTab].filter(c => c.id !== item.id);
        saveCategories();
        renderCategories();
        renderCounts();
        if (currentMode === settingsTab) chooseMode(currentMode, false);
      });

      els.categoryList.append(row);
    });
    updateActiveSummary();
  }

  function setAll(enabled) {
    categories[settingsTab].forEach(item => item.enabled = enabled);
    saveCategories();
    renderCategories();
    renderCounts();
    if (currentMode === settingsTab) chooseMode(currentMode, false);
  }

  function updateActiveSummary() {
    const total = categories[settingsTab].length;
    const active = activeCategories(settingsTab).length;
    els.activeSummary.textContent = `${active} attive su ${total}`;
  }

  function renderCounts() {
    const i = activeCategories('italian').length;
    const c = activeCategories('challenge').length;
    els.italianCount.textContent = `${i} ${i === 1 ? 'categoria' : 'categorie'}`;
    els.challengeCount.textContent = `${c} ${c === 1 ? 'categoria' : 'categorie'}`;
  }

  function activeCategories(mode) {
    return categories[mode].filter(item => item.enabled && normalizeName(item.name));
  }

  function saveCategories() {
    try { localStorage.setItem(STORAGE.categories, JSON.stringify(categories)); } catch (_) {}
  }

  function loadCategories() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE.categories));
      if (saved && Array.isArray(saved.italian) && Array.isArray(saved.challenge)) {
        return {
          italian: sanitizeList(saved.italian),
          challenge: sanitizeList(saved.challenge)
        };
      }
    } catch (_) {}
    return makeDefaultState();
  }

  function sanitizeList(list) {
    return list
      .filter(x => x && typeof x === 'object' && typeof x.name === 'string')
      .map(x => ({ id: String(x.id || cryptoId()), name: normalizeName(x.name), enabled: x.enabled !== false }))
      .filter(x => x.name);
  }

  function normalizeName(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  }

  function cryptoId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  }

  function loadBoolean(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return typeof v === 'boolean' ? v : fallback;
    } catch (_) { return fallback; }
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE.theme);
    const wantsDark = saved === 'dark' || (!saved && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('dark', wantsDark);
    updateThemeUI();
  }

  function updateThemeUI() {
    const dark = document.body.classList.contains('dark');
    els.themeBtn.textContent = dark ? '☀' : '☾';
    els.themeBtn.setAttribute('aria-label', dark ? 'Attiva modalità giorno' : 'Attiva modalità notte');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1518' : '#f8fbfc');
  }

  function updateSoundUI() {
    els.soundBtn.textContent = soundOn ? '🔊' : '🔇';
    els.soundBtn.setAttribute('aria-label', soundOn ? 'Disattiva suoni' : 'Attiva suoni');
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (_) {}
  }

  function updateFullscreenUI() {
    els.fullscreenBtn.textContent = document.fullscreenElement ? '↙' : '⛶';
    els.fullscreenBtn.setAttribute('aria-label', document.fullscreenElement ? 'Esci da schermo intero' : 'Schermo intero');
  }

  function safeShowModal(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function playSound(audio) {
    if (!soundOn) return;
    const p = audio.play();
    if (p?.catch) p.catch(() => {});
  }
  function playPop() { playSound(sounds.pop); }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
    }
  }
})();
