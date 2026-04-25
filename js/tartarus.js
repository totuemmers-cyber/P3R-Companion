(() => {
const ELEM_NAMES = {
  fir: 'Fire',
  ice: 'Ice',
  ele: 'Elec',
  win: 'Wind',
  lig: 'Light',
  dar: 'Dark',
  alm: 'Almighty',
  sla: 'Slash',
  str: 'Strike',
  pie: 'Pierce',
  rec: 'Recovery',
  sup: 'Support',
  ail: 'Ailment',
  pas: 'Passive',
  spe: 'Special'
};

let tartRoot;
let tartStore;
let initialized = false;
let storeRenderQueued = false;

function setActiveTartarusView(view) {
  tartRoot.querySelectorAll('.nav-tab').forEach((entry) => {
    entry.classList.toggle('active', entry.dataset.view === view);
  });
}

function showTartarusView(view) {
  tartRoot.querySelector('#floorOpsView').classList.toggle('active', view === 'database');
  tartRoot.querySelector('#shadowIntelView').classList.toggle('active', view === 'shadowintel');
  tartRoot.querySelector('#fullmoonSection').classList.toggle('active', view === 'fullmoon');
  state.view = view;
  setActiveTartarusView(view);
}

function getRosterSet() {
  if (!tartStore) {
    return new Set();
  }
  return new Set(tartStore.getState().roster);
}

function parseResists(resists) {
  if (!resists) {
    return {};
  }
  const parsed = {};
  for (let index = 0; index < Math.min(resists.length, RESIST_KEYS.length); index += 1) {
    parsed[RESIST_KEYS[index]] = resists[index] || '-';
  }
  return parsed;
}

function parseArea(area) {
  const result = {
    block: null,
    subBlock: null,
    floorMin: null,
    floorMax: null,
    type: 'other',
    raw: area
  };

  if (!area) {
    return result;
  }

  const blockMatch = area.match(/^(Thebel|Arqa|Yabbashah|Tziah|Harabah|Adamah)/i);
  if (blockMatch) {
    result.block = blockMatch[1].toLowerCase();
  }

  const subBlockMatch = area.match(/(I{1,2})\s/);
  if (subBlockMatch) {
    result.subBlock = subBlockMatch[1];
  }

  if (/Full Moon/.test(area)) {
    result.type = 'fullmoon';
  } else if (/\sD\d/.test(area)) {
    result.type = 'monad-door';
  } else if (/\sP\d/.test(area)) {
    result.type = 'monad-passage';
  } else if (/\d+-\d+/.test(area)) {
    result.type = 'regular';
    const floorMatch = area.match(/(\d+)-(\d+)/);
    if (floorMatch) {
      result.floorMin = Number(floorMatch[1]);
      result.floorMax = Number(floorMatch[2]);
    }
  } else if (/\d+$/.test(area)) {
    result.type = 'gatekeeper';
    const floorMatch = area.match(/(\d+)$/);
    if (floorMatch) {
      result.floorMin = Number(floorMatch[1]);
      result.floorMax = Number(floorMatch[1]);
    }
  }

  return result;
}

const ALL_SHADOWS = Object.entries(ENEMY_RAW).map(([name, data]) => {
  const parsedArea = parseArea(data.area);
  const parsedResists = parseResists(data.resists);
  return {
    name,
    ...data,
    ...parsedArea,
    resists: parsedResists,
    type: parsedArea.type,
    isBoss: Boolean(data.boss),
    arcana: data.race ? data.race.replace(/\s*[BP]$/, '') : 'Unknown',
    hp: data.stats ? data.stats[0] : 0,
    sp: data.stats ? data.stats[1] : 0,
    st: data.stats ? data.stats[2] : 0,
    ma: data.stats ? data.stats[3] : 0,
    en: data.stats ? data.stats[4] : 0,
    ag: data.stats ? data.stats[5] : 0,
    lu: data.stats ? data.stats[6] : 0
  };
});

const state = {
  query: '',
  blockFilter: null,
  typeFilters: new Set(),
  weakFilter: '',
  ailmentFilter: '',
  lvlMin: 0,
  lvlMax: 99,
  sortCol: 'lvl',
  sortDir: 'asc',
  expandedRow: null,
  view: 'database'
};

const floorScoutSections = {
  regular: false,
  monad: false,
  gatekeepers: false,
  loot: false,
  grind: false,
  loadout: false
};

const MONTH_NAME_TO_NUM = {
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
  January: 1
};

const OBJECTIVE_TYPE_LABELS = {
  'old-document': 'Old Document',
  'progress-report': 'Progress Report',
  'missing-person': 'Missing Person'
};

const CHEST_IMPORTANCE_LABELS = {
  key: 'Key reward',
  unique: 'Unique',
  rare: 'Rare',
  valuable: 'Valuable'
};

const CHEST_TYPE_LABELS = {
  fixed: 'Fixed chest',
  locked: 'Locked chest',
  'monad-passage': 'Monad Passage',
  'boss-floor-locked': 'Boss-floor chest'
};

const MONAD_SECTION_BANDS = [
  { floorMin: 70, floorMax: 94, label: 'Yabbashah 70F-94F', section: 'Yabbashah I' },
  { floorMin: 95, floorMax: 118, label: 'Yabbashah 95F-118F', section: 'Yabbashah II' },
  { floorMin: 119, floorMax: 142, label: 'Tziah 119F-142F', section: 'Tziah I' },
  { floorMin: 145, floorMax: 172, label: 'Tziah 145F-172F', section: 'Tziah II' },
  { floorMin: 173, floorMax: 197, label: 'Harabah 173F-197F', section: 'Harabah I' },
  { floorMin: 199, floorMax: 224, label: 'Harabah 199F-224F', section: 'Harabah II' },
  { floorMin: 227, floorMax: 251, label: 'Adamah 227F-251F', section: 'Adamah I' }
];

const MONAD_VARIANT_LABELS = {
  'monad-door': 'Monad Door',
  'monad-passage': 'Monad Passage'
};

const FULL_MOON_SCHEDULE = FULL_MOON_DATES.map((entry) => ({
  ...entry,
  parsedDate: parseMonthDayLabel(entry.date),
  primaryStrategy: entry.names.length > 0 ? BOSS_STRATS[entry.names[0]] : null
}));

const RESIST_ORDER = {
  z: -2,
  Z: -2,
  v: -1,
  V: -1,
  w: -1,
  W: -1,
  '-': 0,
  _: 0,
  u: 0,
  t: 1,
  s: 1,
  S: 1,
  T: 2,
  n: 2,
  r: 3,
  d: 4
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCurrentProfile() {
  return (
    tartStore?.getState()?.profile || {
      gameDate: { month: 4, day: 7 },
      playerLevel: 1,
      currentFloor: 2,
      stats: { academics: 1, charm: 1, courage: 1 }
    }
  );
}

function getCurrentGameDate() {
  return getCurrentProfile().gameDate || { month: 4, day: 7 };
}

function getCurrentPlayerLevel() {
  return getCurrentProfile().playerLevel || 1;
}

function extractStrategyPersonaName(value) {
  return String(value || '').split(' (')[0].trim();
}

function getStrategyPersonaLevel(value) {
  const name = extractStrategyPersonaName(value);
  return PERSONAS[name]?.lvl || null;
}

function renderStrategyPersonaBadge(persona) {
  const level = getStrategyPersonaLevel(persona);
  const levelText = level ? ` Lv ${level}` : '';
  return `<span class="strat-badge strat-persona">${escapeHtml(persona)}${escapeHtml(levelText)}</span>`;
}

function renderLockedStrategyPersonaBadge(persona, currentLevel) {
  const level = getStrategyPersonaLevel(persona);
  const suffix = level ? ` Lv ${level} / current Lv ${currentLevel}` : ' level unknown';
  return `<span class="strat-badge strat-persona strat-persona-locked">${escapeHtml(persona)}${escapeHtml(
    ` (${suffix})`
  )}</span>`;
}

function renderStrategyPersonaRows(personas, availableLabel = 'Personas') {
  if (!personas || personas.length === 0) {
    return '';
  }

  const currentLevel = getCurrentPlayerLevel();
  const available = [];
  const locked = [];

  personas.forEach((persona) => {
    const level = getStrategyPersonaLevel(persona);
    if (!level || level <= currentLevel) {
      available.push(persona);
    } else {
      locked.push(persona);
    }
  });

  let html = '';
  if (available.length > 0) {
    html += `<div class="strat-row"><span class="strat-label">${escapeHtml(availableLabel)}:</span> ${available
      .map(renderStrategyPersonaBadge)
      .join(' ')}</div>`;
  }
  if (locked.length > 0) {
    html += `<div class="strat-row strat-row-locked"><span class="strat-label">Later Options:</span> ${locked
      .map((persona) => renderLockedStrategyPersonaBadge(persona, currentLevel))
      .join(' ')}</div>`;
  }
  return html;
}

function getLevelReadiness(currentLevel, recommendedLevel) {
  if (!recommendedLevel || !currentLevel) {
    return null;
  }

  const diff = currentLevel - recommendedLevel;
  if (diff <= -5) {
    return `Current Lv ${currentLevel} - well below the comfort point (target around Lv ${recommendedLevel}).`;
  }
  if (diff < 0) {
    return `Current Lv ${currentLevel} - slightly below the comfort point (target around Lv ${recommendedLevel}).`;
  }
  if (diff <= 3) {
    return `Current Lv ${currentLevel} - on pace for a safe attempt.`;
  }
  return `Current Lv ${currentLevel} - ahead of the recommended pace.`;
}

function tartDateToNum(date) {
  const month = date.month >= 4 ? date.month : date.month + 12;
  return month * 100 + date.day;
}

function parseMonthDayLabel(label) {
  if (!label || typeof label !== 'string') {
    return null;
  }
  const parts = label.replace(',', '').split(/\s+/);
  if (parts.length < 2) {
    return null;
  }
  const month = MONTH_NAME_TO_NUM[parts[0]];
  const day = Number(parts[1]);
  if (!month || !Number.isFinite(day)) {
    return null;
  }
  return { month, day };
}

function parseObjectiveDate(label) {
  return parseMonthDayLabel(label || '');
}

function compareDates(left, right) {
  return tartDateToNum(left) - tartDateToNum(right);
}

function daysBetweenDates(left, right) {
  const leftYear = left.month >= 4 ? 2009 : 2010;
  const rightYear = right.month >= 4 ? 2009 : 2010;
  const leftDate = new Date(leftYear, left.month - 1, left.day);
  const rightDate = new Date(rightYear, right.month - 1, right.day);
  return Math.round((rightDate - leftDate) / 86400000);
}

function isObjectiveStale(objective) {
  if (isObjectiveComplete(objective.id)) {
    return false;
  }
  const deadlineDate = parseObjectiveDate(objective.deadline);
  return Boolean(deadlineDate && daysBetweenDates(getCurrentGameDate(), deadlineDate) < 0);
}

function formatMonthDay(date) {
  const monthName = Object.keys(MONTH_NAME_TO_NUM).find((entry) => MONTH_NAME_TO_NUM[entry] === date.month);
  return `${monthName || `M${date.month}`} ${date.day}`;
}

function getObjectiveList() {
  return Array.isArray(TARTARUS_OBJECTIVES) ? TARTARUS_OBJECTIVES : [];
}

function isObjectiveComplete(id) {
  return Boolean(tartStore?.getState()?.objectives?.[id]);
}

function getObjectiveState(objective) {
  const currentDate = getCurrentGameDate();
  const availableDate = parseObjectiveDate(objective.available);
  const deadlineDate = parseObjectiveDate(objective.deadline);

  if (isObjectiveComplete(objective.id)) {
    return { state: 'complete', label: 'Done', daysLeft: null };
  }
  if (availableDate && compareDates(currentDate, availableDate) < 0) {
    return {
      state: 'upcoming',
      label: `Opens ${objective.available}`,
      daysLeft: daysBetweenDates(currentDate, availableDate)
    };
  }
  if (deadlineDate) {
    const daysLeft = daysBetweenDates(currentDate, deadlineDate);
    if (daysLeft < 0) {
      return { state: 'expired', label: `Expired ${objective.deadline}`, daysLeft };
    }
    if (daysLeft <= 3) {
      return { state: 'urgent', label: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, daysLeft };
    }
    if (daysLeft <= 10) {
      return { state: 'soon', label: `${daysLeft} days left`, daysLeft };
    }
    return { state: 'active', label: `Deadline ${objective.deadline}`, daysLeft };
  }
  return { state: 'active', label: objective.available ? `Open since ${objective.available}` : 'Open', daysLeft: null };
}

function getObjectiveTone(objectiveState) {
  if (objectiveState.state === 'urgent' || objectiveState.state === 'expired') {
    return 'critical';
  }
  if (objectiveState.state === 'soon') {
    return 'warning';
  }
  if (objectiveState.state === 'complete') {
    return 'done';
  }
  return 'neutral';
}

function getWeaknessLabels(shadow) {
  return RESIST_KEYS.slice(0, 9)
    .filter((key) => {
      const code = shadow.resists[key];
      return code === 'w' || code === 'W' || code === 'v' || code === 'V' || code === 'z' || code === 'Z';
    })
    .map((key) => RESIST_LABELS[RESIST_KEYS.indexOf(key)]);
}

function getThreatElements(shadow) {
  const counts = {};
  (shadow.skills || []).forEach((skillName) => {
    const skill = SKILLS[skillName];
    if (!skill || !skill.elem || !RESIST_KEYS.includes(skill.elem)) {
      return;
    }
    counts[skill.elem] = (counts[skill.elem] || 0) + 1;
  });

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .map(([key]) => RESIST_LABELS[RESIST_KEYS.indexOf(key)])
    .slice(0, 3);
}

function buildGatekeeperPrep(shadow) {
  const checklist = [];
  const weaknesses = getWeaknessLabels(shadow);
  const threats = getThreatElements(shadow);
  const drops = shadow.dodds ? Object.keys(shadow.dodds).slice(0, 2) : [];

  if (weaknesses.length > 0) {
    checklist.push(`Push ${weaknesses.slice(0, 2).join(' / ')} weakness pressure early.`);
  } else {
    checklist.push('Expect a longer attrition fight; do not rely on a single weakness loop.');
  }
  if (threats.length > 0) {
    checklist.push(`Bring answers for ${threats.join(', ')} damage or status pressure.`);
  }
  checklist.push(`Treat Lv ${shadow.lvl} as the minimum comfort point before forcing the clear.`);
  if (drops.length > 0) {
    checklist.push(`Worth clearing for ${drops.join(', ')}.`);
  }

  return checklist.slice(0, 3);
}

function getNextFullMoon() {
  const currentDate = getCurrentGameDate();
  return (
    FULL_MOON_SCHEDULE.find((entry) => entry.parsedDate && compareDates(currentDate, entry.parsedDate) <= 0) ||
    FULL_MOON_SCHEDULE[FULL_MOON_SCHEDULE.length - 1] ||
    null
  );
}

function getMonadBandForFloor(floor) {
  return MONAD_SECTION_BANDS.find((band) => floor >= band.floorMin && floor <= band.floorMax) || null;
}

function getMonadEnemiesForFloor(floor, type) {
  const band = getMonadBandForFloor(floor);
  if (!band) {
    return { band: null, enemies: [] };
  }

  const enemies = ALL_SHADOWS.filter(
    (shadow) => shadow.type === type && shadow.area && shadow.area.startsWith(band.section)
  ).sort((left, right) => left.name.localeCompare(right.name));

  return { band, enemies };
}

function renderFloorAffinities(shadow, extraStyle = '') {
  let html = `<div class="floor-enemy-affs"${extraStyle ? ` style="${extraStyle}"` : ''}>`;
  const affMap = {
    w: { label: 'WK', cls: 'floor-aff-wk' },
    W: { label: 'WK', cls: 'floor-aff-wk' },
    v: { label: 'WK', cls: 'floor-aff-wk' },
    V: { label: 'WK', cls: 'floor-aff-wk' },
    z: { label: 'WK!', cls: 'floor-aff-z' },
    Z: { label: 'WK!', cls: 'floor-aff-z' },
    s: { label: 'RS', cls: 'floor-aff-rs' },
    S: { label: 'RS', cls: 'floor-aff-rs' },
    t: { label: 'RS', cls: 'floor-aff-rs' },
    T: { label: 'NU', cls: 'floor-aff-nu' },
    n: { label: 'NU', cls: 'floor-aff-nu' },
    r: { label: 'RP', cls: 'floor-aff-rp' },
    d: { label: 'ABS', cls: 'floor-aff-abs' }
  };
  RESIST_KEYS.slice(0, 9).forEach((key, index) => {
    const code = shadow.resists[key];
    if (code && code !== '-' && code !== '_' && code !== 'u' && affMap[code]) {
      html += `<span class="floor-aff ${affMap[code].cls}">${RESIST_LABELS[index]} ${affMap[code].label}</span>`;
    }
  });
  html += '</div>';
  return html;
}

function renderFloorEnemyName(shadow) {
  return `<button class="floor-shadow-link" type="button" data-shadow-name="${escapeHtml(shadow.name)}">${escapeHtml(
    shadow.name
  )}</button> <span class="floor-enemy-level">(Lv ${shadow.lvl})</span>`;
}

function getBlockExtra(blockId) {
  if (typeof BLOCK_EXTRAS === 'undefined') {
    return null;
  }
  return BLOCK_EXTRAS[blockId] || null;
}

function getMonadBandExtra(sectionName) {
  if (typeof MONAD_DOOR_BAND_EXTRAS === 'undefined') {
    return null;
  }
  return MONAD_DOOR_BAND_EXTRAS[sectionName] || null;
}

function renderMonadEncounterGroup(type, data) {
  if (!data.band || data.enemies.length === 0) {
    return '';
  }

  let html = `<div class="floor-monad-group"><div class="floor-monad-group-title">${escapeHtml(
    MONAD_VARIANT_LABELS[type] || type
  )}</div>`;
  html += `<div class="floor-monad-note">Possible encounters for ${escapeHtml(data.band.label)}.</div>`;
  const monadExtra = getMonadBandExtra(data.band.section);
  if (monadExtra) {
    html += `<div class="floor-intel-callout"><div class="floor-intel-note"><strong>Why check it:</strong> ${escapeHtml(monadExtra.why)}</div><div class="floor-intel-note"><strong>Prep:</strong> ${escapeHtml(monadExtra.prep)}</div></div>`;
  }
  data.enemies.forEach((shadow) => {
    html += `<div class="floor-enemy"><div class="floor-enemy-name">${renderFloorEnemyName(
      shadow
    )}</div>${renderFloorAffinities(shadow)}</div>`;
  });
  html += '</div>';
  return html;
}

function getFullMoonExtra(date) {
  if (typeof FULL_MOON_EXTRAS === 'undefined') {
    return null;
  }
  return FULL_MOON_EXTRAS[date] || null;
}

function renderGatekeeperPanel(title, shadow, options = {}) {
  const accentStyle = options.accentStyle || 'background:rgba(255,23,68,0.08);border:1px solid rgba(255,23,68,0.2)';
  const titleColor = options.titleColor || 'var(--wk)';
  let html = `<div class="floor-gatekeeper-panel" style="${accentStyle}">`;
  html += `<div style="font-size:0.8rem;color:${titleColor};font-weight:600">${escapeHtml(title)}</div>`;
  html += `<div style="font-size:0.85rem">${renderFloorEnemyName(shadow)}</div>`;
  html += renderFloorAffinities(shadow, 'margin-top:4px');
  const drops = shadow.dodds ? Object.keys(shadow.dodds).slice(0, 2) : [];
  if (drops.length) {
    html += `<div class="floor-intel-note">Possible rewards: ${drops.map((drop) => escapeHtml(drop)).join(', ')}</div>`;
  }
  const prepChecklist = buildGatekeeperPrep(shadow);
  if (prepChecklist.length > 0) {
    html += '<div class="floor-gatekeeper-prep">';
    prepChecklist.forEach((entry) => {
      html += `<div class="floor-intel-note">• ${escapeHtml(entry)}</div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function isFloorScoutSectionOpen(key) {
  return floorScoutSections[key] !== false;
}

function renderFloorScoutSection({ key, title, summary = '', tone, bodyHtml }) {
  const isOpen = isFloorScoutSectionOpen(key);
  return `<section class="floor-scout-section floor-scout-section-${escapeHtml(tone)}${isOpen ? ' is-open' : ''}">
    <button class="floor-scout-toggle" type="button" data-section="${escapeHtml(key)}" aria-expanded="${isOpen ? 'true' : 'false'}">
      <span class="floor-scout-toggle-copy">
        <span class="floor-scout-toggle-title">${escapeHtml(title)}</span>
        ${summary ? `<span class="floor-scout-toggle-summary">${escapeHtml(summary)}</span>` : ''}
      </span>
      <span class="floor-scout-toggle-chevron" aria-hidden="true">${isOpen ? '−' : '+'}</span>
    </button>
    <div class="floor-scout-section-body"${isOpen ? '' : ' hidden'}>
      ${bodyHtml}
    </div>
  </section>`;
}

function syncIntelControlsFromState() {
  const searchBox = tartRoot.querySelector('#searchBox');
  const blockFilter = tartRoot.querySelector('#blockFilter');
  const weakFilter = tartRoot.querySelector('#weakFilter');
  const lvlMin = tartRoot.querySelector('#lvlMin');
  const lvlMax = tartRoot.querySelector('#lvlMax');
  const ailmentFilter = tartRoot.querySelector('#ailmentFilter');

  if (searchBox) {
    searchBox.value = state.query;
  }
  if (blockFilter) {
    blockFilter.value = state.blockFilter || '';
  }
  if (weakFilter) {
    weakFilter.value = state.weakFilter;
  }
  if (lvlMin) {
    lvlMin.value = state.lvlMin || '';
  }
  if (lvlMax) {
    lvlMax.value = state.lvlMax && state.lvlMax < 99 ? state.lvlMax : '';
  }
  if (ailmentFilter) {
    ailmentFilter.value = state.ailmentFilter;
  }

  tartRoot.querySelectorAll('.filter-btn[data-type]').forEach((button) => {
    button.classList.toggle('active', state.typeFilters.has(button.dataset.type));
  });
}

function openShadowIntelView(focusName = '') {
  const intelView = tartRoot.querySelector('#shadowIntelView');
  if (!intelView) {
    return;
  }

  if (focusName) {
    state.query = focusName;
    state.blockFilter = null;
    state.typeFilters.clear();
    state.weakFilter = '';
    state.ailmentFilter = '';
    state.lvlMin = 0;
    state.lvlMax = 99;
    state.expandedRow = focusName;
  }

  syncIntelControlsFromState();
  renderTable();
  showTartarusView('shadowintel');
}

function syncFloorInputFromProfile() {
  const floorInput = tartRoot?.querySelector('#floorInput');
  if (!floorInput) {
    return;
  }
  const targetFloor = getCurrentProfile().currentFloor;
  const targetBlock = BLOCKS.find((block) => targetFloor >= block.fMin && targetFloor <= block.fMax);
  const floorProfileLabel = tartRoot.querySelector('#floorProfileLabel');
  if (floorProfileLabel) {
    floorProfileLabel.textContent = targetBlock ? `${targetFloor}F | ${targetBlock.name}` : `${targetFloor}F`;
  }
  if (document.activeElement === floorInput && floorInput.value && Number(floorInput.value) !== targetFloor) {
    return;
  }
  floorInput.value = targetFloor ? String(targetFloor) : '';
}

function filterShadows() {
  let list = ALL_SHADOWS;

  if (state.blockFilter) {
    list = list.filter((shadow) => shadow.block === state.blockFilter);
  }
  if (state.typeFilters.size > 0) {
    list = list.filter((shadow) => state.typeFilters.has(shadow.type));
  }
  if (state.query) {
    const query = state.query.toLowerCase();
    list = list.filter(
      (shadow) =>
        shadow.name.toLowerCase().includes(query) ||
        (shadow.skills && shadow.skills.some((skill) => skill.toLowerCase().includes(query))) ||
        (shadow.dodds &&
          Object.keys(shadow.dodds).some((drop) => drop.toLowerCase().includes(query))) ||
        (shadow.arcana && shadow.arcana.toLowerCase().includes(query))
    );
  }
  if (state.weakFilter) {
    list = list.filter((shadow) => {
      const code = shadow.resists[state.weakFilter];
      return code === 'w' || code === 'W' || code === 'v' || code === 'V' || code === 'z' || code === 'Z';
    });
  }
  if (state.ailmentFilter) {
    list = list.filter(
      (shadow) => shadow.ailments && shadow.ailments[state.ailmentFilter] === 'v'
    );
  }
  if (state.lvlMin) {
    list = list.filter((shadow) => shadow.lvl >= state.lvlMin);
  }
  if (state.lvlMax && state.lvlMax < 99) {
    list = list.filter((shadow) => shadow.lvl <= state.lvlMax);
  }

  return sortShadows(list);
}

function sortShadows(list) {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return [...list].sort((left, right) => {
    if (state.sortCol === 'name') {
      return left.name.localeCompare(right.name) * dir;
    }
    if (state.sortCol === 'lvl') {
      return (left.lvl - right.lvl) * dir;
    }
    if (state.sortCol === 'race') {
      return (left.arcana || '').localeCompare(right.arcana || '') * dir;
    }
    if (state.sortCol === 'area') {
      return (left.area || '').localeCompare(right.area || '') * dir;
    }
    if (state.sortCol === 'type') {
      return left.type.localeCompare(right.type) * dir;
    }
    if (RESIST_KEYS.includes(state.sortCol)) {
      const leftValue = RESIST_ORDER[left.resists[state.sortCol]] ?? 0;
      const rightValue = RESIST_ORDER[right.resists[state.sortCol]] ?? 0;
      return (leftValue - rightValue) * dir;
    }
    return 0;
  });
}

function affBadge(code) {
  if (!code || code === '-' || code === '_') {
    return '<span class="aff aff-n">-</span>';
  }
  const map = {
    w: 'WK',
    W: 'WK',
    v: 'WK',
    V: 'WK',
    z: 'WK!',
    Z: 'WK!',
    s: 'RS',
    S: 'RS',
    t: 'RS',
    T: 'NU',
    n: 'NU',
    r: 'RP',
    d: 'ABS',
    u: '-'
  };
  const cssClass = {
    w: 'aff-wk',
    W: 'aff-wk',
    v: 'aff-wk',
    V: 'aff-wk',
    z: 'aff-z',
    Z: 'aff-z',
    s: 'aff-rs',
    S: 'aff-rs',
    t: 'aff-rs',
    T: 'aff-nu',
    n: 'aff-nu',
    r: 'aff-rp',
    d: 'aff-dr',
    u: 'aff-n'
  };
  return `<span class="aff ${cssClass[code] || ''}">${map[code] || code}</span>`;
}

function typeBadge(type) {
  const labels = {
    regular: 'Regular',
    gatekeeper: 'Gatekeeper',
    fullmoon: 'Full Moon',
    'monad-door': 'M.Door',
    'monad-passage': 'M.Pass',
    other: 'Other'
  };
  return `<span class="type-badge type-${type}">${labels[type] || type}</span>`;
}

function renderTable() {
  const shadows = filterShadows();
  const tableBody = tartRoot.querySelector('#tableBody');
  const resultCount = tartRoot.querySelector('#resultCount');
  resultCount.textContent = `${shadows.length} shadow${shadows.length !== 1 ? 's' : ''} found`;

  let html = '';
  shadows.forEach((shadow) => {
    const rowClass = `${shadow.isBoss ? ' boss-row' : ''}${shadow.type === 'rare' ? ' rare-row' : ''}`;
    const isExpanded = state.expandedRow === shadow.name;
    html += `<tr class="shadow-row${rowClass}" data-name="${escapeHtml(shadow.name)}">`;
    html += `<td style="font-weight:600">${escapeHtml(shadow.name)}</td>`;
    html += `<td>${shadow.lvl}</td><td>${escapeHtml(shadow.arcana)}</td><td>${escapeHtml(
      shadow.area || ''
    )}</td>`;
    html += `<td>${typeBadge(shadow.type)}</td>`;
    RESIST_KEYS.slice(0, 9).forEach((key) => {
      html += `<td>${affBadge(shadow.resists[key])}</td>`;
    });
    html += '</tr>';
    if (isExpanded) {
      html += renderDetailRow(shadow);
    }
  });

  tableBody.innerHTML = html;
  tartRoot.querySelectorAll('#tableHead th').forEach((header) => {
    header.classList.remove('sorted-asc', 'sorted-desc');
    if (header.dataset.col === state.sortCol) {
      header.classList.add(`sorted-${state.sortDir}`);
    }
  });
}

function renderDetailRow(shadow) {
  let html = '<tr class="detail-row"><td colspan="14"><div class="detail-card">';
  html += `<h3>${escapeHtml(shadow.name)}</h3>`;
  if (shadow.stats) {
    html += '<div class="detail-section"><div class="stat-bar">';
    ['HP', 'SP', 'St', 'Ma', 'En', 'Ag', 'Lu'].forEach((statName, index) => {
      html += `<div class="stat-item"><div class="stat-label">${statName}</div><div class="stat-val">${shadow.stats[index]}</div></div>`;
    });
    html += '</div></div>';
  }
  if (shadow.ailments) {
    const ailmentNames = ['Burn', 'Freeze', 'Shock', 'Poison', 'Charm', 'Distress'];
    const ailmentCodes = { v: 'Vuln', n: 'Null', s: 'Resist' };
    const ailmentColors = { v: 'var(--wk)', s: 'var(--rs)', n: 'var(--nu)' };
    html += '<div class="detail-section"><span class="label">Ailments: </span>';
    for (let index = 0; index < shadow.ailments.length && index < ailmentNames.length; index += 1) {
      const code = shadow.ailments[index];
      html += `<span style="color:${ailmentColors[code] || 'var(--text-dim)'};margin-right:8px;font-size:0.85rem">${ailmentNames[index]}: ${ailmentCodes[code] || code}</span>`;
    }
    html += '</div>';
  }
  if (shadow.skills && shadow.skills.length > 0) {
    html += '<div class="detail-section"><div class="label">Skills</div><div class="value">';
    shadow.skills.forEach((skillName) => {
      const skill = SKILLS[skillName];
      const tooltip = skill
        ? ` data-tooltip="${ELEM_NAMES[skill.elem] || skill.elem} | ${skill.target}${skill.cost ? ` | Cost ${skill.cost}` : ''}${skill.power ? ` | Pow ${skill.power}` : ''}${skill.effect ? ` | ${skill.effect}` : ''}"`
        : '';
      html += `<span class="skill-tag"${tooltip}>${escapeHtml(skillName)}</span>`;
    });
    html += '</div></div>';
  }
  if (shadow.dodds && Object.keys(shadow.dodds).length > 0) {
    html += '<div class="detail-section"><div class="label">Drops</div><div class="value">';
    Object.entries(shadow.dodds).forEach(([item, chance]) => {
      html += `<span class="drop-item">${escapeHtml(item)} <span class="drop-chance">(${chance}%)</span></span>`;
    });
    html += '</div></div>';
  }

  html += `<div class="detail-section"><span class="label">EXP: </span><span class="value" style="display:inline">${shadow.exp || 0}</span></div>`;

  const strategy = BOSS_STRATS[shadow.name];
  if (strategy) {
    html += `<div class="strategy-box"><div class="strat-title">Strategy (Rec. Lv ${strategy.recLevel})</div>`;
    if (strategy.quickTip) {
      html += `<p class="strat-quick">${strategy.quickTip}</p>`;
    }
    if (strategy.party) {
      html += `<div class="strat-row"><span class="strat-label">Party:</span> ${strategy.party
        .map((member) => `<span class="strat-badge strat-party">${escapeHtml(member)}</span>`)
        .join(' ')}</div>`;
    }
    if (strategy.personas) {
      html += renderStrategyPersonaRows(strategy.personas, 'Personas');
    }
    if (strategy.items) {
      html += `<div class="strat-row"><span class="strat-label">Items:</span> ${strategy.items
        .map((item) => `<span class="strat-badge strat-item">${escapeHtml(item)}</span>`)
        .join(' ')}</div>`;
    }
    if (strategy.phases) {
      strategy.phases.forEach((phase, index) => {
        html += `<div class="strat-phase"><div class="strat-phase-name">${index + 1}. ${escapeHtml(
          phase.name
        )}</div><p>${phase.tips}</p></div>`;
      });
    }
    if (strategy.strategy) {
      html += `<p>${strategy.strategy}</p>`;
    }
    html += '</div>';
  }

  html += '</div></td></tr>';
  return html;
}

function renderLoadoutAdvice(shadows, rosterSet) {
  const floorWeaknesses = {};
  RESIST_KEYS.slice(0, 9).forEach((key) => {
    floorWeaknesses[key] = 0;
  });
  shadows.forEach((shadow) => {
    RESIST_KEYS.slice(0, 9).forEach((key) => {
      const code = shadow.resists[key];
      if (code === 'w' || code === 'W' || code === 'v' || code === 'V' || code === 'z' || code === 'Z') {
        floorWeaknesses[key] += 1;
      }
    });
  });

  const scored = [];
  rosterSet.forEach((name) => {
    const persona = PERSONAS[name];
    if (!persona) {
      return;
    }

    let score = 0;
    const hits = [];
    const resists = [];
    const coveredElements = new Set();

    Object.keys(persona.skills).forEach((skillName) => {
      const skill = SKILLS[skillName];
      if (!skill || !skill.elem) {
        return;
      }
      if (floorWeaknesses[skill.elem] && floorWeaknesses[skill.elem] > 0 && !coveredElements.has(skill.elem)) {
        coveredElements.add(skill.elem);
        score += floorWeaknesses[skill.elem] * 2;
        hits.push(`${RESIST_LABELS[RESIST_KEYS.indexOf(skill.elem)]} (${floorWeaknesses[skill.elem]})`);
      }
    });

    const enemySkillElements = {};
    shadows.forEach((shadow) => {
      if (!shadow.skills) {
        return;
      }
      shadow.skills.forEach((skillName) => {
        const skill = SKILLS[skillName];
        if (skill && skill.elem && RESIST_KEYS.includes(skill.elem)) {
          enemySkillElements[skill.elem] = (enemySkillElements[skill.elem] || 0) + 1;
        }
      });
    });

    RESIST_KEYS.slice(0, 9).forEach((key, index) => {
      const code = persona.resists[index] || '-';
      if ('snrd'.includes(code) && enemySkillElements[key]) {
        score += 1;
        resists.push(RESIST_LABELS[RESIST_KEYS.indexOf(key)]);
      }
      if (code === 'w' && enemySkillElements[key]) {
        score -= 2;
      }
    });

    if (score > 0) {
      scored.push({
        name,
        lvl: persona.lvl,
        race: persona.race,
        score,
        hits,
        resists
      });
    }
  });

  if (scored.length === 0) {
    return '';
  }

  scored.sort((left, right) => right.score - left.score || right.lvl - left.lvl);
  const top = scored.slice(0, 4);
  let html = '<div class="loadout-section"><div class="loadout-title">Recommended Loadout</div>';
  top.forEach((persona) => {
    const reasons = [];
    if (persona.hits.length) {
      reasons.push(`Hits: ${persona.hits.join(', ')}`);
    }
    if (persona.resists.length) {
      reasons.push(`Resists: ${persona.resists.join(', ')}`);
    }
    html += `<div class="loadout-persona"><div class="loadout-name">${escapeHtml(
      persona.name
    )} <span class="loadout-lvl">Lv${persona.lvl}</span> <span class="loadout-arcana">${escapeHtml(
      persona.race
    )}</span></div>`;
    if (reasons.length) {
      html += `<div class="loadout-reason">${reasons.join(' · ')}</div>`;
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function getFloorLootEntries(shadows) {
  const lootMap = {};
  shadows.forEach((shadow) => {
    if (!shadow.dodds) {
      return;
    }
    Object.entries(shadow.dodds).forEach(([item, chance]) => {
      if (!lootMap[item]) {
        lootMap[item] = [];
      }
      lootMap[item].push({
        enemy: shadow.name,
        lvl: shadow.lvl,
        chance
      });
    });
  });

  return Object.entries(lootMap)
    .map(([item, sources]) => ({
      item,
      sources: sources.sort((left, right) => right.chance - left.chance || left.enemy.localeCompare(right.enemy))
    }))
    .sort((left, right) => left.item.localeCompare(right.item));
}

function getFloorChestLootEntries(floor) {
  if (typeof TARTARUS_CHEST_LOOT === 'undefined' || !Array.isArray(TARTARUS_CHEST_LOOT)) {
    return [];
  }
  const importanceRank = { key: 0, unique: 1, rare: 2, valuable: 3 };
  return TARTARUS_CHEST_LOOT.filter((entry) => entry.floor === floor).sort(
    (left, right) =>
      (importanceRank[left.importance] ?? 9) - (importanceRank[right.importance] ?? 9) ||
      left.item.localeCompare(right.item)
  );
}

function renderFloorTreasureAlert(floor) {
  const chestEntries = getFloorChestLootEntries(floor);
  if (chestEntries.length === 0) {
    return '';
  }

  const hasKeyReward = chestEntries.some((entry) => entry.importance === 'key' || entry.importance === 'unique');
  const title = hasKeyReward ? 'Important treasure on this floor' : 'Rare treasure on this floor';
  const summary = chestEntries
    .slice(0, 3)
    .map((entry) => entry.item)
    .join(', ');
  let html = `<section class="treasure-alert treasure-alert-${hasKeyReward ? 'key' : 'rare'}" aria-label="${escapeHtml(
    title
  )}">`;
  html += '<div class="treasure-alert-heading">';
  html += `<div><div class="treasure-alert-kicker">Treasure alert</div><div class="treasure-alert-title">${escapeHtml(
    title
  )}</div></div>`;
  html += `<div class="treasure-alert-count">${chestEntries.length} fixed reward${chestEntries.length === 1 ? '' : 's'}</div>`;
  html += '</div>';
  html += `<div class="treasure-alert-summary">${escapeHtml(summary)}${chestEntries.length > 3 ? '...' : ''}</div>`;
  html += '<div class="treasure-alert-grid">';
  chestEntries.forEach((entry) => {
    const importanceLabel = CHEST_IMPORTANCE_LABELS[entry.importance] || entry.importance;
    const typeLabel = CHEST_TYPE_LABELS[entry.chestType] || entry.chestType;
    const fragmentLabel = Number.isInteger(entry.fragmentCost) ? `${entry.fragmentCost} Twilight Fragment` : null;
    html += `<div class="treasure-alert-item treasure-alert-item-${escapeHtml(entry.importance)}">`;
    html += '<div class="treasure-alert-item-main">';
    html += `<div class="treasure-alert-item-name">${escapeHtml(entry.item)}</div>`;
    html += `<div class="treasure-alert-item-meta">${escapeHtml(entry.category)} | ${escapeHtml(typeLabel)}${
      fragmentLabel ? ` | ${escapeHtml(fragmentLabel)}` : ''
    }</div>`;
    html += '</div>';
    html += `<span class="treasure-badge treasure-badge-${escapeHtml(entry.importance)}">${escapeHtml(
      importanceLabel
    )}</span>`;
    if (entry.sourceNote) {
      html += `<div class="treasure-alert-note">${escapeHtml(entry.sourceNote)}</div>`;
    }
    html += '</div>';
  });
  html += '</div>';
  html += '<div class="treasure-alert-footnote">Fixed and verified chest rewards only. Random chest pools are not listed as guaranteed floor loot.</div>';
  html += '</section>';
  return html;
}

function getNearbyGrindSpots(floor, blockId) {
  const spots = {};
  ALL_SHADOWS.forEach((shadow) => {
    if (shadow.type !== 'regular' || !shadow.floorMin || !shadow.floorMax || !shadow.exp) {
      return;
    }
    const key = `${shadow.block}:${shadow.floorMin}-${shadow.floorMax}`;
    if (!spots[key]) {
      spots[key] = {
        block: shadow.block,
        fMin: shadow.floorMin,
        fMax: shadow.floorMax,
        totalExp: 0,
        count: 0,
        avgLvl: 0
      };
    }
    spots[key].totalExp += shadow.exp;
    spots[key].count += 1;
    spots[key].avgLvl += shadow.lvl;
  });

  return Object.values(spots)
    .map((spot) => {
      const block = BLOCKS.find((entry) => entry.id === spot.block);
      const distance = floor < spot.fMin ? spot.fMin - floor : floor > spot.fMax ? floor - spot.fMax : 0;
      return {
        ...spot,
        avgLvl: Math.round(spot.avgLvl / spot.count),
        distance,
        blockName: block ? block.name : spot.block,
        blockColor: block ? block.color : '#fff',
        sameBlock: spot.block === blockId
      };
    })
    .sort(
      (left, right) =>
        Number(right.sameBlock) - Number(left.sameBlock) ||
        left.distance - right.distance ||
        right.totalExp - left.totalExp
    )
    .slice(0, 3);
}

function renderMajorCheckCard(title, tone, bodyHtml) {
  return `<section class="major-check major-check-${escapeHtml(tone)}"><div class="major-check-title">${escapeHtml(
    title
  )}</div>${bodyHtml}</section>`;
}

function renderMajorChecks(floor, block, upcomingGatekeeper) {
  const container = tartRoot.querySelector('#tartarus-major-check');
  if (!container) {
    return;
  }

  if (!floor || !block) {
    container.innerHTML =
      '<h3>Upcoming Major Checks</h3><div class="floor-ops-empty">Enter a floor to compare your next gatekeeper and next full-moon check.</div>';
    return;
  }

  const nextFullMoon = getNextFullMoon();
  const currentLevel = getCurrentPlayerLevel();
  let html = '<h3>Upcoming Major Checks</h3>';

  if (upcomingGatekeeper) {
    const distance = upcomingGatekeeper.floorMin - floor;
    const gatekeeperReadiness = getLevelReadiness(currentLevel, upcomingGatekeeper.lvl);
    html += renderMajorCheckCard(
      'Next Gatekeeper',
      'gatekeeper',
      `<div class="major-check-head"><span class="major-check-name">${escapeHtml(
        upcomingGatekeeper.name
      )}</span><span class="major-check-meta">${upcomingGatekeeper.floorMin}F • Lv ${upcomingGatekeeper.lvl}</span></div><div class="major-check-copy">${distance === 0 ? 'You are on the checkpoint floor now.' : `${distance} floor${distance === 1 ? '' : 's'} away in ${escapeHtml(
        block.name
      )}.`}</div>${gatekeeperReadiness ? `<div class="major-check-copy"><strong>Readiness:</strong> ${escapeHtml(
        gatekeeperReadiness
      )}</div>` : ''}<div class="major-check-list">${buildGatekeeperPrep(upcomingGatekeeper)
        .map((entry) => `<div class="major-check-line">${escapeHtml(entry)}</div>`)
        .join('')}</div>`
    );
  } else {
    html += renderMajorCheckCard(
      'Next Gatekeeper',
      'support',
      '<div class="major-check-copy">No further gatekeeper remains in this Tartarus block.</div>'
    );
  }

  if (nextFullMoon && nextFullMoon.parsedDate) {
    const daysLeft = daysBetweenDates(getCurrentGameDate(), nextFullMoon.parsedDate);
    const strategy = nextFullMoon.primaryStrategy;
    const fullMoonReadiness = getLevelReadiness(currentLevel, strategy?.recLevel || 0);
    const recommendedParty = strategy?.party
      ? `<div class="major-check-tags">${strategy.party
          .slice(0, 3)
          .map((entry) => `<span class="major-check-tag">${escapeHtml(entry)}</span>`)
          .join('')}</div>`
      : '';
    const itemPrompt = strategy?.items?.length
      ? `<div class="major-check-copy"><strong>Stock:</strong> ${escapeHtml(strategy.items.slice(0, 3).join(', '))}</div>`
      : '';
    html += renderMajorCheckCard(
      'Next Full Moon',
      'fullmoon',
      `<div class="major-check-head"><span class="major-check-name">${escapeHtml(
        nextFullMoon.boss
      )}</span><span class="major-check-meta">${escapeHtml(nextFullMoon.date)} • ${daysLeft} day${
        daysLeft === 1 ? '' : 's'
      }</span></div>${strategy?.quickTip ? `<div class="major-check-copy">${escapeHtml(strategy.quickTip)}</div>` : ''}${
        strategy?.recLevel ? `<div class="major-check-copy"><strong>Comfort level:</strong> around Lv ${strategy.recLevel}.</div>` : ''
      }${fullMoonReadiness ? `<div class="major-check-copy"><strong>Readiness:</strong> ${escapeHtml(
        fullMoonReadiness
      )}</div>` : ''}${recommendedParty}${itemPrompt}`
    );
  }

  container.innerHTML = html;
}

function renderObjectiveItem(objective, { floor, exactMatch = false } = {}) {
  const status = getObjectiveState(objective);
  const tone = getObjectiveTone(status);
  const complete = status.state === 'complete';
  const floorDelta = objective.floor - floor;
  let floorLine = `${objective.floor}F`;
  if (!exactMatch && Number.isFinite(floorDelta)) {
    floorLine += floorDelta > 0 ? ` • +${floorDelta}F` : floorDelta < 0 ? ` • ${floorDelta}F` : '';
  }
  return `<label class="objective-item objective-${tone}${complete ? ' complete' : ''}">
    <input type="checkbox" class="objective-toggle" data-objective-id="${escapeHtml(objective.id)}"${complete ? ' checked' : ''}>
    <span class="objective-main">
      <span class="objective-top">
        <span class="objective-type">${escapeHtml(OBJECTIVE_TYPE_LABELS[objective.type] || objective.type)}</span>
        <span class="objective-status status-${tone}">${escapeHtml(status.label)}</span>
      </span>
      <span class="objective-title">${escapeHtml(objective.title)}</span>
      <span class="objective-meta">${escapeHtml(floorLine)} • ${escapeHtml(objective.reward)}${
        objective.socialLink ? ` • protects ${escapeHtml(objective.socialLink)}` : ''
      }</span>
      ${objective.note ? `<span class="objective-note">${escapeHtml(objective.note)}</span>` : ''}
    </span>
  </label>`;
}

function renderObjectives(floor, block) {
  const container = tartRoot.querySelector('#tartarus-objectives');
  if (!container) {
    return;
  }

  if (!floor || !block) {
    container.innerHTML =
      '<h3>Priority Objectives</h3><div class="floor-ops-empty">Enter a floor to surface old documents, missing persons, and other Tartarus objectives.</div>';
    return;
  }

  const currentDate = getCurrentGameDate();
  const objectives = getObjectiveList();
  const floorObjectives = objectives
    .filter((objective) => objective.floor === floor && !isObjectiveStale(objective))
    .sort((left, right) => left.title.localeCompare(right.title));
  const blockObjectives = objectives
    .filter(
      (objective) =>
        objective.block === block.id &&
        objective.floor >= floor &&
        objective.floor !== floor &&
        !isObjectiveStale(objective) &&
        getObjectiveState(objective).state !== 'complete'
    )
    .sort((left, right) => left.floor - right.floor || left.title.localeCompare(right.title))
    .slice(0, 4);
  const urgentObjectives = objectives
    .filter((objective) => {
      const status = getObjectiveState(objective);
      return (
        status.state !== 'complete' &&
        status.state !== 'upcoming' &&
        !isObjectiveStale(objective) &&
        objective.deadline &&
        (status.state === 'urgent' || status.state === 'soon')
      );
    })
    .sort((left, right) => {
      const leftDate = parseObjectiveDate(left.deadline) || currentDate;
      const rightDate = parseObjectiveDate(right.deadline) || currentDate;
      return compareDates(leftDate, rightDate);
    })
    .slice(0, 4);

  let html = '<h3>Priority Objectives</h3>';
  const summaryBits = [];
  if (floorObjectives.length > 0) {
    summaryBits.push(`${floorObjectives.length} on this floor`);
  }
  if (urgentObjectives.length > 0) {
    summaryBits.push(`${urgentObjectives.length} urgent`);
  }
  if (summaryBits.length > 0) {
    html += `<div class="floor-ops-subtitle">${escapeHtml(summaryBits.join(' • '))}</div>`;
  }

  if (floorObjectives.length > 0) {
    html += '<div class="objective-group"><div class="objective-group-title">On this floor</div>';
    html += floorObjectives.map((objective) => renderObjectiveItem(objective, { floor, exactMatch: true })).join('');
    html += '</div>';
  }

  if (blockObjectives.length > 0) {
    html += '<div class="objective-group"><div class="objective-group-title">Coming up in this block</div>';
    html += blockObjectives.map((objective) => renderObjectiveItem(objective, { floor })).join('');
    html += '</div>';
  }

  if (urgentObjectives.length > 0) {
    html += '<div class="objective-group"><div class="objective-group-title">Deadline pressure</div>';
    html += urgentObjectives.map((objective) => renderObjectiveItem(objective, { floor })).join('');
    html += '</div>';
  }

  if (!floorObjectives.length && !blockObjectives.length && !urgentObjectives.length) {
    html += '<div class="floor-ops-empty">No high-priority Tartarus objective is tied to this floor or your current deadline window.</div>';
  }

  container.innerHTML = html;
}

function renderFloorScout(floor) {
  const info = tartRoot.querySelector('#floorInfo');
  if (!floor || floor < 2 || floor > 264) {
    info.innerHTML =
      '<div style="color:var(--text-dim);font-size:0.85rem;margin-top:0.5rem">Enter a floor (2-264)</div>';
    renderMajorChecks(null, null, null);
    renderObjectives(null, null);
    return;
  }

  const block = BLOCKS.find((entry) => floor >= entry.fMin && floor <= entry.fMax);
  if (!block) {
    info.innerHTML = '<div style="color:var(--text-dim)">No block for this floor.</div>';
    renderMajorChecks(null, null, null);
    renderObjectives(null, null);
    return;
  }

  let html = `<div class="floor-block-name" style="color:${block.color}">${block.name} - ${block.floors}</div>`;
  html += `<div style="font-size:0.8rem;color:var(--text-dim)">Rec. Level: ${block.recLvl} | Unlocked: ${block.unlock}</div>`;
  const blockExtra = getBlockExtra(block.id);
  if (blockExtra) {
    html += `<div class="floor-block-focus"><strong>Section focus:</strong> ${escapeHtml(blockExtra.focus)}${blockExtra.prep ? ` <span>${escapeHtml(blockExtra.prep)}</span>` : ''}</div>`;
  }
  html += renderFloorTreasureAlert(floor);
  const shadows = ALL_SHADOWS.filter(
    (shadow) =>
      shadow.block === block.id &&
      shadow.type === 'regular' &&
      shadow.floorMin &&
      shadow.floorMax &&
      floor >= shadow.floorMin &&
      floor <= shadow.floorMax
  );
  let regularBody = '';

  if (shadows.length > 0) {
    shadows.sort((left, right) => left.name.localeCompare(right.name));
    regularBody += '<div class="floor-enemies">';
    shadows.forEach((shadow) => {
      regularBody += `<div class="floor-enemy"><div class="floor-enemy-name">${renderFloorEnemyName(
        shadow
      )}</div>${renderFloorAffinities(shadow)}</div>`;
    });
    regularBody += '</div>';

    const weaknessCounts = {};
    shadows.forEach((shadow) => {
      RESIST_KEYS.slice(0, 9).forEach((key) => {
        const code = shadow.resists[key];
        if (code === 'w' || code === 'W' || code === 'v' || code === 'V' || code === 'z' || code === 'Z') {
          weaknessCounts[key] = (weaknessCounts[key] || 0) + 1;
        }
      });
    });
    const sortedWeaknesses = Object.entries(weaknessCounts).sort((left, right) => right[1] - left[1]);
    if (sortedWeaknesses.length > 0) {
      regularBody += `<div class="floor-tip"><strong>Tip:</strong> Most effective elements: ${sortedWeaknesses
        .slice(0, 3)
        .map(([key, count]) => `${RESIST_LABELS[RESIST_KEYS.indexOf(key)]} (${count})`)
        .join(', ')}</div>`;
    }
  }

  if (shadows.length > 0) {
    const totalExp = shadows.reduce((sum, shadow) => sum + (shadow.exp || 0), 0);
    const blockShadows = ALL_SHADOWS.filter(
      (shadow) => shadow.block === block.id && shadow.type === 'regular' && shadow.exp
    );
    const avgBlockExp =
      blockShadows.length > 0
        ? Math.round(blockShadows.reduce((sum, shadow) => sum + shadow.exp, 0) / blockShadows.length)
        : 0;
    const avgFloorExp = Math.round(totalExp / shadows.length);
    const indicator =
      avgFloorExp > avgBlockExp * 1.15 ? '↑ Above avg' : avgFloorExp < avgBlockExp * 0.85 ? '↓ Below avg' : '≈ Average';
    regularBody += `<div class="floor-exp-summary"><span class="label">Floor EXP: </span><strong>${totalExp}</strong> total (${avgFloorExp}/shadow) <span class="floor-exp-ind">${indicator}</span></div>`;
    html += renderFloorScoutSection({
      key: 'regular',
      title: 'Shadows on this floor',
      summary: `${shadows.length} encounter${shadows.length === 1 ? '' : 's'}`,
      tone: 'regular',
      bodyHtml: regularBody
    });
  }

  const monadDoorData = getMonadEnemiesForFloor(floor, 'monad-door');
  const monadPassageData = getMonadEnemiesForFloor(floor, 'monad-passage');
  if (
    (monadDoorData.band && monadDoorData.enemies.length > 0) ||
    (monadPassageData.band && monadPassageData.enemies.length > 0)
  ) {
    let monadBody = '';
    const monadSummary = [];
    if (monadDoorData.enemies.length > 0) {
      monadSummary.push('Door');
      monadBody += renderMonadEncounterGroup('monad-door', monadDoorData);
    }
    if (monadPassageData.enemies.length > 0) {
      monadSummary.push('Passage');
      monadBody += renderMonadEncounterGroup('monad-passage', monadPassageData);
    }
    const bandLabel = (monadDoorData.band || monadPassageData.band || {}).label || '';
    html += renderFloorScoutSection({
      key: 'monad',
      title: 'Possible Monad encounters',
      summary: `${monadSummary.join(' + ')}${bandLabel ? ` · ${bandLabel}` : ''}`,
      tone: 'monad',
      bodyHtml: monadBody
    });
  }

  const gatekeepers = ALL_SHADOWS.filter(
    (shadow) => shadow.block === block.id && shadow.type === 'gatekeeper' && shadow.floorMin
  ).sort((left, right) => left.floorMin - right.floorMin || left.name.localeCompare(right.name));
  const currentGatekeepers = gatekeepers
    .filter((shadow) => shadow.floorMin === floor)
    .sort((left, right) => left.name.localeCompare(right.name));
  const upcomingGatekeeper = gatekeepers.find((shadow) => shadow.floorMin > floor) || null;

  let gatekeeperBody = '';
  if (currentGatekeepers.length > 0) {
    currentGatekeepers.forEach((shadow) => {
      gatekeeperBody += renderGatekeeperPanel(`Gatekeeper on this floor: Floor ${shadow.floorMin}`, shadow, {
        accentStyle: 'background:rgba(255,23,68,0.12);border:1px solid rgba(255,23,68,0.32)',
        titleColor: 'var(--wk)'
      });
    });
  }

  if (upcomingGatekeeper) {
    gatekeeperBody += renderGatekeeperPanel(`Next Gatekeeper: Floor ${upcomingGatekeeper.floorMin}`, upcomingGatekeeper, {
      accentStyle: 'background:rgba(255,23,68,0.08);border:1px solid rgba(255,23,68,0.2)',
      titleColor: 'var(--wk)'
    });
  }

  if (gatekeeperBody) {
    const gatekeeperSummaryParts = [];
    if (currentGatekeepers.length > 0) {
      gatekeeperSummaryParts.push(`${currentGatekeepers.length} on this floor`);
    }
    if (upcomingGatekeeper) {
      gatekeeperSummaryParts.push(`next ${upcomingGatekeeper.floorMin}F`);
    }
    html += renderFloorScoutSection({
      key: 'gatekeepers',
      title: 'Gatekeeper / minibosses',
      summary: gatekeeperSummaryParts.join(' · '),
      tone: 'gatekeeper',
      bodyHtml: gatekeeperBody
    });
  }

  const lootEntries = getFloorLootEntries(shadows);
  if (lootEntries.length > 0) {
    let lootBody = '<div class="floor-support-note">Tracked enemy drops from enemies on this floor. Fixed chest rewards appear in the Treasure Alert above.</div>';
    lootEntries.slice(0, 8).forEach((entry) => {
      lootBody += `<div class="loot-item-group"><div class="loot-item-name">${escapeHtml(entry.item)}</div>`;
      entry.sources.slice(0, 3).forEach((source) => {
        lootBody += `<div class="loot-source"><span class="loot-chance">${source.chance}%</span> <span class="loot-enemy">${escapeHtml(
          source.enemy
        )}</span> <span class="loot-area">Lv${source.lvl}</span></div>`;
      });
      lootBody += '</div>';
    });
    html += renderFloorScoutSection({
      key: 'loot',
      title: 'Enemy drops on this floor',
      summary: `${lootEntries.length} tracked item${lootEntries.length === 1 ? '' : 's'}`,
      tone: 'loot',
      bodyHtml: lootBody
    });
  }

  const nearbyGrindSpots = getNearbyGrindSpots(floor, block.id);
  if (nearbyGrindSpots.length > 0) {
    let grindBody = '<div class="floor-support-note">Nearby ranges with strong EXP value from your current position.</div>';
    nearbyGrindSpots.forEach((spot, index) => {
      const distanceLabel = spot.distance === 0 ? 'Current range' : `${spot.distance} floor${spot.distance === 1 ? '' : 's'} away`;
      grindBody += `<div class="grind-spot"><div class="grind-rank">#${index + 1}</div><div class="grind-info"><div class="grind-block" style="color:${spot.blockColor}">${spot.blockName} F${spot.fMin}-${spot.fMax}</div><div class="grind-meta">${spot.totalExp} EXP · Avg Lv${spot.avgLvl} · ${spot.count} shadows · ${distanceLabel}</div></div></div>`;
    });
    html += renderFloorScoutSection({
      key: 'grind',
      title: 'Nearby grind spots',
      summary: nearbyGrindSpots[0].distance === 0 ? 'current range included' : 'nearest ranges',
      tone: 'grind',
      bodyHtml: grindBody
    });
  }

  const rosterSet = getRosterSet();
  if (rosterSet.size > 0 && shadows.length > 0) {
    html += renderFloorScoutSection({
      key: 'loadout',
      title: 'Recommended loadout',
      summary: 'roster-aware picks',
      tone: 'support',
      bodyHtml: renderLoadoutAdvice(shadows, rosterSet)
    });
  }

  info.innerHTML = html;
  renderMajorChecks(floor, block, upcomingGatekeeper);
  renderObjectives(floor, block);
}

function renderFullMoon() {
  const container = tartRoot.querySelector('#timeline');
  let html = '';
  FULL_MOON_DATES.forEach((fullMoon, index) => {
    const primaryStrategy = fullMoon.names.length > 0 ? BOSS_STRATS[fullMoon.names[0]] : null;
    const extra = getFullMoonExtra(fullMoon.date);
    html += `<div class="moon-card" data-idx="${index}"><div class="moon-header"><div class="moon-icon"></div><div><div class="moon-date">${fullMoon.date}</div><div class="moon-boss">${escapeHtml(fullMoon.boss)}</div>`;
    if (primaryStrategy && primaryStrategy.quickTip) {
      html += `<div class="moon-quick-tip">${primaryStrategy.quickTip}</div>`;
    }
    html += '</div></div><div class="moon-details">';
    if (extra) {
      html += `<div class="moon-outcome-grid"><div class="moon-outcome-card"><span class="moon-outcome-label">Reward / Impact</span><span class="moon-outcome-text">${escapeHtml(
        extra.reward
      )}</span></div><div class="moon-outcome-card"><span class="moon-outcome-label">Follow-up</span><span class="moon-outcome-text">${escapeHtml(
        extra.followUp
      )}</span></div></div>`;
    }
    if (primaryStrategy) {
      if (primaryStrategy.party) {
        html += `<div class="strat-row"><span class="strat-label">Ideal Party:</span> ${primaryStrategy.party
          .map((member) => `<span class="strat-badge strat-party">${escapeHtml(member)}</span>`)
          .join(' ')}</div>`;
      }
      if (primaryStrategy.personas) {
        html += renderStrategyPersonaRows(primaryStrategy.personas, 'Bring Personas');
      }
      if (primaryStrategy.items) {
        html += `<div class="strat-row"><span class="strat-label">Stock Items:</span> ${primaryStrategy.items
          .map((item) => `<span class="strat-badge strat-item">${escapeHtml(item)}</span>`)
          .join(' ')}</div>`;
      }
      if (primaryStrategy.recLevel) {
        html += `<div class="strat-row"><span class="strat-label">Rec. Level:</span> <span class="strat-badge strat-lvl">Lv ${primaryStrategy.recLevel}</span></div>`;
      }
      if (primaryStrategy.phases) {
        html += '<div class="moon-phases">';
        primaryStrategy.phases.forEach((phase, phaseIndex) => {
          html += `<div class="strat-phase"><div class="strat-phase-name">${phaseIndex + 1}. ${escapeHtml(
            phase.name
          )}</div><p>${phase.tips}</p></div>`;
        });
        html += '</div>';
      }
    } else {
      html += '<div style="color:var(--text-dim);font-size:0.85rem;margin-top:0.5rem">No detailed data available for this encounter.</div>';
    }

    const moonShadows = ALL_SHADOWS.filter((shadow) => fullMoon.names.includes(shadow.name));
    if (moonShadows.length > 0) {
      html += '<div class="moon-shadows-label">Enemy Data</div>';
      moonShadows.forEach((shadow) => {
        html +=
          '<div style="margin-top:0.5rem;padding:0.5rem;background:rgba(0,0,0,0.2);border-radius:4px">';
        html += `<div style="font-weight:600;color:var(--text-bright)">${escapeHtml(
          shadow.name
        )} <span style="color:var(--text-dim);font-size:0.85rem">Lv ${shadow.lvl}</span></div>`;
        html += '<div class="moon-aff-row">';
        RESIST_KEYS.slice(0, 9).forEach((key, resistIndex) => {
          html += `<div style="text-align:center;min-width:32px"><div style="font-size:0.65rem;color:var(--text-dim)">${RESIST_LABELS[
            resistIndex
          ].slice(0, 3)}</div>${affBadge(shadow.resists[key])}</div>`;
        });
        html += '</div>';
        if (shadow.skills && shadow.skills.length > 0) {
          html += '<div style="margin-top:0.5rem"><span class="label">Skills: </span>';
          shadow.skills.forEach((skillName) => {
            const skill = SKILLS[skillName];
            const tooltip = skill
              ? ` data-tooltip="${ELEM_NAMES[skill.elem] || skill.elem} | ${skill.target}${skill.cost ? ` | Cost ${skill.cost}` : ''}${skill.power ? ` | Pow ${skill.power}` : ''}${skill.effect ? ` | ${skill.effect}` : ''}"`
              : '';
            html += `<span class="skill-tag"${tooltip}>${escapeHtml(skillName)}</span>`;
          });
          html += '</div>';
        }
        html += '</div>';
      });
    }
    html += '</div></div>';
  });
  container.innerHTML = html;
  container.querySelectorAll('.moon-card').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');
    });
  });
}

