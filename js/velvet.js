// P3R Companion — Velvet Room Fusion Logic

// ========== PRECOMPUTED STRUCTURES ==========
const V_RESIST_ELEMS = ['sla','str','pie','fir','ice','ele','win','lig','dar','alm'];
const V_RESIST_LABELS = {w:'WK',s:'RS',n:'NU',r:'RP',d:'AB','-':'—'};
const RESIST_CLASS = {w:'resist-w',s:'resist-s',n:'resist-n',r:'resist-r',d:'resist-d','-':'resist-x'};
const STAT_NAMES = ['St','Ma','En','Ag','Lu'];
const STAT_COLORS = ['#ff5722','#7c4dff','#2196f3','#4caf50','#ffc107'];
const ELEM_NAMES = {fir:'Fire',ice:'Ice',ele:'Elec',win:'Wind',lig:'Light',dar:'Dark',alm:'Almighty',
  sla:'Slash',str:'Strike',pie:'Pierce',rec:'Recovery',sup:'Support',ail:'Ailment',pas:'Passive',spe:'Special'};

// Special recipe personas set
const specialPersonas = new Set(Object.keys(SPECIAL_RECIPES));

// Personas sorted by arcana
const personaList = Object.entries(PERSONAS).map(([name,d])=>({name,...d})).sort((a,b)=>a.lvl-b.lvl);
const resultsByArcana = {};  // excludes specials
const ingredientsByArcana = {};  // includes specials
for (const p of personaList) {
  if (!ingredientsByArcana[p.race]) ingredientsByArcana[p.race] = [];
  ingredientsByArcana[p.race].push(p);
  if (!specialPersonas.has(p.name)) {
    if (!resultsByArcana[p.race]) resultsByArcana[p.race] = [];
    resultsByArcana[p.race].push(p);
  }
}

// Symmetric fusion chart
function getResultArcana(a1, a2) {
  if (a1 === a2) return a1; // same-arcana fusion
  return (ARCANA_CHART[a1] && ARCANA_CHART[a1][a2]) || null;
}

// ========== FUSION ALGORITHM ==========
function checkSpecialRecipe(names) {
  const nameSet = new Set(names);
  for (const [result, ingredients] of Object.entries(SPECIAL_RECIPES)) {
    if (ingredients.length === names.length && ingredients.every(i => nameSet.has(i))) {
      return result;
    }
  }
  return null;
}

function fuseDyad(p1, p2) {
  // Check 2-ingredient special
  const special = checkSpecialRecipe([p1.name, p2.name]);
  if (special) return { name: special, ...PERSONAS[special], special: true };

  if (p1.race === p2.race) return fuseSameArcana(p1, p2);

  const resultArcana = getResultArcana(p1.race, p2.race);
  if (!resultArcana) return null;

  const candidates = resultsByArcana[resultArcana];
  if (!candidates || candidates.length === 0) return null;

  const sumLvl = p1.lvl + p2.lvl;
  // Find index: count of candidates where sumLvl >= 2 * candidate.lvl
  let idx = 0;
  for (let i = 0; i < candidates.length; i++) {
    if (sumLvl >= 2 * candidates[i].lvl) idx = i + 1;
  }
  // Clamp
  if (idx >= candidates.length) idx = candidates.length - 1;

  // Skip if result is one of the ingredients
  if (candidates[idx].name === p1.name || candidates[idx].name === p2.name) {
    idx++;
  }
  if (idx >= candidates.length) return null;

  return candidates[idx];
}

function fuseSameArcana(p1, p2) {
  const arcana = p1.race;
  const candidates = (resultsByArcana[arcana] || []).filter(
    c => c.lvl !== p1.lvl && c.lvl !== p2.lvl
  );
  if (candidates.length === 0) return null;

  const sumLvl = p1.lvl + p2.lvl;
  // Go downward: highest index where sumLvl + 2 >= 2 * candidate.lvl
  let idx = -1;
  for (let i = candidates.length - 1; i >= 0; i--) {
    if (sumLvl + 2 >= 2 * candidates[i].lvl) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;

  // If result level matches p2 level, go lower
  if (candidates[idx].lvl === p2.lvl) {
    idx--;
  }
  if (idx < 0) return null;

  return candidates[idx];
}

function reverseLookup(targetName) {
  const target = PERSONAS[targetName];
  if (!target) return [];

  // Check if it's a special fusion
  if (SPECIAL_RECIPES[targetName]) {
    return [{ type: 'special', ingredients: SPECIAL_RECIPES[targetName] }];
  }

  const results = [];
  const targetArcana = target.race;

  // Find all arcana pairs that produce targetArcana
  for (let i = 0; i < ARCANA_LIST.length; i++) {
    for (let j = i; j < ARCANA_LIST.length; j++) {
      const a1 = ARCANA_LIST[i], a2 = ARCANA_LIST[j];
      let resultArcana;
      if (a1 === a2) resultArcana = a1;
      else resultArcana = getResultArcana(a1, a2);

      if (resultArcana !== targetArcana) continue;

      // Try all persona pairs from these arcana
      const list1 = ingredientsByArcana[a1] || [];
      const list2 = a1 === a2 ? list1 : (ingredientsByArcana[a2] || []);

      for (const p1 of list1) {
        for (const p2 of list2) {
          if (p1.name === p2.name) continue;
          if (a1 === a2 && p1.lvl >= p2.lvl) continue; // avoid duplicates
          const result = fuseDyad(p1, p2);
          if (result && result.name === targetName) {
            results.push({ type: 'normal', p1: p1.name, p2: p2.name });
          }
        }
      }
    }
  }
  return results;
}

// ========== ROSTER ==========
let roster = new Set(JSON.parse(localStorage.getItem('p3r-roster') || '[]'));

function saveRoster() {
  localStorage.setItem('p3r-roster', JSON.stringify([...roster]));
}

function addToRoster(name) {
  if (!PERSONAS[name] || roster.has(name)) return;
  roster.add(name);
  saveRoster();
  renderRoster();
}

function removeFromRoster(name) {
  roster.delete(name);
  saveRoster();
  renderRoster();
}

function clearRoster() {
  if (!confirm('Clear your entire persona roster? This cannot be undone.')) return;
  roster.clear();
  saveRoster();
  renderRoster();
}

function reloadRoster() {
  roster = new Set(JSON.parse(localStorage.getItem('p3r-roster') || '[]'));
  renderRoster();
}
window.reloadRoster = reloadRoster;


function renderRoster() {
  const grid = document.getElementById('roster-grid');
  const sorted = [...roster].filter(n=>PERSONAS[n]).sort((a,b)=>PERSONAS[a].lvl-PERSONAS[b].lvl);
  // Build SL lookup for badges (Feature 2)
  var slMap = {};
  var activeSL = getActiveSocialLinks();
  activeSL.forEach(function(sl) { slMap[sl.arcana] = sl; });
  grid.innerHTML = sorted.map(name => {
    const p = PERSONAS[name];
    const slInfo = slMap[p.race];
    const slBadge = slInfo ? `<span class="roster-sl-badge">SL: ${slInfo.character} Rk${slInfo.rank}</span>` : '';
    return `<div class="roster-card">
      <span class="r-lvl">Lv${p.lvl}</span>
      <span class="r-name">${name}</span>
      <span class="r-arcana">${p.race}</span>
      ${slBadge}
      <button class="r-remove" onclick="removeFromRoster('${name.replace(/'/g,"\\'")}')">\u00d7</button>
    </div>`;
  }).join('');
  document.getElementById('roster-count').textContent = roster.size + '/194';
  renderRosterAnalysis();
}

// ========== AUTOCOMPLETE ==========
function setupAutocomplete(inputId, dropdownId, getItems, onSelect, opts = {}) {
  const input = document.getElementById(inputId);
  const dd = document.getElementById(dropdownId);
  const clearOnSelect = opts.clearOnSelect !== false; // default true
  const showOnEmpty = opts.showOnEmpty || false;
  let items = [], highlighted = -1, selecting = false;

  function doSelect(item) {
    selecting = true;
    onSelect(item);
    if (clearOnSelect) input.value = '';
    dd.classList.remove('open');
    setTimeout(() => { selecting = false; }, 50);
  }

  function update() {
    if (selecting) return;
    const q = input.value.toLowerCase().trim();
    if (!q && !showOnEmpty) { dd.classList.remove('open'); return; }
    items = getItems(q).slice(0, 20);
    highlighted = -1;
    if (items.length === 0) { dd.classList.remove('open'); return; }
    dd.innerHTML = items.map((p,i) =>
      `<div class="ac-item" data-idx="${i}">
        <span>${p.name}</span>
        <span><span class="ac-arcana">${p.race}</span> <span class="ac-lvl">Lv${p.lvl}</span></span>
      </div>`
    ).join('');
    dd.classList.add('open');
    dd.querySelectorAll('.ac-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        doSelect(items[+el.dataset.idx]);
      });
    });
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', () => { if (!selecting) update(); });
  input.addEventListener('blur', () => setTimeout(() => dd.classList.remove('open'), 200));
  input.addEventListener('keydown', e => {
    if (!dd.classList.contains('open')) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, items.length - 1);
      highlightItem(dd, highlighted);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
      highlightItem(dd, highlighted);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && highlighted < items.length) {
        doSelect(items[highlighted]);
      } else if (items.length === 1) {
        doSelect(items[0]);
      }
    } else if (e.key === 'Escape') {
      dd.classList.remove('open');
    }
  });
}

