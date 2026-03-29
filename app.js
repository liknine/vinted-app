const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.enableClosingConfirmation();
}

const CONDITION_OPTIONS = [
  { id: 6, label: 'Новое с биркой' },
  { id: 1, label: 'Новое без бирки' },
  { id: 2, label: 'Отличное' },
  { id: 3, label: 'Хорошее' },
  { id: 4, label: 'Удовлетворительное' },
];

const PLANS = {
  week: { name: '1 Неделя', crypto: '3.00', stars: 150, days: 7 },
  month: { name: '1 Месяц', crypto: '10.00', stars: 500, days: 30 },
  '3months': { name: '3 Месяца', crypto: '25.00', stars: 1250, days: 100 },
  year: { name: '1 Год', crypto: '100.00', stars: 5000, days: 365 },
  forever: { name: 'Навсегда', crypto: '150.00', stars: 7500, days: 9999 },
};

const state = {
  userId: 0,
  premiumDays: 0,
  searches: [],
  editingId: null,
};

function $(selector) {
  return document.querySelector(selector);
}

function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function parseSearches() {
  try {
    const raw = getQueryParam('searches');
    if (!raw) return [];
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

function toast(message) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2200);
}

function sendAction(payload) {
  const data = JSON.stringify(payload);
  if (tg?.sendData) {
    tg.sendData(data);
    toast('Данные отправлены боту');
  } else {
    console.log('WebApp payload', payload);
    toast('Telegram WebApp недоступен в браузере');
  }
}

function selectedDomains() {
  const select = $('#domain');
  return Array.from(select.selectedOptions).map(opt => opt.value);
}

function selectedConditions() {
  return Array.from(document.querySelectorAll('.condition-chip input:checked')).map(inp => Number(inp.value));
}

function resetForm() {
  $('#searchForm').reset();
  state.editingId = null;
  $('#formTitle').textContent = 'Новая засада';
  $('#submitBtn').textContent = 'Создать засаду';
  $('#cancelEditBtn').classList.add('hidden');

  const options = Array.from($('#domain').options);
  options.forEach(opt => {
    opt.selected = opt.value === 'vinted.fr';
  });

  document.querySelectorAll('.condition-chip input').forEach(inp => {
    inp.checked = [6, 1, 2, 3, 4].includes(Number(inp.value));
    inp.closest('.condition-chip')?.classList.toggle('active', inp.checked);
  });
}

function planCard(planKey, compact = false) {
  const plan = PLANS[planKey];
  const wrapper = document.createElement('article');
  wrapper.className = 'plan-card';
  wrapper.innerHTML = `
    <div class="plan-card__name">${plan.name}</div>
    <div class="plan-card__prices">
      <div>⭐️ ${plan.stars} Stars</div>
      <div>💳 ${plan.crypto} USDT</div>
      <div>📆 ${plan.days} дней</div>
    </div>
    <div class="plan-card__actions">
      <button class="primary-btn">Stars</button>
      <button class="ghost-btn">Crypto</button>
    </div>
  `;

  const [starsBtn, cryptoBtn] = wrapper.querySelectorAll('button');
  starsBtn.addEventListener('click', () => sendAction({ action: 'buy_stars', plan: planKey }));
  cryptoBtn.addEventListener('click', () => sendAction({ action: 'buy_crypto', plan: planKey }));

  if (compact) {
    wrapper.style.padding = '14px';
  }
  return wrapper;
}

function renderPlans() {
  const strip = $('#planStrip');
  const grid = $('#plansGrid');
  strip.innerHTML = '';
  grid.innerHTML = '';

  ['week', 'month', '3months', 'year', 'forever'].forEach(key => {
    strip.appendChild(planCard(key, true));
    grid.appendChild(planCard(key, false));
  });
}

function heroStat(label, value) {
  const box = document.createElement('div');
  box.className = 'stat-box';
  box.innerHTML = `<div class="stat-box__label">${label}</div><div class="stat-box__value">${value}</div>`;
  return box;
}

function renderHero() {
  const heroStats = $('#heroStats');
  heroStats.innerHTML = '';
  heroStats.appendChild(heroStat('User ID', state.userId || '—'));
  heroStats.appendChild(heroStat('Premium', state.premiumDays > 0 ? `${state.premiumDays} дн.` : 'не активен'));
  heroStats.appendChild(heroStat('Активных засад', state.searches.length));
  heroStats.appendChild(heroStat('Лимит', '10 поисков'));
}

function searchFilterPill(text) {
  const span = document.createElement('span');
  span.className = 'filter-pill';
  span.textContent = text;
  return span;
}