function renderGrindingGuide(playerLevel) {
  const info = tartRoot.querySelector('#grindInfo');
  if (!playerLevel || playerLevel < 1) {
    info.innerHTML =
      '<div style="color:var(--text-dim);font-size:0.85rem">Enter your level to see best grinding spots.</div>';
    return;
  }

  const spots = {};
  ALL_SHADOWS.forEach((shadow) => {
    if (!shadow.block || !shadow.floorMin || !shadow.floorMax || !shadow.exp || shadow.type === 'fullmoon') {
      return;
    }
    const key = `${shadow.block}:${shadow.floorMin}-${shadow.floorMax}`;
    if (!spots[key]) {
      spots[key] = {
        block: shadow.block,
        fMin: shadow.floorMin,
        fMax: shadow.floorMax,
        totalExp: 0,
        count: 0,
        avgLvl: 0
      };
    }
    spots[key].totalExp += shadow.exp;
    spots[key].count += 1;
    spots[key].avgLvl += shadow.lvl;
  });

  const top = Object.values(spots)
    .map((spot) => {
      const block = BLOCKS.find((entry) => entry.id === spot.block);
      spot.avgLvl = Math.round(spot.avgLvl / spot.count);
      const levelDiff = Math.abs(spot.avgLvl - playerLevel);
      spot.efficiency = Math.round(spot.totalExp / (1 + levelDiff * 0.15));
      spot.blockName = block ? block.name : spot.block;
      spot.blockColor = block ? block.color : '#fff';
      return spot;
    })
    .sort((left, right) => right.efficiency - left.efficiency)
    .slice(0, 5);

  info.innerHTML =
    top
      .map(
        (spot, index) =>
          `<div class="grind-spot"><div class="grind-rank">#${index + 1}</div><div class="grind-info"><div class="grind-block" style="color:${spot.blockColor}">${spot.blockName} F${spot.fMin}-${spot.fMax}</div><div class="grind-meta">${spot.totalExp} EXP · Avg Lv${spot.avgLvl} · ${spot.count} shadows</div></div></div>`
      )
      .join('') ||
    '<div style="color:var(--text-dim);font-size:0.85rem">No grinding data available.</div>';
}