function highlightItem(dd, idx) {
  dd.querySelectorAll('.ac-item').forEach((el,i) => {
    el.classList.toggle('highlighted', i === idx);
  });
}

// ========== RENDERING HELPERS ==========
function renderResists(resists) {
  return V_RESIST_ELEMS.map((elem,i) => {
    const code = resists[i] || '-';
    const cls = RESIST_CLASS[code] || 'resist-x';
    const label = V_RESIST_LABELS[code] || '—';
    return `<span class="resist-badge ${cls}"><span class="r-elem">${elem}</span>${label}</span>`;
  }).join('');
}

function renderStats(stats) {
  return stats.map((val,i) => {
    const pct = Math.round(val / 99 * 100);
    return `<div class="stat-item">
      <div class="stat-label">${STAT_NAMES[i]}</div>
      <div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%;background:${STAT_COLORS[i]}"></div></div>
      <div class="stat-val">${val}</div>
    </div>`;
  }).join('');
}

function renderSkills(skills) {
  return Object.entries(skills).sort((a,b)=>a[1]-b[1]).map(([name, lvl]) => {
    const sk = SKILLS[name];
    const elemClass = sk ? 'elem-' + sk.elem : '';
    let lvlText = '';
    if (lvl === 0) lvlText = '<span class="s-innate">innate</span>';
    else if (lvl === -1) lvlText = '<span class="s-lvl">heart</span>';
    else lvlText = `<span class="s-lvl">Lv${lvl}</span>`;
    let tooltip = '';
    if (sk) {
      const parts = [(ELEM_NAMES[sk.elem]||sk.elem), sk.target];
      if (sk.cost) parts.push('Cost ' + sk.cost);
      if (sk.power) parts.push('Pow ' + sk.power);
      if (sk.effect) parts.push(sk.effect);
      tooltip = ` data-tooltip="${parts.join(' | ')}"`;
    }
    return `<span class="skill-tag"${tooltip}><span class="s-elem ${elemClass}"></span><span class="s-name">${name}</span>${lvlText}</span>`;
  }).join('');
}

function getInheritLabel(name) {
  const p = PERSONAS[name];
  if (!p || !p.inherits || typeof INHERIT_MAP === 'undefined') return '';
  const info = INHERIT_MAP[p.inherits];
  return info ? info.label : p.inherits;
}

function getTransferableSkills(pAName, pBName, resultName) {
  const result = PERSONAS[resultName];
  if (!result || !result.inherits || typeof INHERIT_MAP === 'undefined') return { canInherit: [], blocked: [] };
  const info = INHERIT_MAP[result.inherits];
  if (!info) return { canInherit: [], blocked: [] };
  const blocked = new Set(info.blocked);
  const resultSkills = new Set(Object.keys(result.skills));
  const canInherit = [], blockedList = [];
  const seen = new Set();
  [pAName, pBName].forEach(function(pName) {
    const p = PERSONAS[pName];
    if (!p) return;
    Object.keys(p.skills).forEach(function(skName) {
      if (seen.has(skName) || resultSkills.has(skName)) return;
      seen.add(skName);
      const sk = SKILLS[skName];
      if (!sk) return;
      if (blocked.has(sk.elem)) blockedList.push(skName);
      else canInherit.push(skName);
    });
  });
  return { canInherit, blocked: blockedList };
}