function editSearch(search) {
  state.editingId = Number(search.id);
  $('#formTitle').textContent = `Редактирование #${search.id}`;
  $('#submitBtn').textContent = 'Сохранить поиск';
  $('#cancelEditBtn').classList.remove('hidden');

  $('#query').value = search.query || '';
  $('#category').value = search.category || 'all';
  $('#size').value = search.size || '';
  $('#min_price').value = Number(search.min_price || 0) || '';
  $('#max_price').value = Number(search.max_price || 0) || '';
  $('#minus_words').value = search.minus_words || '';

  const domains = String(search.domain || 'vinted.fr').split(',').map(x => x.trim()).filter(Boolean);
  Array.from($('#domain').options).forEach(opt => {
    opt.selected = domains.includes(opt.value);
  });

  let conditions = [];
  try {
    conditions = typeof search.conditions === 'string' ? JSON.parse(search.conditions || '[]') : (search.conditions || []);
  } catch {
    conditions = [];
  }

  document.querySelectorAll('.condition-chip input').forEach(inp => {
    inp.checked = conditions.includes(Number(inp.value));
    inp.closest('.condition-chip')?.classList.toggle('active', inp.checked);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderSearchList() {
  const list = $('#searchList');
  const label = $('#searchCountLabel');
  list.innerHTML = '';
  label.textContent = `${state.searches.length} активных поисков`;

  if (!state.searches.length) {
    list.innerHTML = '<div class="empty-state">У тебя пока нет засад. Создай первую справа/слева в форме.</div>';
    return;
  }

  const tpl = $('#searchCardTemplate');

  state.searches.forEach(search => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector('.search-card__title').textContent = search.query || 'Без запроса';
    node.querySelector('.search-card__meta').textContent = `${search.domain || 'vinted.fr'} • ${search.category || 'all'}`;

    const filterBox = node.querySelector('.search-card__filters');
    filterBox.appendChild(searchFilterPill(`Размер: ${search.size || 'любой'}`));
    filterBox.appendChild(searchFilterPill(`Цена: ${Number(search.min_price || 0)} - ${Number(search.max_price || 0) || '∞'}`));
    if (search.minus_words) filterBox.appendChild(searchFilterPill(`Минус: ${search.minus_words}`));

    let conditions = [];
    try {
      conditions = typeof search.conditions === 'string' ? JSON.parse(search.conditions || '[]') : (search.conditions || []);
    } catch {
      conditions = [];
    }
    if (conditions.length) filterBox.appendChild(searchFilterPill(`Состояние: ${conditions.join(', ')}`));

    node.querySelector('.search-edit').addEventListener('click', () => editSearch(search));
    node.querySelector('.search-delete').addEventListener('click', () => {
      if (!confirm(`Удалить поиск #${search.id}?`)) return;
      sendAction({ action: 'delete', search_id: Number(search.id) });
    });

    list.appendChild(node);
  });
}

function renderConditionChips() {
  const root = $('#conditionChips');
  root.innerHTML = '';
  CONDITION_OPTIONS.forEach(option => {
    const label = document.createElement('label');
    label.className = 'condition-chip active';
    label.innerHTML = `
      <input type="checkbox" value="${option.id}" checked>
      <span>${option.label}</span>
    `;
    const input = label.querySelector('input');
    label.addEventListener('click', () => {
      requestAnimationFrame(() => label.classList.toggle('active', input.checked));
    });
    root.appendChild(label);
  });
}

function bindForm() {
  $('#searchForm').addEventListener('submit', event => {
    event.preventDefault();

    const query = $('#query').value.trim();
    if (!query) {
      toast('Заполни поле запроса');
      return;
    }

    const domains = selectedDomains();
    if (!domains.length) {
      toast('Выбери хотя бы один домен');
      return;
    }

    const payload = {
      action: state.editingId ? 'edit' : 'create',
      search_id: state.editingId,
      query,
      domain: domains,
      category: $('#category').value,
      size: $('#size').value.trim(),
      min_price: $('#min_price').value ? Number($('#min_price').value) : 0,
      max_price: $('#max_price').value ? Number($('#max_price').value) : 0,
      minus_words: $('#minus_words').value.trim(),
      conditions: selectedConditions(),
    };

    sendAction(payload);
  });

  $('#cancelEditBtn').addEventListener('click', () => resetForm());
}

function bindModal() {
  $('#showPlansBtn').addEventListener('click', () => $('#plansModal').classList.remove('hidden'));
  document.querySelectorAll('[data-close="plansModal"]').forEach(el => {
    el.addEventListener('click', () => $('#plansModal').classList.add('hidden'));
  });
}

function initState() {
  state.userId = Number(getQueryParam('id') || 0);
  state.premiumDays = Number(getQueryParam('days') || 0);
  state.searches = parseSearches();
}

function init() {
  initState();
  renderConditionChips();
  renderPlans();
  renderHero();
  renderSearchList();
  bindForm();
  bindModal();
  resetForm();
}

init();