let lootIndex = null;

function buildLootIndex() {
  if (lootIndex) {
    return;
  }
  lootIndex = {};
  ALL_SHADOWS.forEach((shadow) => {
    if (!shadow.dodds) {
      return;
    }
    Object.entries(shadow.dodds).forEach(([item, chance]) => {
      if (!lootIndex[item]) {
        lootIndex[item] = [];
      }
      lootIndex[item].push({
        enemy: shadow.name,
        chance,
        area: shadow.area || '',
        lvl: shadow.lvl
      });
    });
  });
  Object.values(lootIndex).forEach((sources) => {
    sources.sort((left, right) => right.chance - left.chance);
  });
}

function renderLootGuide(query) {
  const info = tartRoot.querySelector('#lootInfo');
  buildLootIndex();
  if (!query) {
    info.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem">${Object.keys(lootIndex).length} unique items. Type to search.</div>`;
    return;
  }

  const matches = Object.entries(lootIndex).filter(([item]) => item.toLowerCase().includes(query.toLowerCase()));
  if (matches.length === 0) {
    info.innerHTML = `<div style="color:var(--text-dim);font-size:0.85rem">No items match "${escapeHtml(
      query
    )}".</div>`;
    return;
  }

  let html = '';
  matches.slice(0, 10).forEach(([item, sources]) => {
    html += `<div class="loot-item-group"><div class="loot-item-name">${escapeHtml(item)}</div>`;
    sources.slice(0, 5).forEach((source) => {
      html += `<div class="loot-source"><span class="loot-chance">${source.chance}%</span> <span class="loot-enemy">${escapeHtml(
        source.enemy
      )}</span> <span class="loot-area">Lv${source.lvl} · ${escapeHtml(source.area)}</span></div>`;
    });
    if (sources.length > 5) {
      html += `<div class="loot-source" style="color:var(--text-dim)">...+${sources.length - 5} more</div>`;
    }
    html += '</div>';
  });
  if (matches.length > 10) {
    html += `<div style="color:var(--text-dim);font-size:0.85rem;margin-top:0.3rem">Showing 10 of ${matches.length} matches.</div>`;
  }
  info.innerHTML = html;
}