function renderPersonaCard(name) {
  const p = PERSONAS[name];
  if (!p) return '<div class="invalid-msg">Unknown persona</div>';
  const inheritLabel = getInheritLabel(name);
  const inheritBadge = inheritLabel ? `<span class="inherit-badge">Inherits: ${inheritLabel}</span>` : '';
  return `<div class="result-card">
    <div class="r-header">
      <span class="r-name">${name}</span>
      <span class="r-arcana-badge">${p.race}</span>
      <span class="r-lvl-badge">Lv ${p.lvl}</span>
      ${inheritBadge}
    </div>
    <div class="stats-grid">${renderStats(p.stats)}</div>
    <div class="resists-row">${renderResists(p.resists)}</div>
    <div class="skills-list">${renderSkills(p.skills)}</div>
  </div>`;
}

// ========== ROSTER ANALYSIS (Feature 2) ==========
const ATTACK_ELEMS = ['fir','ice','ele','win','lig','dar','sla','str','pie','alm'];

function analyzeAttackCoverage() {
  const coverage = {};
  ATTACK_ELEMS.forEach(e => { coverage[e] = { count: 0, bestSkill: null, bestPow: 0 }; });
  for (const name of roster) {
    const p = PERSONAS[name];
    if (!p) continue;
    for (const skName of Object.keys(p.skills)) {
      const sk = SKILLS[skName];
      if (!sk || !coverage[sk.elem]) continue;
      coverage[sk.elem].count++;
      if (sk.power > coverage[sk.elem].bestPow) {
        coverage[sk.elem].bestPow = sk.power;
        coverage[sk.elem].bestSkill = skName;
      }
    }
  }
  return coverage;
}

function analyzeDefensiveGaps() {
  const defense = {};
  V_RESIST_ELEMS.forEach(e => { defense[e] = { weak: 0, resist: 0 }; });
  for (const name of roster) {
    const p = PERSONAS[name];
    if (!p) continue;
    V_RESIST_ELEMS.forEach((e, i) => {
      const code = p.resists[i] || '-';
      if (code === 'w') defense[e].weak++;
      if ('snrd'.includes(code)) defense[e].resist++;
    });
  }
  return defense;
}

function getActiveSocialLinks() {
  try {
    var raw = localStorage.getItem('p3r-social-links');
    if (!raw) return [];
    var data = JSON.parse(raw);
    if (!data || !data.ranks) return [];
    var result = [];
    for (var arcana in data.ranks) {
      var rank = data.ranks[arcana];
      if (rank > 0 && rank < 10 && typeof SOCIAL_LINKS !== 'undefined' && SOCIAL_LINKS[arcana] && !SOCIAL_LINKS[arcana].automatic) {
        result.push({ arcana: arcana, rank: rank, character: SOCIAL_LINKS[arcana].character });
      }
    }
    return result;
  } catch(e) { return []; }
}

