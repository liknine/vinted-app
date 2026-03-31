(function () {
  'use strict';

  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#06090f');
    tg.setBackgroundColor('#06090f');
  }

  // ── URL params ──
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('id') || '0';
  const premiumDays = parseInt(params.get('days') || '0', 10);
  let searches = [];
  try {
    searches = JSON.parse(decodeURIComponent(params.get('searches') || '[]'));
  } catch (e) {
    searches = [];
  }

  // ── Config ──
  const PLANS = {
    week:      { name: '1 Неделя',  crypto: '3.00',   stars: 150 },
    month:     { name: '1 Месяц',   crypto: '10.00',  stars: 500,  popular: true },
    '3months': { name: '3 Месяца',  crypto: '25.00',  stars: 1250 },
    year:      { name: '1 Год',     crypto: '100.00', stars: 5000 },
    forever:   { name: 'Навсегда',  crypto: '150.00', stars: 7500 },
  };

  const DOMAINS = [
    { value: 'vinted.fr', flag: '🇫🇷', label: 'Франция' },
    { value: 'vinted.de', flag: '🇩🇪', label: 'Германия' },
    { value: 'vinted.it', flag: '🇮🇹', label: 'Италия' },
    { value: 'vinted.es', flag: '🇪🇸', label: 'Испания' },
    { value: 'vinted.pl', flag: '🇵🇱', label: 'Польша' },
  ];

  const CONDITIONS = [
    { id: '6', label: 'Новое с бирками' },
    { id: '1', label: 'Новое' },
    { id: '2', label: 'Очень хорошее' },
    { id: '3', label: 'Хорошее' },
    { id: '4', label: 'Удовлетворительное' },
  ];

  // ── State ──
  let editingId = null;
  let selectedConditions = new Set();
  let selectedDomains = new Set(['vinted.fr']);

  // ── DOM ──
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const tabPages = $$('.tab-page');
  const navItems = $$('.nav-item');
  const searchForm = $('#searchForm');
  const formTitle = $('#formTitle');
  const cancelEditBtn = $('#cancelEditBtn');
  const submitBtn = $('#submitBtn');
  const searchList = $('#searchList');
  const searchCountLabel = $('#searchCountLabel');
  const conditionChips = $('#conditionChips');
  const domainGrid = $('#domainGrid');
  const toastEl = $('#toast');

  // ── Tabs ──
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tab;
      tabPages.forEach(p => p.classList.remove('active'));
      navItems.forEach(n => n.classList.remove('active'));
      $('#' + id).classList.add('active');
      btn.classList.add('active');
    });
  });

  // ── Toast ──
  let toastTimer;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2800);
  }

  // ── Send to bot ──
  function sendData(data) {
    if (tg) {
      tg.sendData(JSON.stringify(data));
    } else {
      console.log('sendData:', data);
      showToast('Отправлено (dev)');
    }
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Render domains ──
  function renderDomains() {
    domainGrid.innerHTML = '';
    DOMAINS.forEach(d => {
      const el = document.createElement('div');
      el.className = 'domain-item' + (selectedDomains.has(d.value) ? ' active' : '');
      el.innerHTML = `
        <span class="domain-flag">${d.flag}</span>
        <span class="domain-label">${d.label}</span>
        <div class="domain-check"><div class="domain-check-inner"></div></div>
      `;
      el.addEventListener('click', () => {
        if (selectedDomains.has(d.value)) {
          if (selectedDomains.size > 1) {
            selectedDomains.delete(d.value);
            el.classList.remove('active');
          } else {
            showToast('Нужен хотя бы один домен');
          }
        } else {
          selectedDomains.add(d.value);
          el.classList.add('active');
        }
      });
      domainGrid.appendChild(el);
    });
  }

  // ── Render conditions ──
  function renderConditions() {
    conditionChips.innerHTML = '';
    CONDITIONS.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (selectedConditions.has(c.id) ? ' active' : '');
      chip.textContent = c.label;
      chip.addEventListener('click', () => {
        if (selectedConditions.has(c.id)) {
          selectedConditions.delete(c.id);
          chip.classList.remove('active');
        } else {
          selectedConditions.add(c.id);
          chip.classList.add('active');
        }
      });
      conditionChips.appendChild(chip);
    });
  }

  // ── Render profile ──
  function renderProfile() {
    const user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user) {
      $('#profileAvatar').textContent = (user.first_name || '?')[0].toUpperCase();
      $('#profileName').textContent = [user.first_name, user.last_name].filter(Boolean).join(' ');
      $('#profileUsername').textContent = user.username ? '@' + user.username : '';
    }
    $('#statId').textContent = userId;
    $('#statPremium').textContent = premiumDays > 0 ? 'Активен' : 'Нет';
    $('#statDays').textContent = premiumDays;
    $('#statSearches').textContent = searches.length;
  }

  // ── Render subscription ──
  function renderSubscription() {
    const dot = $('#subStatusDot');
    if (premiumDays > 0) {
      dot.className = 'sub-status-dot on';
      $('#subStatusTitle').textContent = `Premium — ${premiumDays} дн.`;
      $('#subStatusDesc').textContent = 'Ты можешь создавать и редактировать засады';
    } else {
      dot.className = 'sub-status-dot off';
      $('#subStatusTitle').textContent = 'Premium не активен';
      $('#subStatusDesc').textContent = 'Оформи подписку для работы бота';
    }

    const list = $('#plansList');
    list.innerHTML = '';

    Object.entries(PLANS).forEach(([key, plan]) => {
      const card = document.createElement('div');
      card.className = 'plan-card' + (plan.popular ? ' popular' : '');
      card.innerHTML = `
        <div class="plan-head">
          <div class="plan-name">${plan.name}</div>
          ${plan.popular ? '<span class="plan-badge">Популярный</span>' : ''}
        </div>
        <div class="plan-prices">
          <div>⭐️ ${plan.stars} Stars</div>
          <div>💎 ${plan.crypto} USDT</div>
        </div>
        <div class="plan-actions">
          <button class="btn-stars" data-plan="${key}" data-method="stars">⭐️ Stars</button>
          <button class="btn-crypto" data-plan="${key}" data-method="crypto">💎 Crypto</button>
          <button class="btn-card-pay" data-plan="${key}" data-method="card">💳 Карта</button>
        </div>
      `;

      card.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = btn.dataset.method;
          const p = btn.dataset.plan;
          if (m === 'stars') {
            sendData({ action: 'buy_stars', plan: p });
          } else if (m === 'crypto') {
            sendData({ action: 'buy_crypto', plan: p });
          } else {
            if (tg) {
              tg.openTelegramLink('https://t.me/liknine');
            } else {
              window.open('https://t.me/liknine', '_blank');
            }
            showToast('Напиши @liknine для оплаты картой');
          }
        });
      });

      list.appendChild(card);
    });
  }

  // ── Render searches ──
  function renderSearches() {
    searchList.innerHTML = '';
    searchCountLabel.textContent = searches.length;

    if (!searches.length) {
      searchList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">—</div>
          <div class="empty-state-text">Нет активных засад<br>Создай первую во вкладке «Поиск»</div>
        </div>
      `;
      return;
    }

    searches.forEach(s => {
      const card = document.createElement('div');
      card.className = 'search-card';

      const domains = (s.domain || 'vinted.fr').split(',').map(d => d.trim()).join(', ');
      const filters = [];
      if (s.category && s.category !== 'all') filters.push(s.category === 'clothes' ? 'Одежда' : 'Обувь');
      if (s.size) filters.push('Size: ' + s.size);
      if (s.min_price > 0) filters.push('от ' + s.min_price);
      if (s.max_price > 0) filters.push('до ' + s.max_price);
      if (s.minus_words) filters.push('−' + s.minus_words);

      let condLabels = [];
      try {
        const conds = typeof s.conditions === 'string' ? JSON.parse(s.conditions) : (s.conditions || []);
        conds.forEach(c => {
          const f = CONDITIONS.find(x => x.id === String(c));
          if (f) condLabels.push(f.label);
        });
      } catch(e) {}

      card.innerHTML = `
        <div class="search-card-top">
          <div>
            <div class="search-card-title">${escHtml(s.query || '—')}</div>
            <div class="search-card-meta">${escHtml(domains)}</div>
          </div>
          <div class="badge-active">Активен</div>
        </div>
        <div class="search-card-filters">
          ${filters.map(f => `<span class="filter-tag">${escHtml(f)}</span>`).join('')}
          ${condLabels.map(c => `<span class="filter-tag">${escHtml(c)}</span>`).join('')}
        </div>
        <div class="search-card-actions">
          <button class="btn-secondary edit-btn">Изменить</button>
          <button class="btn-danger delete-btn">Удалить</button>
        </div>
      `;

      card.querySelector('.edit-btn').addEventListener('click', () => startEdit(s));
      card.querySelector('.delete-btn').addEventListener('click', () => {
        if (confirm('Удалить засаду «' + s.query + '»?')) {
          sendData({ action: 'delete', search_id: s.id });
        }
      });

      searchList.appendChild(card);
    });
  }

  // ── Edit ──
  function startEdit(s) {
    editingId = s.id;
    formTitle.textContent = 'Редактирование';
    cancelEditBtn.classList.remove('hidden');
    submitBtn.textContent = 'Сохранить';

    $('#query').value = s.query || '';
    $('#size').value = s.size || '';
    $('#min_price').value = s.min_price || '';
    $('#max_price').value = s.max_price || '';
    $('#minus_words').value = s.minus_words || '';
    $('#category').value = s.category || 'all';

    selectedDomains.clear();
    (s.domain || 'vinted.fr').split(',').forEach(d => {
      d = d.trim();
      if (DOMAINS.some(x => x.value === d)) selectedDomains.add(d);
    });
    if (!selectedDomains.size) selectedDomains.add('vinted.fr');
    renderDomains();

    selectedConditions.clear();
    try {
      const conds = typeof s.conditions === 'string' ? JSON.parse(s.conditions) : (s.conditions || []);
      conds.forEach(c => selectedConditions.add(String(c)));
    } catch(e) {}
    renderConditions();

    // Switch to search tab
    tabPages.forEach(p => p.classList.remove('active'));
    navItems.forEach(n => n.classList.remove('active'));
    $('#tabSearches').classList.add('active');
    navItems[0].classList.add('active');

    $('#formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    editingId = null;
    formTitle.textContent = 'Новая засада';
    cancelEditBtn.classList.add('hidden');
    submitBtn.textContent = 'Создать засаду';
    searchForm.reset();
    selectedConditions.clear();
    selectedDomains.clear();
    selectedDomains.add('vinted.fr');
    renderConditions();
    renderDomains();
  }

  cancelEditBtn.addEventListener('click', cancelEdit);

  // ── Submit ──
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = $('#query').value.trim();
    if (!query) {
      showToast('Введи, что искать');
      return;
    }

    const data = {
      query: query,
      domain: Array.from(selectedDomains),
      category: $('#category').value,
      size: $('#size').value.trim(),
      min_price: parseFloat($('#min_price').value) || 0,
      max_price: parseFloat($('#max_price').value) || 0,
      minus_words: $('#minus_words').value.trim(),
      conditions: Array.from(selectedConditions),
    };

    if (editingId) {
      data.action = 'edit';
      data.search_id = editingId;
      showToast('Засада обновляется…');
    } else {
      showToast('Засада создаётся…');
    }

    sendData(data);
  });

  // ── Init ──
  renderDomains();
  renderConditions();
  renderProfile();
  renderSubscription();
  renderSearches();

})();