function renderStoreBackedTartarusViews() {
  syncFloorInputFromProfile();
  const floorInput = tartRoot.querySelector('#floorInput');
  renderFloorScout(Number(floorInput.value));
}

function scheduleStoreBackedTartarusViews() {
  if (storeRenderQueued) {
    return;
  }
  storeRenderQueued = true;
  const run = () => {
    storeRenderQueued = false;
    renderStoreBackedTartarusViews();
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

function initTartarus({ root, store }) {
  if (initialized) {
    return;
  }

  tartRoot = root;
  tartStore = store;
  initialized = true;

  renderTable();
  renderFullMoon();
  syncFloorInputFromProfile();
  renderFloorScout(getCurrentProfile().currentFloor);
  showTartarusView('database');

  tartRoot.querySelector('#tableBody').addEventListener('click', (event) => {
    const row = event.target.closest('.shadow-row');
    if (!row) {
      return;
    }
    const { name } = row.dataset;
    state.expandedRow = state.expandedRow === name ? null : name;
    renderTable();
  });

  tartRoot.querySelector('#searchBox').addEventListener('input', (event) => {
    state.query = event.target.value;
    state.expandedRow = null;
    renderTable();
  });

  tartRoot.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const { view } = tab.dataset;
      if (view === 'fullmoon') {
        showTartarusView('fullmoon');
      } else if (view === 'shadowintel') {
        openShadowIntelView();
      } else {
        showTartarusView('database');
      }
    });
  });

  tartRoot.querySelectorAll('.filter-btn[data-type]').forEach((button) => {
    button.addEventListener('click', () => {
      const { type } = button.dataset;
      if (state.typeFilters.has(type)) {
        state.typeFilters.delete(type);
        button.classList.remove('active');
      } else {
        state.typeFilters.add(type);
        button.classList.add('active');
      }
      state.expandedRow = null;
      renderTable();
    });
  });

  tartRoot.querySelector('#weakFilter').addEventListener('change', (event) => {
    state.weakFilter = event.target.value;
    state.expandedRow = null;
    renderTable();
  });

  tartRoot.querySelector('#blockFilter').addEventListener('change', (event) => {
    state.blockFilter = event.target.value || null;
    state.expandedRow = null;
    renderTable();
  });

  tartRoot.querySelector('#lvlMin').addEventListener('input', (event) => {
    state.lvlMin = Number(event.target.value) || 0;
    state.expandedRow = null;
    renderTable();
  });

  tartRoot.querySelector('#lvlMax').addEventListener('input', (event) => {
    state.lvlMax = Number(event.target.value) || 99;
    state.expandedRow = null;
    renderTable();
  });

  tartRoot.querySelector('#ailmentFilter').addEventListener('change', (event) => {
    state.ailmentFilter = event.target.value;
    state.expandedRow = null;
    renderTable();
  });

  tartRoot.querySelectorAll('#tableHead th').forEach((header) => {
    header.addEventListener('click', () => {
      const { col } = header.dataset;
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = 'asc';
      }
      renderTable();
    });
  });

  tartRoot.querySelector('#floorInput').addEventListener('input', (event) => {
    const nextFloor = Number(event.target.value);
    if (Number.isFinite(nextFloor) && nextFloor >= 2 && nextFloor <= 264) {
      tartStore.dispatch({
        type: 'PROFILE_SET_FLOOR',
        payload: nextFloor
      });
      return;
    }
    renderFloorScout(Number(event.target.value));
  });

  tartRoot.querySelector('#floorInfo').addEventListener('click', (event) => {
    const shadowLink = event.target.closest('.floor-shadow-link');
    if (shadowLink) {
      openShadowIntelView(shadowLink.dataset.shadowName || '');
      return;
    }
    const toggle = event.target.closest('.floor-scout-toggle');
    if (!toggle) {
      return;
    }
    const { section } = toggle.dataset;
    if (!section || !(section in floorScoutSections)) {
      return;
    }
    floorScoutSections[section] = !isFloorScoutSectionOpen(section);
    const floorInput = tartRoot.querySelector('#floorInput');
    renderFloorScout(Number(floorInput.value));
  });

  tartRoot.querySelector('#tartarus-objectives').addEventListener('change', (event) => {
    const toggle = event.target.closest('.objective-toggle');
    if (!toggle) {
      return;
    }
    tartStore.dispatch({
      type: 'OBJECTIVE_SET_COMPLETE',
      payload: {
        id: toggle.dataset.objectiveId,
        complete: toggle.checked
      }
    });
  });

  tartStore.subscribe(scheduleStoreBackedTartarusViews);
}

window.openShadowIntelViewExternal = openShadowIntelView;
window.initTartarus = initTartarus;
})();