function renderRosterAnalysis() {
  const card = document.getElementById('roster-analysis-card');
  if (roster.size === 0) { card.style.display = 'none'; return; }
  card.style.display = '';

  const coverage = analyzeAttackCoverage();
  const defense = analyzeDefensiveGaps();

  const gaps = ATTACK_ELEMS.filter(e => coverage[e].count === 0);
  const weakElems = V_RESIST_ELEMS.filter(e => defense[e].weak > 0 && defense[e].resist === 0);

  let html = '<div class="analysis-section"><h4>Attack Coverage</h4><div class="elem-badges">';
  ATTACK_ELEMS.forEach(e => {
    const c = coverage[e];
    const isGap = c.count === 0;
    html += `<div class="elem-badge ${isGap ? 'gap-elem' : 'covered-elem'}">
      <span class="eb-label">${ELEM_NAMES[e]||e}</span>
      <span class="eb-count">${isGap ? 'GAP' : c.count}</span>
      ${c.bestSkill ? `<span class="eb-skill">${c.bestSkill}</span>` : ''}
    </div>`;
  });
  html += '</div></div>';

  html += '<div class="analysis-section"><h4>Defensive Weaknesses</h4><div class="elem-badges">';
  V_RESIST_ELEMS.forEach(e => {
    const d = defense[e];
    const danger = d.weak > 0 && d.resist === 0;
    const cls = danger ? 'danger-weak' : d.resist > 0 ? 'safe-elem' : '';
    html += `<div class="elem-badge ${cls}">
      <span class="eb-label">${ELEM_NAMES[e]||e}</span>
      <span class="eb-count" style="color:${d.weak > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${d.weak}W</span>
      <span class="eb-skill" style="color:${d.resist > 0 ? 'var(--success)' : 'var(--text-muted)'}">${d.resist}R</span>
    </div>`;
  });
  html += '</div></div>';

  // Summary line
  const summaryParts = [];
  if (gaps.length) summaryParts.push('No ' + gaps.map(e => ELEM_NAMES[e]||e).join(', ') + ' damage');
  if (weakElems.length) summaryParts.push(weakElems.length + ' undefended weakness' + (weakElems.length>1?'es':'') + ' (' + weakElems.map(e=>ELEM_NAMES[e]||e).join(', ') + ')');
  if (!gaps.length && !weakElems.length) summaryParts.push('Full coverage, no undefended weaknesses!');
  html += `<div class="analysis-summary">${summaryParts.join('. ')}.</div>`;

  // Social Link Coverage (Feature 2)
  var activeSL = getActiveSocialLinks();
  if (activeSL.length > 0) {
    html += '<div class="analysis-section"><h4>Social Link Coverage</h4><div class="sl-coverage-grid">';
    activeSL.forEach(function(sl) {
      var hasPersona = false, personaName = '';
      roster.forEach(function(n) { if (PERSONAS[n] && PERSONAS[n].race === sl.arcana) { hasPersona = true; personaName = n; } });
      var cls = hasPersona ? 'sl-cov-ok' : 'sl-cov-gap';
      html += '<div class="sl-cov-item ' + cls + '">';
      html += '<span class="sl-cov-arcana">' + sl.arcana + '</span>';
      html += '<span class="sl-cov-char">' + sl.character + ' Rk' + sl.rank + '</span>';
      if (hasPersona) html += '<span class="sl-cov-persona">' + personaName + '</span>';
      else html += '<span class="sl-cov-missing">Fuse a ' + sl.arcana + ' persona</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  document.getElementById('roster-analysis').innerHTML = html;
}

// ========== FUSION SCORING (Feature 3) ==========
let cachedCoverage = null, cachedDefense = null;

function refreshAnalysisCache() {
  cachedCoverage = analyzeAttackCoverage();
  cachedDefense = analyzeDefensiveGaps();
}

function analyzeLostCoverage(f) {
  const rp = PERSONAS[f.result], pa = PERSONAS[f.a], pb = PERSONAS[f.b];
  if (!rp || !pa || !pb || !cachedCoverage || !cachedDefense) return { lostResists: [], lostAttacks: [], resummon: {} };

  const lostResists = [];
  V_RESIST_ELEMS.forEach((e, i) => {
    let count = cachedDefense[e].resist;
    if ('snrd'.includes(pa.resists[i] || '-')) count--;
    if ('snrd'.includes(pb.resists[i] || '-')) count--;
    if ('snrd'.includes(rp.resists[i] || '-')) count++;
    if (count <= 0 && cachedDefense[e].resist > 0) {
      const sources = [];
      if ('snrd'.includes(pa.resists[i] || '-')) sources.push(f.a);
      if ('snrd'.includes(pb.resists[i] || '-')) sources.push(f.b);
      lostResists.push({ elem: e, elemName: ELEM_NAMES[e] || e, sources });
    }
  });

  const lostAttacks = [];
  // Track per-element which ingredients contribute
  const ingElemsByPersona = { [f.a]: {}, [f.b]: {} };
  ATTACK_ELEMS.forEach(e => { ingElemsByPersona[f.a][e] = 0; ingElemsByPersona[f.b][e] = 0; });
  for (const [name, pData] of [[f.a, pa], [f.b, pb]]) {
    for (const skName of Object.keys(pData.skills)) {
      const sk = SKILLS[skName];
      if (sk && ingElemsByPersona[name][sk.elem] !== undefined) ingElemsByPersona[name][sk.elem]++;
    }
  }
  const ingElems = {};
  const resElems = {};
  ATTACK_ELEMS.forEach(e => {
    ingElems[e] = ingElemsByPersona[f.a][e] + ingElemsByPersona[f.b][e];
    resElems[e] = 0;
  });
  for (const skName of Object.keys(rp.skills)) {
    const sk = SKILLS[skName];
    if (sk && resElems[sk.elem] !== undefined) resElems[sk.elem]++;
  }
  ATTACK_ELEMS.forEach(e => {
    const after = cachedCoverage[e].count - ingElems[e] + resElems[e];
    if (after <= 0 && cachedCoverage[e].count > 0) {
      const sources = [];
      if (ingElemsByPersona[f.a][e] > 0) sources.push(f.a);
      if (ingElemsByPersona[f.b][e] > 0) sources.push(f.b);
      lostAttacks.push({ elem: e, elemName: ELEM_NAMES[e] || e, sources });
    }
  });

  // Build resummon map: { personaName: [reason strings] }
  const resummon = {};
  for (const l of lostResists) {
    for (const src of l.sources) {
      if (!resummon[src]) resummon[src] = [];
      resummon[src].push(l.elemName + ' resist');
    }
  }
  for (const l of lostAttacks) {
    for (const src of l.sources) {
      if (!resummon[src]) resummon[src] = [];
      resummon[src].push(l.elemName + ' attack');
    }
  }

  return { lostResists, lostAttacks, resummon };
}

function scoreFusion(f) {
  const rp = PERSONAS[f.result];
  if (!rp) return 0;
  let score = 0;

  // New persona bonus
  if (f.isNew) score += 10;

  // Attack coverage bonus
  const resultElems = new Set();
  for (const skName of Object.keys(rp.skills)) {
    const sk = SKILLS[skName];
    if (sk && ATTACK_ELEMS.includes(sk.elem)) resultElems.add(sk.elem);
  }
  for (const elem of resultElems) {
    if (cachedCoverage && cachedCoverage[elem]?.count === 0) score += 15;
  }

  // Defensive synergy
  V_RESIST_ELEMS.forEach((e, i) => {
    const code = rp.resists[i] || '-';
    if ('nrd'.includes(code) && cachedDefense && cachedDefense[e]?.weak > 0) score += 5;
    if (code === 'w') score -= 3;
  });

  // Level advantage
  const p1 = PERSONAS[f.a], p2 = PERSONAS[f.b];
  if (p1 && p2) {
    const maxIngLvl = Math.max(p1.lvl, p2.lvl);
    score += Math.min(10, Math.max(0, rp.lvl - maxIngLvl));
  }

  // Healing skills
  const hasHealing = Object.keys(rp.skills).some(s => SKILLS[s]?.elem === 'rec');
  if (hasHealing) score += 3;

  // Severe+ attacks (pow >= 400)
  const hasSevere = Object.keys(rp.skills).some(s => (SKILLS[s]?.power || 0) >= 400);
  if (hasSevere) score += 3;

  // Key buffs
  const buffSkills = ['Matarukaja','Marakukaja','Masukukaja','Heat Riser','Debilitate','Dekunda','Dekaja','Charge','Concentrate'];
  const hasKeyBuff = Object.keys(rp.skills).some(s => buffSkills.includes(s));
  if (hasKeyBuff) score += 5;

  // Skill inheritance quality bonus (Feature 1)
  if (typeof INHERIT_MAP !== 'undefined' && f.a && f.b) {
    const trans = getTransferableSkills(f.a, f.b, f.result);
    const highValueTransfer = trans.canInherit.some(s => {
      const sk = SKILLS[s];
      return sk && (sk.elem === 'rec' || sk.elem === 'sup' || (sk.power && sk.power >= 200));
    });
    if (highValueTransfer) score += 4;
  }

  // Social link arcana need bonus (Feature 2)
  var activeSL = getActiveSocialLinks();
  if (activeSL.length > 0) {
    var slArcanas = activeSL.map(function(sl) { return sl.arcana; });
    if (slArcanas.indexOf(rp.race) !== -1) {
      var hasMatch = false;
      roster.forEach(function(n) { if (PERSONAS[n] && PERSONAS[n].race === rp.race) hasMatch = true; });
      if (!hasMatch) score += 8;
    }
  }

  return score;
}

function getScoreColor(score) {
  if (score >= 30) return 'color:#ffd54f;background:rgba(255,213,79,0.2)';
  if (score >= 20) return 'color:#fff9c4;background:rgba(255,249,196,0.1)';
  if (score >= 10) return 'color:var(--text-primary);background:rgba(255,255,255,0.06)';
  return 'color:var(--text-muted);background:transparent';
}

// ========== RECOMMENDED FUSIONS (Feature 4) ==========
function getRecommendationReason(f) {
  const rp = PERSONAS[f.result];
  if (!rp) return '';
  const reasons = [];

  // Coverage fills
  for (const skName of Object.keys(rp.skills)) {
    const sk = SKILLS[skName];
    if (sk && ATTACK_ELEMS.includes(sk.elem) && cachedCoverage && cachedCoverage[sk.elem]?.count === 0) {
      reasons.push('Fills ' + (ELEM_NAMES[sk.elem]||sk.elem) + ' gap');
      break;
    }
  }

  // Defensive nulls
  V_RESIST_ELEMS.forEach((e, i) => {
    const code = rp.resists[i] || '-';
    if ('nrd'.includes(code) && cachedDefense && cachedDefense[e]?.weak > 0) {
      const verb = code === 'n' ? 'Nulls' : code === 'r' ? 'Repels' : 'Drains';
      reasons.push(verb + ' ' + (ELEM_NAMES[e]||e));
    }
  });

  // Notable skills
  const healSkills = Object.keys(rp.skills).filter(s => SKILLS[s]?.elem === 'rec');
  if (healSkills.length) reasons.push('Brings ' + healSkills[0]);
  const buffSkills = ['Matarukaja','Marakukaja','Masukukaja','Heat Riser','Debilitate','Charge','Concentrate'];
  const foundBuff = Object.keys(rp.skills).find(s => buffSkills.includes(s));
  if (foundBuff) reasons.push('Has ' + foundBuff);

  // Resummon recommendations for lost coverage
  const lost = analyzeLostCoverage(f);
  for (const [persona, whys] of Object.entries(lost.resummon)) {
    reasons.push(`<span class="rec-warning">Resummon ${persona} for ${whys.join(', ')}</span>`);
  }

  return reasons.slice(0, 5).join(', ');
}

function renderRecommendedFusions() {
  const card = document.getElementById('rec-fusions-card');
  if (allFusions.length === 0) { card.style.display = 'none'; return; }

  refreshAnalysisCache();
  const scored = allFusions.map(f => ({ ...f, score: scoreFusion(f) }));
  scored.sort((a,b) => b.score - a.score);
  const top5 = scored.filter(f => f.score > 0).slice(0, 5);
  if (top5.length === 0) { card.style.display = 'none'; return; }

  card.style.display = '';
  document.getElementById('rec-fusions').innerHTML = top5.map(f => {
    const reason = getRecommendationReason(f);
    return `<div class="rec-item" onclick="autoPopulateFusion('${f.a.replace(/'/g,"\\'")}','${f.b.replace(/'/g,"\\'")}')">
      <span class="rec-score" style="${getScoreColor(f.score)}">${f.score}</span>
      <span class="rec-name">${f.result}</span>
      <span class="rec-from">${f.a} + ${f.b}</span>
      <span class="rec-reason">${reason}</span>
    </div>`;
  }).join('');
}

function autoPopulateFusion(a, b) {
  fuseAName = a; fuseBName = b;
  document.getElementById('fuse-a').value = a;
  document.getElementById('fuse-b').value = b;
  updateFusionResult();
  window.scrollTo({ top: document.getElementById('fuse-a').closest('.card').offsetTop - 60, behavior: 'smooth' });
}

// ========== FUSION COMPARISON (Feature 6) ==========
function renderFusionComparison(resultName, p1Name, p2Name) {
  const rp = PERSONAS[resultName], pp1 = PERSONAS[p1Name], pp2 = PERSONAS[p2Name];
  if (!rp || !pp1 || !pp2) return '';

  const bestIng = pp1.lvl >= pp2.lvl ? pp1 : pp2;
  const bestIngName = pp1.lvl >= pp2.lvl ? p1Name : p2Name;

  // Level delta
  const lvlDelta = rp.lvl - bestIng.lvl;
  const lvlClass = lvlDelta > 0 ? 'delta-pos' : lvlDelta < 0 ? 'delta-neg' : 'delta-neutral';

  // Stat deltas
  const statDeltas = STAT_NAMES.map((s, i) => {
    const d = rp.stats[i] - bestIng.stats[i];
    const cls = d > 0 ? 'delta-pos' : d < 0 ? 'delta-neg' : 'delta-neutral';
    return `<span class="delta-badge ${cls}">${s} ${d > 0 ? '+' : ''}${d}</span>`;
  }).join('');

  // Skills gained / lost
  const ingSkills = new Set([...Object.keys(pp1.skills), ...Object.keys(pp2.skills)]);
  const resSkills = new Set(Object.keys(rp.skills));
  const gained = [...resSkills].filter(s => !ingSkills.has(s));
  const lost = [...ingSkills].filter(s => !resSkills.has(s));

  let skillsHtml = '';
  if (gained.length) skillsHtml += '<div style="margin-bottom:0.3rem">' + gained.map(s => `<span class="delta-badge skill-gained">+${s}</span>`).join(' ') + '</div>';
  if (lost.length) skillsHtml += '<div>' + lost.map(s => `<span class="delta-badge skill-lost">-${s}</span>`).join(' ') + '</div>';

  // Resist changes
  let resistHtml = '';
  const resistChanges = [];
  V_RESIST_ELEMS.forEach((e, i) => {
    const rc = rp.resists[i] || '-';
    const ic = bestIng.resists[i] || '-';
    if (rc === ic) return;
    const order = '-wsnrd';
    const improved = order.indexOf(rc) > order.indexOf(ic);
    const rLabel = V_RESIST_LABELS[rc]||'—', iLabel = V_RESIST_LABELS[ic]||'—';
    resistChanges.push(`<span class="delta-badge ${improved ? 'delta-pos' : 'delta-neg'}">${(ELEM_NAMES[e]||e)} ${iLabel}→${rLabel}</span>`);
  });
  if (resistChanges.length) resistHtml = resistChanges.join(' ');

  return `<div class="comparison-panel">
    <h4>vs ${bestIngName} (best ingredient)</h4>
    <div class="comp-section"><h5>Level</h5><div class="delta-row"><span class="delta-badge ${lvlClass}">Lv ${lvlDelta > 0 ? '+' : ''}${lvlDelta}</span></div></div>
    <div class="comp-section"><h5>Stats</h5><div class="delta-row">${statDeltas}</div></div>
    ${skillsHtml ? `<div class="comp-section"><h5>Skills</h5>${skillsHtml}</div>` : ''}
    ${resistHtml ? `<div class="comp-section"><h5>Resistances</h5><div class="delta-row">${resistHtml}</div></div>` : ''}
  </div>`;
}

// ========== FUSION LAB ==========
let fuseAName = null, fuseBName = null;

function resetFusion() {
  fuseAName = null;
  fuseBName = null;
  document.getElementById('fuse-a').value = '';
  document.getElementById('fuse-b').value = '';
  document.getElementById('fusion-result').innerHTML = '';
}

function updateFusionResult() {
  const div = document.getElementById('fusion-result');
  if (!fuseAName || !fuseBName) { div.innerHTML = ''; return; }
  if (fuseAName === fuseBName) { div.innerHTML = '<div class="invalid-msg">Select two different personas</div>'; return; }

  const p1 = { name: fuseAName, ...PERSONAS[fuseAName] };
  const p2 = { name: fuseBName, ...PERSONAS[fuseBName] };
  const result = fuseDyad(p1, p2);

  if (!result) {
    div.innerHTML = '<div class="invalid-msg">No valid fusion result for this combination</div>';
    return;
  }

  let warningHtml = '';
  if (roster.size > 0) {
    refreshAnalysisCache();
    const lost = analyzeLostCoverage({ a: fuseAName, b: fuseBName, result: result.name });
    const resummonEntries = Object.entries(lost.resummon);
    if (resummonEntries.length) {
      const lines = resummonEntries.map(([persona, whys]) =>
        `Consider resummoning <strong>${persona}</strong> for ${whys.map(w => `<span class="cw-item">${w}</span>`).join(' ')}`
      );
      warningHtml = `<div class="coverage-warning">${lines.join('<br>')}</div>`;
    }
  }

  // Skill inheritance panel
  let inheritHtml = '';
  const transfer = getTransferableSkills(fuseAName, fuseBName, result.name);
  if (transfer.canInherit.length || transfer.blocked.length) {
    inheritHtml = '<div class="inherit-panel"><h4>Skill Inheritance</h4>';
    if (transfer.canInherit.length) {
      inheritHtml += '<div class="inherit-section"><span class="inherit-label-ok">Can Inherit:</span> ';
      inheritHtml += transfer.canInherit.map(s => `<span class="inherit-skill inherit-ok">${s}</span>`).join(' ');
      inheritHtml += '</div>';
    }
    if (transfer.blocked.length) {
      inheritHtml += '<div class="inherit-section"><span class="inherit-label-no">Blocked:</span> ';
      inheritHtml += transfer.blocked.map(s => `<span class="inherit-skill inherit-no">${s}</span>`).join(' ');
      inheritHtml += '</div>';
    }
    inheritHtml += '</div>';
  }

  div.innerHTML = renderPersonaCard(result.name) + inheritHtml + warningHtml + renderFusionComparison(result.name, fuseAName, fuseBName);
}

// All fusions
let allFusions = [], allFusionsSortKey = 'score', allFusionsSortDir = -1;

function computeAllFusions() {
  refreshAnalysisCache();
  const rosterList = [...roster].filter(n=>PERSONAS[n]).map(n=>({name:n,...PERSONAS[n]}));
  allFusions = [];
  for (let i = 0; i < rosterList.length; i++) {
    for (let j = i + 1; j < rosterList.length; j++) {
      const result = fuseDyad(rosterList[i], rosterList[j]);
      if (result) {
        const f = {
          a: rosterList[i].name,
          b: rosterList[j].name,
          result: result.name,
          arcana: (PERSONAS[result.name]||{}).race || '',
          level: (PERSONAS[result.name]||{}).lvl || 0,
          isNew: !roster.has(result.name)
        };
        f.score = scoreFusion(f);
        allFusions.push(f);
      }
    }
  }
  renderAllFusions();
  renderRecommendedFusions();
  document.getElementById('all-fusions-wrap').style.display = '';
}

function renderAllFusions() {
  const newOnly = document.getElementById('filter-new-only').checked;
  const arcanaFilter = document.getElementById('filter-arcana-fusion').value;

  let filtered = allFusions;
  if (newOnly) filtered = filtered.filter(f => f.isNew);
  if (arcanaFilter) filtered = filtered.filter(f => f.arcana === arcanaFilter);

  filtered.sort((a,b) => {
    let va = a[allFusionsSortKey], vb = b[allFusionsSortKey];
    if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
    return va < vb ? -allFusionsSortDir : va > vb ? allFusionsSortDir : 0;
  });

  document.getElementById('all-fusions-count').textContent = filtered.length + ' fusions';
  document.getElementById('all-fusions-body').innerHTML = filtered.map(f =>
    `<tr style="cursor:pointer" onclick="autoPopulateFusion('${f.a.replace(/'/g,"\\'")}','${f.b.replace(/'/g,"\\'")}')"><td>${f.a}</td><td>${f.b}</td><td>${f.result}${f.isNew ? '<span class="new-badge">NEW</span>':''}</td><td>${f.arcana}</td><td>${f.level}</td><td><span class="score-cell" style="${getScoreColor(f.score)}">${f.score}</span></td></tr>`
  ).join('');
}

// Special fusions display
function renderSpecialFusions() {
  const list = document.getElementById('special-list');
  list.innerHTML = Object.entries(SPECIAL_RECIPES).sort((a,b)=>(PERSONAS[a[0]]?.lvl||0)-(PERSONAS[b[0]]?.lvl||0)).map(([name, ings]) => {
    const haveCount = ings.filter(i => roster.has(i)).length;
    const cls = haveCount === ings.length ? 'complete' : haveCount > 0 ? 'partial' : '';
    const statusCls = haveCount === ings.length ? 'ready' : haveCount > 0 ? 'partial-status' : 'none-status';
    const statusText = haveCount === ings.length ? 'READY' : haveCount + '/' + ings.length;
    const p = PERSONAS[name];
    return `<div class="special-item ${cls}">
      <span class="sp-name">${name}</span>
      <span class="r-arcana" style="font-size:0.7rem">${p?.race||''} Lv${p?.lvl||'?'}</span>
      <div class="sp-ingredients">${ings.map(i=>
        `<span class="sp-ing ${roster.has(i)?'have':'missing'}">${i}</span>`
      ).join('+')}</div>
      <span class="sp-status ${statusCls}">${statusText}</span>
    </div>`;
  }).join('');
}

// ========== COMPENDIUM ==========
let compSortKey = 'lvl', compSortDir = 1;
let selectedPersona = null;

function renderCompendium() {
  const arcana = document.getElementById('comp-arcana').value;
  const lvlMin = parseInt(document.getElementById('comp-lvl-min').value) || 0;
  const lvlMax = parseInt(document.getElementById('comp-lvl-max').value) || 99;
  const search = document.getElementById('comp-search').value.toLowerCase().trim();
  const elemFilter = document.getElementById('comp-elem-filter').value;
  const resistType = document.getElementById('comp-resist-type').value;

  let list = personaList.filter(p => {
    if (arcana && p.race !== arcana) return false;
    if (p.lvl < lvlMin || p.lvl > lvlMax) return false;
    if (search) {
      const nameMatch = p.name.toLowerCase().includes(search);
      const skillMatch = Object.keys(p.skills).some(s => s.toLowerCase().includes(search));
      if (!nameMatch && !skillMatch) return false;
    }
    if (elemFilter) {
      const ri = V_RESIST_ELEMS.indexOf(elemFilter);
      if (ri >= 0) {
        const code = p.resists[ri] || '-';
        if (resistType === 'no-weak') {
          if (code === 'w') return false;
        } else if (resistType) {
          if (code !== resistType) return false;
        } else {
          if (code === '-') return false;
        }
      }
    }
    if (resistType && !elemFilter) {
      // Resist type without specific element: check all elements
      if (resistType === 'no-weak') {
        if (p.resists.includes('w')) return false;
      } else {
        const hasType = V_RESIST_ELEMS.some((e, i) => (p.resists[i] || '-') === resistType);
        if (!hasType) return false;
      }
    }
    return true;
  });

  list.sort((a,b) => {
    let va, vb;
    if (compSortKey === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    else if (compSortKey === 'race') { va = a.race; vb = b.race; }
    else if (compSortKey === 'lvl') { va = a.lvl; vb = b.lvl; }
    else if (['st','ma','en','ag','lu'].includes(compSortKey)) {
      const idx = ['st','ma','en','ag','lu'].indexOf(compSortKey);
      va = a.stats[idx]; vb = b.stats[idx];
    }
    else { va = a.lvl; vb = b.lvl; }
    return va < vb ? -compSortDir : va > vb ? compSortDir : 0;
  });

  const body = document.getElementById('comp-body');
  body.innerHTML = list.map(p => {
    const resistCells = V_RESIST_ELEMS.slice(0,9).map((elem,i) => {
      const code = p.resists[i];
      const cls = RESIST_CLASS[code] || '';
      const label = V_RESIST_LABELS[code] || '—';
      return `<td class="${cls}" style="text-align:center;font-size:0.75rem;font-weight:700">${label}</td>`;
    }).join('');
    return `<tr data-name="${p.name}" class="${selectedPersona===p.name?'selected':''}">
      <td style="font-weight:600">${p.name}</td>
      <td style="color:var(--accent-cyan);font-size:0.75rem">${p.race}</td>
      <td style="font-family:'JetBrains Mono',monospace">${p.lvl}</td>
      <td style="font-family:'JetBrains Mono',monospace">${p.stats[0]}</td>
      <td style="font-family:'JetBrains Mono',monospace">${p.stats[1]}</td>
      <td style="font-family:'JetBrains Mono',monospace">${p.stats[2]}</td>
      <td style="font-family:'JetBrains Mono',monospace">${p.stats[3]}</td>
      <td style="font-family:'JetBrains Mono',monospace">${p.stats[4]}</td>
      ${resistCells}
    </tr>`;
  }).join('');

  body.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      selectedPersona = tr.dataset.name;
      body.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      showCompDetail(tr.dataset.name);
    });
  });
}

function showCompDetail(name) {
  const div = document.getElementById('comp-detail');
  const p = PERSONAS[name];
  if (!p) { div.innerHTML = ''; return; }

  // Reverse lookup
  let reverseHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Computing...</p>';
  div.innerHTML = `<div class="detail-panel">
    ${renderPersonaCard(name)}
    <div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap">
      <button class="btn btn-gold" onclick="addToRoster('${name.replace(/'/g,"\\'")}');renderRoster()">Add to Roster</button>
      <button class="btn" onclick="setFusionTarget('${name.replace(/'/g,"\\'")}')">Set as Fusion Target</button>
    </div>
    <h3 style="margin-top:1rem;font-size:0.95rem">How to Fuse</h3>
    <div id="reverse-results">${reverseHTML}</div>
  </div>`;

  // Async reverse lookup
  setTimeout(() => {
    const results = reverseLookup(name);
    const rDiv = document.getElementById('reverse-results');
    if (!rDiv) return;

    if (results.length === 0) {
      rDiv.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No fusion recipes found (base persona or treasure demon)</p>';
      return;
    }

    if (results[0]?.type === 'special') {
      const ings = results[0].ingredients;
      rDiv.innerHTML = `<div style="margin-bottom:0.5rem;color:var(--accent-gold);font-size:0.85rem">Special Fusion:</div>
        <div style="display:flex;gap:0.3rem;flex-wrap:wrap">${ings.map(i =>
          `<span class="sp-ing ${roster.has(i)?'have':'missing'}">${i}</span>`
        ).join(' + ')}</div>`;
      return;
    }

    rDiv.innerHTML = `<div class="reverse-results">${results.slice(0,50).map(r =>
      `<div class="reverse-item">
        <span class="${roster.has(r.p1)?'ri-have':'ri-miss'}">${r.p1}</span>
        <span class="ri-plus">+</span>
        <span class="${roster.has(r.p2)?'ri-have':'ri-miss'}">${r.p2}</span>
      </div>`
    ).join('')}${results.length > 50 ? '<div style="color:var(--text-muted);font-size:0.8rem;padding:0.3rem">...and ' + (results.length-50) + ' more</div>' : ''}</div>`;
  }, 10);
}

function setFusionTarget(name) {
  switchTab('fusion');
  showChainPlanner(name);
}

// ========== FUSION CHAIN PLANNER ==========
function showChainPlanner(targetName) {
  const card = document.getElementById('chain-planner-card');
  const result = document.getElementById('chain-result');
  const label = document.getElementById('chain-target-name');
  card.style.display = '';
  label.textContent = targetName;

  if (roster.has(targetName)) {
    result.innerHTML = '<div class="chain-done">Already in your roster!</div>';
    return;
  }

  result.innerHTML = '<div style="color:var(--text-muted)">Computing chain...</div>';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(function() {
    const chain = planFusionChain(targetName);
    result.innerHTML = renderChain(chain, targetName);
  }, 10);
}

function closeChainPlanner() {
  document.getElementById('chain-planner-card').style.display = 'none';
}

function planFusionChain(targetName) {
  var available = new Set(roster);
  var steps = [];
  var visited = new Set();

  function solve(name, depth) {
    if (available.has(name)) return true;
    if (visited.has(name)) return false;
    if (depth > 4) return false;
    visited.add(name);

    // Special fusion
    if (SPECIAL_RECIPES[name]) {
      var ings = SPECIAL_RECIPES[name];
      var allOk = true;
      for (var i = 0; i < ings.length; i++) {
        if (!solve(ings[i], depth + 1)) { allOk = false; break; }
      }
      if (allOk) {
        steps.push({ type: 'special', result: name, ingredients: ings.slice() });
        available.add(name);
        return true;
      }
      visited.delete(name);
      return false;
    }

    // Normal fusion — find recipes
    var recipes = reverseLookup(name);
    if (recipes.length === 0 || (recipes[0] && recipes[0].type === 'special')) {
      visited.delete(name);
      return false;
    }

    // Sort recipes: prefer both-available, then one-available, then by combined level (simpler = better)
    var scored = recipes.filter(function(r) { return r.type === 'normal'; }).map(function(r) {
      var hasA = available.has(r.p1) ? 1 : 0;
      var hasB = available.has(r.p2) ? 1 : 0;
      var pA = PERSONAS[r.p1], pB = PERSONAS[r.p2];
      var lvl = (pA ? pA.lvl : 99) + (pB ? pB.lvl : 99);
      return { r: r, has: hasA + hasB, lvl: lvl };
    });
    scored.sort(function(a, b) { return b.has - a.has || a.lvl - b.lvl; });

    for (var j = 0; j < Math.min(scored.length, 20); j++) {
      var rec = scored[j].r;
      var canA = solve(rec.p1, depth + 1);
      if (!canA) continue;
      var canB = solve(rec.p2, depth + 1);
      if (canB) {
        steps.push({ type: 'fuse', result: name, a: rec.p1, b: rec.p2 });
        available.add(name);
        return true;
      }
    }

    visited.delete(name);
    return false;
  }

  var success = solve(targetName, 0);
  return { success: success, steps: steps };
}

function renderChain(chain, targetName) {
  if (chain.success && chain.steps.length === 0) {
    return '<div class="chain-done">Already in your roster!</div>';
  }
  if (!chain.success) {
    return '<div class="chain-fail">No fusion path found from your current roster (max 4 steps deep). Try adding more personas to your roster first.</div>';
  }

  var h = '<div class="chain-steps">';
  chain.steps.forEach(function(step, i) {
    var p = PERSONAS[step.result];
    var lvl = p ? p.lvl : '?';
    var race = p ? p.race : '';
    h += '<div class="chain-step">';
    h += '<span class="chain-num">' + (i + 1) + '</span>';
    if (step.type === 'special') {
      h += '<span class="chain-ings">' + step.ingredients.map(function(ing) {
        var inRoster = roster.has(ing);
        return '<span class="chain-ing ' + (inRoster ? 'have' : 'fused') + '">' + ing + '</span>';
      }).join(' + ') + '</span>';
    } else {
      var aInRoster = roster.has(step.a);
      var bInRoster = roster.has(step.b);
      h += '<span class="chain-ings">';
      h += '<span class="chain-ing ' + (aInRoster ? 'have' : 'fused') + '">' + step.a + '</span>';
      h += ' + ';
      h += '<span class="chain-ing ' + (bInRoster ? 'have' : 'fused') + '">' + step.b + '</span>';
      h += '</span>';
    }
    h += '<span class="chain-arrow">&rarr;</span>';
    var isTarget = step.result === targetName;
    h += '<span class="chain-result' + (isTarget ? ' chain-target' : '') + '">' + step.result + '</span>';
    h += '<span class="chain-meta">Lv' + lvl + ' ' + race + '</span>';
    if (step.type === 'special') h += '<span class="chain-badge-special">Special</span>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

// ========== TAB SWITCHING ==========
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
  if (tab === 'fusion') { renderSpecialFusions(); if (allFusions.length) renderRecommendedFusions(); }
  if (tab === 'compendium') renderCompendium();
}

// ========== GLOBAL SEARCH ==========
document.getElementById('globalSearch').addEventListener('input', function() {
  const q = this.value.toLowerCase().trim();
  const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
  if (activeTab === 'compendium') {
    document.getElementById('comp-search').value = q;
    renderCompendium();
  } else if (activeTab === 'roster') {
    // Filter roster grid
    document.querySelectorAll('.roster-card').forEach(card => {
      const name = card.querySelector('.r-name').textContent.toLowerCase();
      card.style.display = name.includes(q) || !q ? '' : 'none';
    });
  }
});


// ========== INIT ==========
function initVelvet() {
  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Populate arcana dropdowns
  const arcanaOpts = ARCANA_LIST.map(a => `<option value="${a}">${a}</option>`).join('');
  document.getElementById('comp-arcana').innerHTML += arcanaOpts;
  document.getElementById('filter-arcana-fusion').innerHTML += arcanaOpts;

  // Populate element filter
  const elemOpts = Object.entries(ELEM_NAMES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
  document.getElementById('comp-elem-filter').innerHTML += elemOpts;

  // Roster autocomplete
  setupAutocomplete('roster-search', 'roster-ac-dd',
    q => personaList.filter(p => p.name.toLowerCase().includes(q) && !roster.has(p.name)),
    p => { addToRoster(p.name); },
    { clearOnSelect: true }
  );

  // Fusion autocompletes — keep selected name visible, show all roster on empty
  setupAutocomplete('fuse-a', 'fuse-a-dd',
    q => {
      const rosterPersonas = personaList.filter(p => roster.has(p.name));
      return q ? rosterPersonas.filter(p => p.name.toLowerCase().includes(q)) : rosterPersonas;
    },
    p => { fuseAName = p.name; document.getElementById('fuse-a').value = p.name; updateFusionResult(); },
    { clearOnSelect: false, showOnEmpty: true }
  );
  setupAutocomplete('fuse-b', 'fuse-b-dd',
    q => {
      const rosterPersonas = personaList.filter(p => roster.has(p.name));
      return q ? rosterPersonas.filter(p => p.name.toLowerCase().includes(q)) : rosterPersonas;
    },
    p => { fuseBName = p.name; document.getElementById('fuse-b').value = p.name; updateFusionResult(); },
    { clearOnSelect: false, showOnEmpty: true }
  );

  // All fusions sorting
  document.querySelectorAll('.fusion-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (allFusionsSortKey === key) allFusionsSortDir *= -1;
      else { allFusionsSortKey = key; allFusionsSortDir = 1; }
      renderAllFusions();
    });
  });

  // All fusions filters
  document.getElementById('filter-new-only').addEventListener('change', renderAllFusions);
  document.getElementById('filter-arcana-fusion').addEventListener('change', renderAllFusions);

  // Compendium sorting
  document.querySelectorAll('.comp-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (compSortKey === key) compSortDir *= -1;
      else { compSortKey = key; compSortDir = 1; }
      renderCompendium();
    });
  });

  // Compendium filters
  ['comp-arcana','comp-lvl-min','comp-lvl-max','comp-search','comp-elem-filter','comp-resist-type'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderCompendium);
    document.getElementById(id).addEventListener('change', renderCompendium);
  });

  // Render initial state
  renderRoster();
  renderCompendium();
  renderSpecialFusions();
}
