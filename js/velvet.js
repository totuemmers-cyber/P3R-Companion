(() => {
const V_RESIST_ELEMS = ['sla', 'str', 'pie', 'fir', 'ice', 'ele', 'win', 'lig', 'dar', 'alm'];
const V_RESIST_LABELS = { w: 'WK', s: 'RS', n: 'NU', r: 'RP', d: 'AB', '-': '—' };
const RESIST_CLASS = { w: 'resist-w', s: 'resist-s', n: 'resist-n', r: 'resist-r', d: 'resist-d', '-': 'resist-x' };
const STAT_NAMES = ['St', 'Ma', 'En', 'Ag', 'Lu'];
const STAT_COLORS = ['#ff5722', '#7c4dff', '#2196f3', '#4caf50', '#ffc107'];
const MAX_PLANNER_DEPTH = 6;
const MAX_PLANNER_RECIPES = 12;
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
const ATTACK_ELEMS = ['fir', 'ice', 'ele', 'win', 'lig', 'dar', 'sla', 'str', 'pie', 'alm'];

const specialPersonas = new Set(Object.keys(SPECIAL_RECIPES));
const personaList = Object.entries(PERSONAS)
  .map(([name, data]) => ({ name, ...data }))
  .sort((a, b) => a.lvl - b.lvl);
const resultsByArcana = {};
const ingredientsByArcana = {};
personaList.forEach((persona) => {
  if (!ingredientsByArcana[persona.race]) {
    ingredientsByArcana[persona.race] = [];
  }
  ingredientsByArcana[persona.race].push(persona);
  if (!specialPersonas.has(persona.name)) {
    if (!resultsByArcana[persona.race]) {
      resultsByArcana[persona.race] = [];
    }
    resultsByArcana[persona.race].push(persona);
  }
});

let velvetRoot;
let velvetStore;
let initialized = false;
let storeRenderQueued = false;
let fuseAName = null;
let fuseBName = null;
let allFusions = [];
let allFusionsSortKey = 'score';
let allFusionsSortDir = -1;
let compSortKey = 'lvl';
let compSortDir = 1;
let selectedPersona = null;
let cachedCoverage = null;
let cachedDefense = null;
let plannerTargetName = null;
const reverseLookupCache = new Map();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getRosterSet() {
  return new Set(velvetStore.getState().roster);
}

function getRosterArray() {
  return velvetStore.getState().roster.filter((name) => PERSONAS[name]);
}

function getCurrentPlayerLevel() {
  return velvetStore?.getState()?.profile?.playerLevel || 1;
}

function getActiveSocialLinks() {
  const { ranks } = velvetStore.getState().socialLinks;
  return Object.entries(ranks)
    .filter(
      ([arcana, rank]) =>
        rank > 0 && rank < 10 && SOCIAL_LINKS[arcana] && !SOCIAL_LINKS[arcana].automatic
    )
    .map(([arcana, rank]) => ({
      arcana,
      rank,
      character: SOCIAL_LINKS[arcana].character
    }));
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function getResultArcana(a1, a2) {
  if (a1 === a2) {
    return a1;
  }
  return (ARCANA_CHART[a1] && ARCANA_CHART[a1][a2]) || null;
}

function checkSpecialRecipe(names) {
  const nameSet = new Set(names);
  for (const [result, ingredients] of Object.entries(SPECIAL_RECIPES)) {
    if (ingredients.length === names.length && ingredients.every((ingredient) => nameSet.has(ingredient))) {
      return result;
    }
  }
  return null;
}

function fuseSameArcana(p1, p2) {
  const candidates = (resultsByArcana[p1.race] || []).filter(
    (candidate) => candidate.lvl !== p1.lvl && candidate.lvl !== p2.lvl
  );
  if (!candidates.length) {
    return null;
  }
  const sumLvl = p1.lvl + p2.lvl;
  let index = -1;
  for (let cursor = candidates.length - 1; cursor >= 0; cursor -= 1) {
    if (sumLvl + 2 >= 2 * candidates[cursor].lvl) {
      index = cursor;
      break;
    }
  }
  if (index < 0) {
    return null;
  }
  if (candidates[index].lvl === p2.lvl) {
    index -= 1;
  }
  return index >= 0 ? candidates[index] : null;
}

function fuseDyad(p1, p2) {
  const special = checkSpecialRecipe([p1.name, p2.name]);
  if (special) {
    return { name: special, ...PERSONAS[special], special: true };
  }
  if (p1.race === p2.race) {
    return fuseSameArcana(p1, p2);
  }
  const resultArcana = getResultArcana(p1.race, p2.race);
  if (!resultArcana) {
    return null;
  }
  const candidates = resultsByArcana[resultArcana];
  if (!candidates || !candidates.length) {
    return null;
  }
  const sumLvl = p1.lvl + p2.lvl;
  let index = 0;
  for (let cursor = 0; cursor < candidates.length; cursor += 1) {
    if (sumLvl >= 2 * candidates[cursor].lvl) {
      index = cursor + 1;
    }
  }
  if (index >= candidates.length) {
    index = candidates.length - 1;
  }
  if (candidates[index].name === p1.name || candidates[index].name === p2.name) {
    index += 1;
  }
  return index < candidates.length ? candidates[index] : null;
}

function reverseLookup(targetName) {
  if (reverseLookupCache.has(targetName)) {
    return reverseLookupCache.get(targetName);
  }
  const target = PERSONAS[targetName];
  if (!target) {
    return [];
  }
  if (SPECIAL_RECIPES[targetName]) {
    const specialResults = [{ type: 'special', ingredients: SPECIAL_RECIPES[targetName] }];
    reverseLookupCache.set(targetName, specialResults);
    return specialResults;
  }
  const results = [];
  const seen = new Set();
  for (let i = 0; i < ARCANA_LIST.length; i += 1) {
    for (let j = i; j < ARCANA_LIST.length; j += 1) {
      const a1 = ARCANA_LIST[i];
      const a2 = ARCANA_LIST[j];
      const resultArcana = a1 === a2 ? a1 : getResultArcana(a1, a2);
      if (resultArcana !== target.race) {
        continue;
      }
      const list1 = ingredientsByArcana[a1] || [];
      const list2 = a1 === a2 ? list1 : ingredientsByArcana[a2] || [];
      for (const p1 of list1) {
        for (const p2 of list2) {
          if (p1.name === p2.name) {
            continue;
          }
          if (a1 === a2 && p1.lvl >= p2.lvl) {
            continue;
          }
          const result = fuseDyad(p1, p2);
          if (result && result.name === targetName) {
            const key = `${p1.name}|${p2.name}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({ type: 'normal', p1: p1.name, p2: p2.name });
            }
          }
        }
      }
    }
  }
  reverseLookupCache.set(targetName, results);
  return results;
}

function compareSolvablePlans(left, right) {
  if (left.directOwnedCount !== right.directOwnedCount) {
    return right.directOwnedCount - left.directOwnedCount;
  }
  if (left.stepCount !== right.stepCount) {
    return left.stepCount - right.stepCount;
  }
  if (left.missing.length !== right.missing.length) {
    return left.missing.length - right.missing.length;
  }
  if (left.maxDepth !== right.maxDepth) {
    return left.maxDepth - right.maxDepth;
  }
  if (left.ingredientLevelSum !== right.ingredientLevelSum) {
    return left.ingredientLevelSum - right.ingredientLevelSum;
  }
  return left.recipeKey.localeCompare(right.recipeKey);
}

function compareBlockedPlans(left, right) {
  if (left.directOwnedCount !== right.directOwnedCount) {
    return right.directOwnedCount - left.directOwnedCount;
  }
  if (left.blockers.length !== right.blockers.length) {
    return left.blockers.length - right.blockers.length;
  }
  if (left.ingredientLevelSum !== right.ingredientLevelSum) {
    return left.ingredientLevelSum - right.ingredientLevelSum;
  }
  return left.recipeKey.localeCompare(right.recipeKey);
}

function getRecipeCandidates(targetName, roster) {
  const recipes = reverseLookup(targetName).map((entry) => {
    if (entry.type === 'special') {
      return {
        type: 'special',
        ingredients: [...entry.ingredients]
      };
    }
    return {
      type: 'fuse',
      ingredients: [entry.p1, entry.p2]
    };
  });
  return recipes
    .map((recipe) => ({
      ...recipe,
      directOwnedCount: recipe.ingredients.filter((ingredient) => roster.has(ingredient)).length,
      ingredientLevelSum: recipe.ingredients.reduce(
        (sum, ingredient) => sum + (PERSONAS[ingredient]?.lvl || 99),
        0
      )
    }))
    .sort((left, right) => {
      if (left.directOwnedCount !== right.directOwnedCount) {
        return right.directOwnedCount - left.directOwnedCount;
      }
      if (left.ingredientLevelSum !== right.ingredientLevelSum) {
        return left.ingredientLevelSum - right.ingredientLevelSum;
      }
      return left.ingredients.join('|').localeCompare(right.ingredients.join('|'));
    })
    .slice(0, MAX_PLANNER_RECIPES);
}

function buildPlanNode(targetName, roster, memo, depth = 0, trail = new Set()) {
  if (!PERSONAS[targetName]) {
    return {
      status: 'blocked',
      name: targetName,
      blockers: [targetName],
      hintIngredients: [],
      directOwnedCount: 0,
      ingredientLevelSum: 999,
      recipeKey: targetName
    };
  }

  if (roster.has(targetName)) {
    return {
      status: 'owned',
      name: targetName,
      path: [],
      missing: [],
      blockers: [],
      stepCount: 0,
      maxDepth: 0
    };
  }

  if (trail.has(targetName) || depth > MAX_PLANNER_DEPTH) {
    return {
      status: 'blocked',
      name: targetName,
      blockers: [targetName],
      hintIngredients: [],
      directOwnedCount: 0,
      ingredientLevelSum: 999,
      recipeKey: targetName
    };
  }

  const memoKey = `${targetName}|${depth}`;
  if (memo.has(memoKey)) {
    return memo.get(memoKey);
  }

  const recipes = getRecipeCandidates(targetName, roster);
  if (!recipes.length) {
    const noRecipeNode = {
      status: 'blocked',
      name: targetName,
      blockers: [targetName],
      hintIngredients: [],
      directOwnedCount: 0,
      ingredientLevelSum: 999,
      recipeKey: targetName
    };
    memo.set(memoKey, noRecipeNode);
    return noRecipeNode;
  }

  const nextTrail = new Set(trail);
  nextTrail.add(targetName);
  const solvableCandidates = [];
  const blockedCandidates = [];

  recipes.forEach((recipe) => {
    const childNodes = recipe.ingredients.map((ingredient) =>
      buildPlanNode(ingredient, roster, memo, depth + 1, nextTrail)
    );
    const directOwnedCount = childNodes.filter((child) => child.status === 'owned').length;
    const ingredientLevelSum = recipe.ingredients.reduce(
      (sum, ingredient) => sum + (PERSONAS[ingredient]?.lvl || 99),
      0
    );
    const recipeKey = recipe.ingredients.join('|');

    if (childNodes.every((child) => child.status !== 'blocked')) {
      const path = childNodes.flatMap((child) => child.path).concat({
        type: recipe.type,
        result: targetName,
        ingredients: [...recipe.ingredients],
        level: PERSONAS[targetName]?.lvl || 0,
        arcana: PERSONAS[targetName]?.race || ''
      });
      const missing = uniqueValues(
        childNodes.flatMap((child) => {
          if (child.status === 'owned') {
            return [];
          }
          return [child.name, ...child.missing];
        })
      ).filter((name) => name !== targetName);

      solvableCandidates.push({
        status: 'solvable',
        name: targetName,
        path,
        missing,
        blockers: [],
        stepCount: path.length,
        maxDepth: Math.max(0, ...childNodes.map((child) => child.maxDepth || 0)) + 1,
        directOwnedCount,
        ingredientLevelSum,
        recipeKey
      });
      return;
    }

    blockedCandidates.push({
      status: 'blocked',
      name: targetName,
      blockers: uniqueValues(
        childNodes.flatMap((child) => (child.blockers?.length ? child.blockers : [child.name]))
      ),
      hintIngredients: [...recipe.ingredients],
      directOwnedCount,
      ingredientLevelSum,
      recipeKey
    });
  });

  if (solvableCandidates.length) {
    const bestSolvable = solvableCandidates.sort(compareSolvablePlans)[0];
    memo.set(memoKey, bestSolvable);
    return bestSolvable;
  }
  const bestBlocked = blockedCandidates.sort(compareBlockedPlans)[0];
  memo.set(memoKey, bestBlocked);
  return bestBlocked;
}

function buildFusionPlanner(targetName) {
  const roster = getRosterSet();
  const memo = new Map();
  if (roster.has(targetName)) {
    return {
      status: 'owned',
      target: targetName,
      path: [],
      nextActions: [],
      neededFirst: [],
      blockers: []
    };
  }

  const node = buildPlanNode(targetName, roster, memo);
  if (node.status === 'blocked') {
    return {
      status: 'blocked',
      target: targetName,
      path: [],
      nextActions: [],
      neededFirst: [],
      blockers: node.blockers || [targetName],
      hintIngredients: node.hintIngredients || []
    };
  }

  const currentLevel = getCurrentPlayerLevel();
  const nextActions = node.path.filter(
    (step) => step.ingredients.every((ingredient) => roster.has(ingredient)) && (step.level || 0) <= currentLevel
  );
  const neededFirst = uniqueValues(
    node.path
      .map((step) => step.result)
      .filter((name) => name !== targetName && !roster.has(name))
  );

  return {
    status: 'solvable',
    target: targetName,
    path: node.path,
    nextActions,
    neededFirst,
    blockers: [],
    stepCount: node.stepCount,
    maxDepth: node.maxDepth
  };
}

function renderPlannerAction(step, label) {
  const resultLevel = PERSONAS[step.result]?.lvl || 0;
  if (resultLevel > getCurrentPlayerLevel()) {
    return `<span class="chain-badge-special">Locked Lv${resultLevel}</span>`;
  }
  if (step.type !== 'fuse') {
    return '<span class="chain-badge-special">Special Fusion</span>';
  }
  return `<button class="btn btn-sm" data-action="populate-fusion" data-a="${escapeHtml(step.ingredients[0])}" data-b="${escapeHtml(step.ingredients[1])}">${label}</button>`;
}

function renderPlannerPath(path, targetName) {
  const initialRoster = getRosterSet();
  const available = new Set(initialRoster);
  const currentLevel = getCurrentPlayerLevel();
  return `<div class="chain-steps">${path
    .map((step, index) => {
      const readyNow = step.ingredients.every((ingredient) => initialRoster.has(ingredient)) && (step.level || 0) <= currentLevel;
      const ingredientHtml = step.ingredients
        .map((ingredient) => {
          let stateClass = 'planner-missing';
          if (initialRoster.has(ingredient)) {
            stateClass = 'have';
          } else if (available.has(ingredient)) {
            stateClass = 'fused';
          }
          return `<span class="chain-ing ${stateClass}">${ingredient}</span>`;
        })
        .join(' + ');
      available.add(step.result);
      return `<div class="chain-step ${readyNow ? 'planner-step-ready' : ''}"><span class="chain-num">${index + 1}</span><span class="chain-ings">${ingredientHtml}</span><span class="chain-arrow">&rarr;</span><span class="chain-result${step.result === targetName ? ' chain-target' : ''}">${step.result}</span><span class="chain-meta">Lv${step.level || '?'} ${step.arcana || ''}</span><span class="planner-step-action">${renderPlannerAction(step, readyNow ? 'Fuse Now' : 'Load Recipe')}</span></div>`;
    })
    .join('')}</div>`;
}

function renderPlanner(plan) {
  const target = PERSONAS[plan.target];
  const targetMeta = `<span class="r-arcana-badge">${target?.race || ''}</span><span class="r-lvl-badge">Lv ${target?.lvl || '?'}</span>`;
  const targetInsight = target ? `<div class="planner-target-insight">${renderPersonaInsightMarkup(plan.target)}</div>` : '';

  if (plan.status === 'owned') {
    return `<div class="planner-shell"><div class="planner-summary planner-summary-owned"><div class="planner-summary-main"><span class="planner-status planner-status-owned">Owned</span><span class="planner-target">${plan.target}</span>${targetMeta}</div><p>This persona is already in your roster.</p></div>${targetInsight}</div>`;
  }

  if (plan.status === 'blocked') {
    const blockers = plan.blockers.length
      ? plan.blockers.map((name) => `<span class="planner-pill planner-pill-blocked">${name}</span>`).join('')
      : `<span class="planner-empty">No reachable blocker identified.</span>`;
    const closestRecipe = plan.hintIngredients?.length
      ? `<div class="planner-section"><h4>Closest Recipe</h4><div class="planner-pill-row">${plan.hintIngredients.map((name) => `<span class="planner-pill">${name}</span>`).join('')}<span class="chain-arrow">&rarr;</span><span class="planner-pill planner-pill-target">${plan.target}</span></div></div>`
      : '';
    return `<div class="planner-shell"><div class="planner-summary planner-summary-blocked"><div class="planner-summary-main"><span class="planner-status planner-status-blocked">Blocked</span><span class="planner-target">${plan.target}</span>${targetMeta}</div><p>No full fusion path could be derived from your current roster.</p></div>${targetInsight}<div class="planner-section"><h4>Blocked By</h4><div class="planner-pill-row">${blockers}</div></div>${closestRecipe}</div>`;
  }

  const nextActions = plan.nextActions.length
    ? plan.nextActions
        .map(
          (step) =>
            `<div class="planner-action-card"><div><div class="planner-action-name">${step.result}</div><div class="planner-action-from">${step.ingredients.join(' + ')}</div></div>${renderPlannerAction(step, step.type === 'special' ? 'Special Fusion' : 'Fuse Now')}</div>`
        )
        .join('')
    : `<div class="planner-empty">No step is immediately fuseable from the current roster.</div>`;
  const neededFirst = plan.neededFirst.length
    ? plan.neededFirst.map((name) => `<span class="planner-pill">${name}</span>`).join('')
    : `<span class="planner-empty">No intermediate personas needed.</span>`;

  return `<div class="planner-shell"><div class="planner-summary"><div class="planner-summary-main"><span class="planner-status planner-status-solvable">Solvable</span><span class="planner-target">${plan.target}</span>${targetMeta}</div><p>Best path found with ${plan.stepCount} step${plan.stepCount === 1 ? '' : 's'}.</p></div>${targetInsight}<div class="planner-grid"><div class="planner-section"><h4>Next Action</h4><div class="planner-action-list">${nextActions}</div></div><div class="planner-section"><h4>Needed First</h4><div class="planner-pill-row">${neededFirst}</div></div></div><div class="planner-section"><h4>Best Path</h4>${renderPlannerPath(plan.path, plan.target)}</div></div>`;
}

function addToRoster(name) {
  velvetStore.dispatch({ type: 'ROSTER_ADD', payload: name });
}

function removeFromRoster(name) {
  velvetStore.dispatch({ type: 'ROSTER_REMOVE', payload: name });
}

function clearRoster() {
  if (confirm('Clear your entire persona roster? This cannot be undone.')) {
    velvetStore.dispatch({ type: 'ROSTER_CLEAR' });
  }
}

function setupAutocomplete(inputId, dropdownId, getItems, onSelect, options = {}) {
  const input = velvetRoot.querySelector(`#${inputId}`);
  const dropdown = velvetRoot.querySelector(`#${dropdownId}`);
  const clearOnSelect = options.clearOnSelect !== false;
  const showOnEmpty = options.showOnEmpty || false;
  let items = [];
  let highlighted = -1;
  let selecting = false;

  function selectItem(item) {
    selecting = true;
    onSelect(item);
    if (clearOnSelect) {
      input.value = '';
    }
    dropdown.classList.remove('open');
    setTimeout(() => {
      selecting = false;
    }, 50);
  }

  function update() {
    if (selecting) {
      return;
    }
    const query = input.value.toLowerCase().trim();
    if (!query && !showOnEmpty) {
      dropdown.classList.remove('open');
      return;
    }
    items = getItems(query).slice(0, 20);
    highlighted = -1;
    if (!items.length) {
      dropdown.classList.remove('open');
      return;
    }
    dropdown.innerHTML = items
      .map(
        (persona, index) =>
          `<div class="ac-item" data-idx="${index}"><span>${persona.name}</span><span><span class="ac-arcana">${persona.race}</span> <span class="ac-lvl">Lv${persona.lvl}</span></span></div>`
      )
      .join('');
    dropdown.classList.add('open');
    dropdown.querySelectorAll('.ac-item').forEach((itemEl) => {
      itemEl.addEventListener('mousedown', (event) => {
        event.preventDefault();
        selectItem(items[Number(itemEl.dataset.idx)]);
      });
    });
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', () => {
    if (!selecting) {
      update();
    }
  });
  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('open'), 200));
  input.addEventListener('keydown', (event) => {
    if (!dropdown.classList.contains('open')) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlighted = Math.min(highlighted + 1, items.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlighted = Math.max(highlighted - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (highlighted >= 0 && highlighted < items.length) {
        selectItem(items[highlighted]);
      } else if (items.length === 1) {
        selectItem(items[0]);
      }
    } else if (event.key === 'Escape') {
      dropdown.classList.remove('open');
    }
    dropdown.querySelectorAll('.ac-item').forEach((itemEl, index) => {
      itemEl.classList.toggle('highlighted', index === highlighted);
    });
  });
}

function renderResists(resists) {
  return V_RESIST_ELEMS.map((elem, index) => {
    const code = resists[index] || '-';
    return `<span class="resist-badge ${RESIST_CLASS[code] || 'resist-x'}"><span class="r-elem">${elem}</span>${V_RESIST_LABELS[code] || '—'}</span>`;
  }).join('');
}

function renderStats(stats) {
  return stats
    .map((value, index) => {
      const pct = Math.round((value / 99) * 100);
      return `<div class="stat-item"><div class="stat-label">${STAT_NAMES[index]}</div><div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%;background:${STAT_COLORS[index]}"></div></div><div class="stat-val">${value}</div></div>`;
    })
    .join('');
}

function renderSkills(skills) {
  return Object.entries(skills)
    .sort((a, b) => a[1] - b[1])
    .map(([name, lvl]) => {
      const skill = SKILLS[name];
      const parts = skill ? [ELEM_NAMES[skill.elem] || skill.elem, skill.target] : [];
      if (skill?.cost) {
        parts.push(`Cost ${skill.cost}`);
      }
      if (skill?.power) {
        parts.push(`Pow ${skill.power}`);
      }
      if (skill?.effect) {
        parts.push(skill.effect);
      }
      const lvlText = lvl === 0 ? '<span class="s-innate">innate</span>' : lvl === -1 ? '<span class="s-lvl">heart</span>' : `<span class="s-lvl">Lv${lvl}</span>`;
      return `<span class="skill-tag"${parts.length ? ` data-tooltip="${parts.join(' | ')}"` : ''}><span class="s-elem ${skill ? `elem-${skill.elem}` : ''}"></span><span class="s-name">${name}</span>${lvlText}</span>`;
    })
    .join('');
}

function getInheritLabel(name) {
  const inherit = PERSONAS[name]?.inherits;
  return inherit && INHERIT_MAP[inherit] ? INHERIT_MAP[inherit].label : '';
}

function getTransferableSkills(aName, bName, resultName) {
  const result = PERSONAS[resultName];
  const info = result?.inherits ? INHERIT_MAP[result.inherits] : null;
  if (!info) {
    return { canInherit: [], blocked: [] };
  }
  const blocked = new Set(info.blocked);
  const resultSkills = new Set(Object.keys(result.skills));
  const canInherit = [];
  const blockedList = [];
  const seen = new Set();
  [aName, bName].forEach((name) => {
    const persona = PERSONAS[name];
    if (!persona) {
      return;
    }
    Object.keys(persona.skills).forEach((skillName) => {
      const skill = SKILLS[skillName];
      if (!skill || seen.has(skillName) || resultSkills.has(skillName)) {
        return;
      }
      seen.add(skillName);
      if (blocked.has(skill.elem)) {
        blockedList.push(skillName);
      } else {
        canInherit.push(skillName);
      }
    });
  });
  return { canInherit, blocked: blockedList };
}

function renderPersonaCard(name) {
  const persona = PERSONAS[name];
  if (!persona) {
    return '<div class="invalid-msg">Unknown persona</div>';
  }
  const inheritLabel = getInheritLabel(name);
  return `<div class="result-card"><div class="r-header"><span class="r-name">${name}</span><span class="r-arcana-badge">${persona.race}</span><span class="r-lvl-badge">Lv ${persona.lvl}</span>${inheritLabel ? `<span class="inherit-badge">Inherits: ${inheritLabel}</span>` : ''}</div><div class="stats-grid">${renderStats(
    persona.stats
  )}</div><div class="resists-row">${renderResists(persona.resists)}</div><div class="skills-list">${renderSkills(
    persona.skills
  )}</div></div>`;
}

function getPersonaExtra(name) {
  if (typeof PERSONA_EXTRAS === 'undefined') {
    return null;
  }
  return PERSONA_EXTRAS[name] || null;
}

function derivePersonaSource(name) {
  const extra = getPersonaExtra(name);
  if (extra?.source) {
    return extra.source;
  }
  if (SPECIAL_RECIPES[name]) {
    return `Special fusion (${SPECIAL_RECIPES[name].length} ingredients)`;
  }
  return 'Standard fusion';
}

function derivePersonaRole(persona, name) {
  const extra = getPersonaExtra(name);
  if (extra?.role) {
    return extra.role;
  }
  const skillNames = Object.keys(persona.skills || {});
  const elems = skillNames.map((skillName) => SKILLS[skillName]?.elem).filter(Boolean);
  const attackElems = elems.filter((elem) => ATTACK_ELEMS.includes(elem));
  const physicalCount = attackElems.filter((elem) => ['sla', 'str', 'pie'].includes(elem)).length;
  const magicCount = attackElems.filter((elem) => ['fir', 'ice', 'ele', 'win', 'lig', 'dar', 'alm'].includes(elem)).length;
  const supportCount = elems.filter((elem) => elem === 'sup').length;
  const recoveryCount = elems.filter((elem) => elem === 'rec').length;
  const ailmentCount = elems.filter((elem) => elem === 'ail').length;
  if (recoveryCount >= 2) {
    return 'Recovery support';
  }
  if (supportCount >= 2) {
    return 'Buff / utility support';
  }
  if (physicalCount >= 2 && persona.stats[0] >= persona.stats[1]) {
    return 'Physical attacker';
  }
  if (magicCount >= 2 && persona.stats[1] >= persona.stats[0]) {
    return 'Magic attacker';
  }
  if (ailmentCount >= 2) {
    return 'Ailment specialist';
  }
  return 'Flexible coverage piece';
}

function derivePersonaHighlights(persona, name) {
  const highlights = [];
  const skillNames = Object.keys(persona.skills || {});
  const highPowerSkills = skillNames.filter((skillName) => (SKILLS[skillName]?.power || 0) >= 300);
  const supportSkills = skillNames.filter((skillName) => ['sup', 'rec'].includes(SKILLS[skillName]?.elem));
  const defensiveResists = V_RESIST_ELEMS.filter((_, index) => 'snrd'.includes(persona.resists[index] || '-'));

  if (highPowerSkills.length > 0) {
    highlights.push(`Power spike skill: ${highPowerSkills[0]}`);
  }
  if (supportSkills.length > 0) {
    highlights.push(`Utility pick: ${supportSkills.slice(0, 2).join(', ')}`);
  }
  if (defensiveResists.length >= 3) {
    highlights.push(`Strong defenses against ${defensiveResists.slice(0, 3).map((elem) => ELEM_NAMES[elem] || elem).join(', ')}`);
  }
  const activeLink = getActiveSocialLinks().find((entry) => entry.arcana === persona.race);
  if (activeLink) {
    highlights.push(`Supports active ${persona.race} social link (${activeLink.character})`);
  }
  const extra = getPersonaExtra(name);
  (extra?.highlights || []).forEach((note) => {
    if (!highlights.includes(note)) {
      highlights.push(note);
    }
  });
  return highlights.slice(0, 4);
}

function renderPersonaInsightMarkup(name) {
  const persona = PERSONAS[name];
  if (!persona) {
    return '';
  }
  const source = derivePersonaSource(name);
  const role = derivePersonaRole(persona, name);
  const highlights = derivePersonaHighlights(persona, name);
  return `<div class="persona-insight-panel"><div class="persona-insight-top"><div class="persona-insight-card"><span class="persona-insight-label">Source</span><span class="persona-insight-value">${escapeHtml(
    source
  )}</span></div><div class="persona-insight-card"><span class="persona-insight-label">Role</span><span class="persona-insight-value">${escapeHtml(
    role
  )}</span></div></div><div class="persona-insight-notes"><h4>Why it matters</h4>${highlights.length ? highlights
    .map((note) => `<div class="persona-insight-note">${escapeHtml(note)}</div>`)
    .join('') : '<div class="persona-insight-note">No special note recorded yet.</div>'}</div></div>`;
}

function renderCompendiumSummary() {
  const summary = velvetRoot.querySelector('#comp-summary');
  if (!summary) {
    return;
  }
  const roster = getRosterSet();
  const ownedCount = roster.size;
  const specialReady = Object.values(SPECIAL_RECIPES).filter((ingredients) => ingredients.every((ingredient) => roster.has(ingredient))).length;
  const activeLinks = getActiveSocialLinks();
  const missingArcanaCoverage = activeLinks.filter(
    (entry) => ![...roster].some((name) => PERSONAS[name]?.race === entry.arcana)
  ).length;

  summary.innerHTML = `<div class="comp-summary-pill"><span class="comp-summary-label">Roster</span><span class="comp-summary-value">${ownedCount}/${personaList.length}</span></div><div class="comp-summary-pill"><span class="comp-summary-label">Special fusions ready</span><span class="comp-summary-value">${specialReady}/${Object.keys(
    SPECIAL_RECIPES
  ).length}</span></div><div class="comp-summary-pill"><span class="comp-summary-label">Active arcana gaps</span><span class="comp-summary-value">${missingArcanaCoverage}</span></div>`;
}

function analyzeAttackCoverage() {
  const coverage = {};
  ATTACK_ELEMS.forEach((elem) => {
    coverage[elem] = { count: 0, bestSkill: null, bestPow: 0 };
  });
  getRosterArray().forEach((name) => {
    const persona = PERSONAS[name];
    Object.keys(persona.skills).forEach((skillName) => {
      const skill = SKILLS[skillName];
      if (!skill || !coverage[skill.elem]) {
        return;
      }
      coverage[skill.elem].count += 1;
      if ((skill.power || 0) > coverage[skill.elem].bestPow) {
        coverage[skill.elem].bestPow = skill.power || 0;
        coverage[skill.elem].bestSkill = skillName;
      }
    });
  });
  return coverage;
}

function analyzeDefensiveGaps() {
  const defense = {};
  V_RESIST_ELEMS.forEach((elem) => {
    defense[elem] = { weak: 0, resist: 0 };
  });
  getRosterArray().forEach((name) => {
    const persona = PERSONAS[name];
    V_RESIST_ELEMS.forEach((elem, index) => {
      const code = persona.resists[index] || '-';
      if (code === 'w') {
        defense[elem].weak += 1;
      }
      if ('snrd'.includes(code)) {
        defense[elem].resist += 1;
      }
    });
  });
  return defense;
}

function renderRosterAnalysis() {
  const card = velvetRoot.querySelector('#roster-analysis-card');
  const roster = getRosterSet();
  if (!roster.size) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  const coverage = analyzeAttackCoverage();
  const defense = analyzeDefensiveGaps();
  const activeLinks = getActiveSocialLinks();
  let html = '<div class="analysis-section"><h4>Attack Coverage</h4><div class="elem-badges">';
  ATTACK_ELEMS.forEach((elem) => {
    const entry = coverage[elem];
    html += `<div class="elem-badge ${entry.count === 0 ? 'gap-elem' : 'covered-elem'}"><span class="eb-label">${ELEM_NAMES[elem] || elem}</span><span class="eb-count">${entry.count === 0 ? 'GAP' : entry.count}</span>${entry.bestSkill ? `<span class="eb-skill">${entry.bestSkill}</span>` : ''}</div>`;
  });
  html += '</div></div><div class="analysis-section"><h4>Defensive Weaknesses</h4><div class="elem-badges">';
  V_RESIST_ELEMS.forEach((elem) => {
    const entry = defense[elem];
    const danger = entry.weak > 0 && entry.resist === 0;
    const cssClass = danger ? 'danger-weak' : entry.resist > 0 ? 'safe-elem' : '';
    html += `<div class="elem-badge ${cssClass}"><span class="eb-label">${ELEM_NAMES[elem] || elem}</span><span class="eb-count" style="color:${entry.weak > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${entry.weak}W</span><span class="eb-skill" style="color:${entry.resist > 0 ? 'var(--success)' : 'var(--text-muted)'}">${entry.resist}R</span></div>`;
  });
  html += '</div></div>';
  if (activeLinks.length) {
    html += '<div class="analysis-section"><h4>Social Link Coverage</h4><div class="sl-coverage-grid">';
    activeLinks.forEach((link) => {
      const personaName = [...roster].find((name) => PERSONAS[name]?.race === link.arcana);
      html += `<div class="sl-cov-item ${personaName ? 'sl-cov-ok' : 'sl-cov-gap'}"><span class="sl-cov-arcana">${link.arcana}</span><span class="sl-cov-char">${link.character} Rk${link.rank}</span>${personaName ? `<span class="sl-cov-persona">${personaName}</span>` : `<span class="sl-cov-missing">Fuse a ${link.arcana} persona</span>`}</div>`;
    });
    html += '</div></div>';
  }
  velvetRoot.querySelector('#roster-analysis').innerHTML = html;
}

function refreshAnalysisCache() {
  cachedCoverage = analyzeAttackCoverage();
  cachedDefense = analyzeDefensiveGaps();
}

function analyzeLostCoverage(fusion) {
  const result = PERSONAS[fusion.result];
  const a = PERSONAS[fusion.a];
  const b = PERSONAS[fusion.b];
  if (!result || !a || !b || !cachedCoverage || !cachedDefense) {
    return { lostResists: [], lostAttacks: [], resummon: {} };
  }
  const lostResists = [];
  V_RESIST_ELEMS.forEach((elem, index) => {
    let count = cachedDefense[elem].resist;
    if ('snrd'.includes(a.resists[index] || '-')) {
      count -= 1;
    }
    if ('snrd'.includes(b.resists[index] || '-')) {
      count -= 1;
    }
    if ('snrd'.includes(result.resists[index] || '-')) {
      count += 1;
    }
    if (count <= 0 && cachedDefense[elem].resist > 0) {
      const sources = [];
      if ('snrd'.includes(a.resists[index] || '-')) {
        sources.push(fusion.a);
      }
      if ('snrd'.includes(b.resists[index] || '-')) {
        sources.push(fusion.b);
      }
      lostResists.push({ elemName: ELEM_NAMES[elem] || elem, sources });
    }
  });
  const ingElemsByPersona = { [fusion.a]: {}, [fusion.b]: {} };
  ATTACK_ELEMS.forEach((elem) => {
    ingElemsByPersona[fusion.a][elem] = 0;
    ingElemsByPersona[fusion.b][elem] = 0;
  });
  [[fusion.a, a], [fusion.b, b]].forEach(([name, persona]) => {
    Object.keys(persona.skills).forEach((skillName) => {
      const skill = SKILLS[skillName];
      if (skill && ingElemsByPersona[name][skill.elem] !== undefined) {
        ingElemsByPersona[name][skill.elem] += 1;
      }
    });
  });
  const lostAttacks = [];
  ATTACK_ELEMS.forEach((elem) => {
    const ingredientTotal = ingElemsByPersona[fusion.a][elem] + ingElemsByPersona[fusion.b][elem];
    let resultTotal = 0;
    Object.keys(result.skills).forEach((skillName) => {
      const skill = SKILLS[skillName];
      if (skill?.elem === elem) {
        resultTotal += 1;
      }
    });
    const after = cachedCoverage[elem].count - ingredientTotal + resultTotal;
    if (after <= 0 && cachedCoverage[elem].count > 0) {
      const sources = [];
      if (ingElemsByPersona[fusion.a][elem] > 0) {
        sources.push(fusion.a);
      }
      if (ingElemsByPersona[fusion.b][elem] > 0) {
        sources.push(fusion.b);
      }
      lostAttacks.push({ elemName: ELEM_NAMES[elem] || elem, sources });
    }
  });
  const resummon = {};
  [...lostResists, ...lostAttacks].forEach((entry) => {
    entry.sources.forEach((name) => {
      if (!resummon[name]) {
        resummon[name] = [];
      }
      resummon[name].push(entry.elemName + (lostResists.includes(entry) ? ' resist' : ' attack'));
    });
  });
  return { lostResists, lostAttacks, resummon };
}

function scoreFusion(fusion) {
  const result = PERSONAS[fusion.result];
  const a = PERSONAS[fusion.a];
  const b = PERSONAS[fusion.b];
  if (!result) {
    return 0;
  }
  let score = fusion.isNew ? 10 : 0;
  Object.keys(result.skills).forEach((skillName) => {
    const skill = SKILLS[skillName];
    if (skill && ATTACK_ELEMS.includes(skill.elem) && cachedCoverage?.[skill.elem]?.count === 0) {
      score += 15;
    }
  });
  V_RESIST_ELEMS.forEach((elem, index) => {
    const code = result.resists[index] || '-';
    if ('nrd'.includes(code) && cachedDefense?.[elem]?.weak > 0) {
      score += 5;
    }
    if (code === 'w') {
      score -= 3;
    }
  });
  if (a && b) {
    score += Math.min(10, Math.max(0, result.lvl - Math.max(a.lvl, b.lvl)));
  }
  if (Object.keys(result.skills).some((skillName) => SKILLS[skillName]?.elem === 'rec')) {
    score += 3;
  }
  if (Object.keys(result.skills).some((skillName) => (SKILLS[skillName]?.power || 0) >= 400)) {
    score += 3;
  }
  if (
    Object.keys(result.skills).some((skillName) =>
      ['Matarukaja', 'Marakukaja', 'Masukukaja', 'Heat Riser', 'Debilitate', 'Dekunda', 'Dekaja', 'Charge', 'Concentrate'].includes(skillName)
    )
  ) {
    score += 5;
  }
  const transfer = getTransferableSkills(fusion.a, fusion.b, fusion.result);
  if (
    transfer.canInherit.some((skillName) => {
      const skill = SKILLS[skillName];
      return skill && (skill.elem === 'rec' || skill.elem === 'sup' || (skill.power && skill.power >= 200));
    })
  ) {
    score += 4;
  }
  const activeSL = getActiveSocialLinks();
  if (activeSL.some((entry) => entry.arcana === result.race) && !getRosterArray().some((name) => PERSONAS[name].race === result.race)) {
    score += 8;
  }
  return score;
}

function getScoreColor(score) {
  if (score >= 30) {
    return 'color:#ffd54f;background:rgba(255,213,79,0.2)';
  }
  if (score >= 20) {
    return 'color:#fff9c4;background:rgba(255,249,196,0.1)';
  }
  if (score >= 10) {
    return 'color:var(--text-primary);background:rgba(255,255,255,0.06)';
  }
  return 'color:var(--text-muted);background:transparent';
}

function getRecommendationReason(fusion) {
  const result = PERSONAS[fusion.result];
  if (!result) {
    return '';
  }
  const reasons = [];
  Object.keys(result.skills).forEach((skillName) => {
    const skill = SKILLS[skillName];
    if (skill && ATTACK_ELEMS.includes(skill.elem) && cachedCoverage?.[skill.elem]?.count === 0 && !reasons.length) {
      reasons.push(`Fills ${ELEM_NAMES[skill.elem] || skill.elem} gap`);
    }
  });
  V_RESIST_ELEMS.forEach((elem, index) => {
    const code = result.resists[index] || '-';
    if ('nrd'.includes(code) && cachedDefense?.[elem]?.weak > 0) {
      const verb = code === 'n' ? 'Nulls' : code === 'r' ? 'Repels' : 'Drains';
      reasons.push(`${verb} ${ELEM_NAMES[elem] || elem}`);
    }
  });
  ['rec', 'sup'].forEach((elem) => {
    const skillName = Object.keys(result.skills).find((name) => SKILLS[name]?.elem === elem);
    if (skillName) {
      reasons.push(`Brings ${skillName}`);
    }
  });
  Object.entries(analyzeLostCoverage(fusion).resummon).forEach(([name, whys]) => {
    reasons.push(`<span class="rec-warning">Resummon ${name} for ${whys.join(', ')}</span>`);
  });
  return reasons.slice(0, 5).join(', ');
}

function renderRoster() {
  const roster = getRosterArray().sort((a, b) => PERSONAS[a].lvl - PERSONAS[b].lvl);
  const activeLinks = Object.fromEntries(getActiveSocialLinks().map((entry) => [entry.arcana, entry]));
  velvetRoot.querySelector('#roster-grid').innerHTML = roster
    .map((name) => {
      const persona = PERSONAS[name];
      const link = activeLinks[persona.race];
      return `<div class="roster-card"><span class="r-lvl">Lv${persona.lvl}</span><span class="r-name">${name}</span><span class="r-arcana">${persona.race}</span>${link ? `<span class="roster-sl-badge">SL: ${link.character} Rk${link.rank}</span>` : ''}<button class="r-remove" data-action="remove-roster" data-name="${escapeHtml(name)}">×</button></div>`;
    })
    .join('');
  velvetRoot.querySelector('#roster-count').textContent = `${roster.length}/194`;
  renderRosterAnalysis();
}

function renderFusionComparison(resultName, aName, bName) {
  const result = PERSONAS[resultName];
  const a = PERSONAS[aName];
  const b = PERSONAS[bName];
  if (!result || !a || !b) {
    return '';
  }
  const best = a.lvl >= b.lvl ? { persona: a, name: aName } : { persona: b, name: bName };
  const levelDelta = result.lvl - best.persona.lvl;
  const skillUnion = new Set([...Object.keys(a.skills), ...Object.keys(b.skills)]);
  const gained = Object.keys(result.skills).filter((name) => !skillUnion.has(name));
  const lost = [...skillUnion].filter((name) => !Object.prototype.hasOwnProperty.call(result.skills, name));
  return `<div class="comparison-panel"><h4>vs ${best.name} (best ingredient)</h4><div class="comp-section"><h5>Level</h5><div class="delta-row"><span class="delta-badge ${levelDelta > 0 ? 'delta-pos' : levelDelta < 0 ? 'delta-neg' : 'delta-neutral'}">Lv ${levelDelta > 0 ? '+' : ''}${levelDelta}</span></div></div><div class="comp-section"><h5>Stats</h5><div class="delta-row">${STAT_NAMES.map((stat, index) => {
    const delta = result.stats[index] - best.persona.stats[index];
    return `<span class="delta-badge ${delta > 0 ? 'delta-pos' : delta < 0 ? 'delta-neg' : 'delta-neutral'}">${stat} ${delta > 0 ? '+' : ''}${delta}</span>`;
  }).join('')}</div></div>${gained.length || lost.length ? `<div class="comp-section"><h5>Skills</h5>${gained.length ? `<div style="margin-bottom:0.3rem">${gained.map((skill) => `<span class="delta-badge skill-gained">+${skill}</span>`).join(' ')}</div>` : ''}${lost.length ? `<div>${lost.map((skill) => `<span class="delta-badge skill-lost">-${skill}</span>`).join(' ')}</div>` : ''}</div>` : ''}</div>`;
}

function updateFusionResult() {
  const resultEl = velvetRoot.querySelector('#fusion-result');
  if (!fuseAName || !fuseBName) {
    resultEl.innerHTML = '';
    return;
  }
  if (fuseAName === fuseBName) {
    resultEl.innerHTML = '<div class="invalid-msg">Select two different personas</div>';
    return;
  }
  const result = fuseDyad({ name: fuseAName, ...PERSONAS[fuseAName] }, { name: fuseBName, ...PERSONAS[fuseBName] });
  if (!result) {
    resultEl.innerHTML = '<div class="invalid-msg">No valid fusion result for this combination</div>';
    return;
  }
  refreshAnalysisCache();
  const lost = analyzeLostCoverage({ a: fuseAName, b: fuseBName, result: result.name });
  const transfer = getTransferableSkills(fuseAName, fuseBName, result.name);
  resultEl.innerHTML = `${renderPersonaCard(result.name)}${transfer.canInherit.length || transfer.blocked.length ? `<div class="inherit-panel"><h4>Skill Inheritance</h4>${transfer.canInherit.length ? `<div class="inherit-section"><span class="inherit-label-ok">Can Inherit:</span> ${transfer.canInherit.map((skill) => `<span class="inherit-skill inherit-ok">${skill}</span>`).join(' ')}</div>` : ''}${transfer.blocked.length ? `<div class="inherit-section"><span class="inherit-label-no">Blocked:</span> ${transfer.blocked.map((skill) => `<span class="inherit-skill inherit-no">${skill}</span>`).join(' ')}</div>` : ''}</div>` : ''}${Object.keys(lost.resummon).length ? `<div class="coverage-warning">${Object.entries(lost.resummon).map(([name, whys]) => `Consider resummoning <strong>${name}</strong> for ${whys.map((why) => `<span class="cw-item">${why}</span>`).join(' ')}`).join('<br>')}</div>` : ''}${renderFusionComparison(result.name, fuseAName, fuseBName)}`;
}

function resetFusion() {
  fuseAName = null;
  fuseBName = null;
  velvetRoot.querySelector('#fuse-a').value = '';
  velvetRoot.querySelector('#fuse-b').value = '';
  velvetRoot.querySelector('#fusion-result').innerHTML = '';
}

function autoPopulateFusion(a, b) {
  fuseAName = a;
  fuseBName = b;
  velvetRoot.querySelector('#fuse-a').value = a;
  velvetRoot.querySelector('#fuse-b').value = b;
  updateFusionResult();
}

function computeAllFusions() {
  refreshAnalysisCache();
  const roster = getRosterArray().map((name) => ({ name, ...PERSONAS[name] }));
  const rosterSet = getRosterSet();
  allFusions = [];
  for (let i = 0; i < roster.length; i += 1) {
    for (let j = i + 1; j < roster.length; j += 1) {
      const result = fuseDyad(roster[i], roster[j]);
      if (!result) {
        continue;
      }
      const entry = {
        a: roster[i].name,
        b: roster[j].name,
        result: result.name,
        arcana: PERSONAS[result.name]?.race || '',
        level: PERSONAS[result.name]?.lvl || 0,
        isNew: !rosterSet.has(result.name)
      };
      entry.score = scoreFusion(entry);
      allFusions.push(entry);
    }
  }
  renderAllFusions();
  renderRecommendedFusions();
  velvetRoot.querySelector('#all-fusions-wrap').style.display = '';
}

function renderAllFusions() {
  const newOnly = velvetRoot.querySelector('#filter-new-only').checked;
  const arcanaFilter = velvetRoot.querySelector('#filter-arcana-fusion').value;
  const filtered = allFusions
    .filter((fusion) => (!newOnly || fusion.isNew) && (!arcanaFilter || fusion.arcana === arcanaFilter))
    .sort((left, right) => {
      let a = left[allFusionsSortKey];
      let b = right[allFusionsSortKey];
      if (typeof a === 'string') {
        a = a.toLowerCase();
        b = b.toLowerCase();
      }
      return a < b ? -allFusionsSortDir : a > b ? allFusionsSortDir : 0;
    });
  velvetRoot.querySelector('#all-fusions-count').textContent = `${filtered.length} fusions`;
  velvetRoot.querySelector('#all-fusions-body').innerHTML = filtered
    .map(
      (fusion) =>
        `<tr style="cursor:pointer" data-action="populate-fusion" data-a="${escapeHtml(fusion.a)}" data-b="${escapeHtml(fusion.b)}"><td>${fusion.a}</td><td>${fusion.b}</td><td>${fusion.result}${fusion.isNew ? '<span class="new-badge">NEW</span>' : ''}</td><td>${fusion.arcana}</td><td>${fusion.level}</td><td><span class="score-cell" style="${getScoreColor(fusion.score)}">${fusion.score}</span></td></tr>`
    )
    .join('');
}

function renderRecommendedFusions() {
  const card = velvetRoot.querySelector('#rec-fusions-card');
  if (!allFusions.length) {
    card.style.display = 'none';
    return;
  }
  refreshAnalysisCache();
  const top = allFusions
    .map((fusion) => ({ ...fusion, score: scoreFusion(fusion) }))
    .sort((left, right) => right.score - left.score)
    .filter((fusion) => fusion.score > 0)
    .slice(0, 5);
  if (!top.length) {
    card.style.display = 'none';
    return;
  }
  card.style.display = '';
  velvetRoot.querySelector('#rec-fusions').innerHTML = top
    .map(
      (fusion) =>
        `<div class="rec-item" data-action="populate-fusion" data-a="${escapeHtml(fusion.a)}" data-b="${escapeHtml(fusion.b)}"><span class="rec-score" style="${getScoreColor(fusion.score)}">${fusion.score}</span><span class="rec-name">${fusion.result}</span><span class="rec-from">${fusion.a} + ${fusion.b}</span><span class="rec-reason">${getRecommendationReason(fusion)}</span></div>`
    )
    .join('');
}

function renderSpecialFusions() {
  const roster = getRosterSet();
  velvetRoot.querySelector('#special-list').innerHTML = Object.entries(SPECIAL_RECIPES)
    .sort((a, b) => (PERSONAS[a[0]]?.lvl || 0) - (PERSONAS[b[0]]?.lvl || 0))
    .map(([name, ingredients]) => {
      const haveCount = ingredients.filter((ingredient) => roster.has(ingredient)).length;
      return `<div class="special-item ${haveCount === ingredients.length ? 'complete' : haveCount > 0 ? 'partial' : ''}"><span class="sp-name">${name}</span><span class="r-arcana" style="font-size:0.7rem">${PERSONAS[name]?.race || ''} Lv${PERSONAS[name]?.lvl || '?'}</span><div class="sp-ingredients">${ingredients
        .map((ingredient) => `<span class="sp-ing ${roster.has(ingredient) ? 'have' : 'missing'}">${ingredient}</span>`)
        .join('+')}</div><span class="sp-status ${haveCount === ingredients.length ? 'ready' : haveCount > 0 ? 'partial-status' : 'none-status'}">${haveCount === ingredients.length ? 'READY' : `${haveCount}/${ingredients.length}`}</span></div>`;
    })
    .join('');
}

function renderCompendium() {
  renderCompendiumSummary();
  const arcana = velvetRoot.querySelector('#comp-arcana').value;
  const lvlMin = Number(velvetRoot.querySelector('#comp-lvl-min').value) || 0;
  const lvlMax = Number(velvetRoot.querySelector('#comp-lvl-max').value) || 99;
  const search = velvetRoot.querySelector('#comp-search').value.toLowerCase().trim();
  const elemFilter = velvetRoot.querySelector('#comp-elem-filter').value;
  const resistType = velvetRoot.querySelector('#comp-resist-type').value;
  const list = personaList
    .filter((persona) => {
      if (arcana && persona.race !== arcana) {
        return false;
      }
      if (persona.lvl < lvlMin || persona.lvl > lvlMax) {
        return false;
      }
      if (search) {
        const nameMatch = persona.name.toLowerCase().includes(search);
        const skillMatch = Object.keys(persona.skills).some((skill) => skill.toLowerCase().includes(search));
        if (!nameMatch && !skillMatch) {
          return false;
        }
      }
      if (elemFilter) {
        const index = V_RESIST_ELEMS.indexOf(elemFilter);
        const code = persona.resists[index] || '-';
        if (resistType === 'no-weak') {
          if (code === 'w') {
            return false;
          }
        } else if (resistType) {
          if (code !== resistType) {
            return false;
          }
        } else if (code === '-') {
          return false;
        }
      }
      if (resistType && !elemFilter) {
        if (resistType === 'no-weak') {
          return !persona.resists.includes('w');
        }
        return V_RESIST_ELEMS.some((_, index) => (persona.resists[index] || '-') === resistType);
      }
      return true;
    })
    .sort((left, right) => {
      const pick = (persona) => {
        if (compSortKey === 'name') return persona.name.toLowerCase();
        if (compSortKey === 'race') return persona.race;
        if (compSortKey === 'lvl') return persona.lvl;
        if (['st', 'ma', 'en', 'ag', 'lu'].includes(compSortKey)) {
          return persona.stats[['st', 'ma', 'en', 'ag', 'lu'].indexOf(compSortKey)];
        }
        return persona.lvl;
      };
      const a = pick(left);
      const b = pick(right);
      return a < b ? -compSortDir : a > b ? compSortDir : 0;
    });
  velvetRoot.querySelector('#comp-body').innerHTML = list
    .map(
      (persona) =>
        `<tr data-name="${escapeHtml(persona.name)}" class="${selectedPersona === persona.name ? 'selected' : ''}"><td style="font-weight:600">${persona.name}</td><td style="color:var(--accent-cyan);font-size:0.75rem">${persona.race}</td><td style="font-family:'JetBrains Mono',monospace">${persona.lvl}</td>${persona.stats
          .map((value) => `<td style="font-family:'JetBrains Mono',monospace">${value}</td>`)
          .join('')}${V_RESIST_ELEMS.slice(0, 9)
          .map((_, index) => {
            const code = persona.resists[index] || '-';
            return `<td class="${RESIST_CLASS[code] || ''}" style="text-align:center;font-size:0.75rem;font-weight:700">${V_RESIST_LABELS[code] || '—'}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');

  if (selectedPersona && !list.some((persona) => persona.name === selectedPersona)) {
    selectedPersona = null;
    closeCompDetailDrawer();
    renderCompDetailEmptyState(
      'Selection Cleared',
      'The previously selected persona is hidden by the current filters. Pick another row to inspect its details.'
    );
  }
}

function isCompDetailDrawerMode() {
  return window.innerWidth <= 980;
}

function getCompDetailDesktopHost() {
  return velvetRoot.querySelector('#comp-detail-desktop');
}

function getCompDetailMobileHost() {
  return velvetRoot.querySelector('#comp-detail-mobile');
}

function getCompDetailDrawer() {
  return velvetRoot.querySelector('#comp-detail-drawer');
}

function getCompDetailOverlay() {
  return velvetRoot.querySelector('#comp-detail-overlay');
}

function renderCompDetailEmptyState(title = 'Select a Persona', message = 'Pick a persona from the compendium table to inspect details, add it to your roster, or set it as a fusion target.') {
  const markup = `<div class="detail-panel comp-detail-empty"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></div>`;
  getCompDetailDesktopHost().innerHTML = markup;
  getCompDetailMobileHost().innerHTML = markup;
}

function renderCompDetailMarkup(name) {
  return `<div class="detail-panel">${renderPersonaCard(name)}${renderPersonaInsightMarkup(name)}<div style="margin-top:1rem;display:flex;gap:0.5rem;flex-wrap:wrap"><button class="btn btn-gold" data-action="add-roster" data-name="${escapeHtml(name)}">Add to Roster</button><button class="btn" data-action="set-target" data-name="${escapeHtml(name)}">Set as Fusion Target</button></div><h3 style="margin-top:1rem;font-size:0.95rem">How to Fuse</h3><div data-role="reverse-results"><p style="color:var(--text-muted);font-size:0.85rem">Computing...</p></div></div>`;
}

function openCompDetailDrawer() {
  if (!isCompDetailDrawerMode()) {
    return;
  }
  getCompDetailOverlay().classList.add('active');
  const drawer = getCompDetailDrawer();
  drawer.classList.add('active');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeCompDetailDrawer() {
  getCompDetailOverlay().classList.remove('active');
  const drawer = getCompDetailDrawer();
  drawer.classList.remove('active');
  drawer.setAttribute('aria-hidden', 'true');
}

function showCompDetail(name, options = {}) {
  const openDrawer = options.openDrawer !== false;
  selectedPersona = name;

  const markup = renderCompDetailMarkup(name);
  getCompDetailDesktopHost().innerHTML = markup;
  getCompDetailMobileHost().innerHTML = markup;

  if (openDrawer) {
    openCompDetailDrawer();
  }

  setTimeout(() => {
    if (selectedPersona !== name) {
      return;
    }
    const results = reverseLookup(name);
    const roster = getRosterSet();
    const targets = [
      ...velvetRoot.querySelectorAll('[data-role="reverse-results"]')
    ];
    if (!targets.length) {
      return;
    }

    let html;
    if (!results.length) {
      html = '<p style="color:var(--text-muted);font-size:0.85rem">No fusion recipes found (base persona or treasure demon)</p>';
    } else if (results[0].type === 'special') {
      html = `<div style="margin-bottom:0.5rem;color:var(--accent-gold);font-size:0.85rem">Special Fusion:</div><div style="display:flex;gap:0.3rem;flex-wrap:wrap">${results[0].ingredients
        .map((ingredient) => `<span class="sp-ing ${roster.has(ingredient) ? 'have' : 'missing'}">${ingredient}</span>`)
        .join(' + ')}</div>`;
    } else {
      html = `<div class="reverse-results">${results
        .slice(0, 50)
        .map(
          (entry) =>
            `<div class="reverse-item"><span class="${roster.has(entry.p1) ? 'ri-have' : 'ri-miss'}">${entry.p1}</span><span class="ri-plus">+</span><span class="${roster.has(entry.p2) ? 'ri-have' : 'ri-miss'}">${entry.p2}</span></div>`
        )
        .join('')}${results.length > 50 ? `<div style="color:var(--text-muted);font-size:0.8rem;padding:0.3rem">...and ${results.length - 50} more</div>` : ''}</div>`;
    }

    targets.forEach((target) => {
      target.innerHTML = html;
    });
  }, 10);
}

function syncCompDetailLayout() {
  if (!selectedPersona) {
    closeCompDetailDrawer();
    renderCompDetailEmptyState();
    return;
  }
  showCompDetail(selectedPersona, { openDrawer: false });
  if (!isCompDetailDrawerMode()) {
    closeCompDetailDrawer();
  }
}

function planFusionChain(targetName) {
  const available = getRosterSet();
  const steps = [];
  const visited = new Set();
  function solve(name, depth) {
    if (available.has(name)) return true;
    if (visited.has(name) || depth > 4) return false;
    visited.add(name);
    if (SPECIAL_RECIPES[name]) {
      if (SPECIAL_RECIPES[name].every((ingredient) => solve(ingredient, depth + 1))) {
        steps.push({ type: 'special', result: name, ingredients: [...SPECIAL_RECIPES[name]] });
        available.add(name);
        return true;
      }
      visited.delete(name);
      return false;
    }
    const recipes = reverseLookup(name)
      .filter((entry) => entry.type === 'normal')
      .map((entry) => ({
        entry,
        has: Number(available.has(entry.p1)) + Number(available.has(entry.p2)),
        lvl: (PERSONAS[entry.p1]?.lvl || 99) + (PERSONAS[entry.p2]?.lvl || 99)
      }))
      .sort((a, b) => b.has - a.has || a.lvl - b.lvl);
    for (const recipe of recipes.slice(0, 20)) {
      if (solve(recipe.entry.p1, depth + 1) && solve(recipe.entry.p2, depth + 1)) {
        steps.push({ type: 'fuse', result: name, a: recipe.entry.p1, b: recipe.entry.p2 });
        available.add(name);
        return true;
      }
    }
    visited.delete(name);
    return false;
  }
  return { success: solve(targetName, 0), steps };
}

function renderChain(chain, targetName) {
  if (chain.success && !chain.steps.length) {
    return '<div class="chain-done">Already in your roster!</div>';
  }
  if (!chain.success) {
    return '<div class="chain-fail">No fusion path found from your current roster (max 4 steps deep). Try adding more personas to your roster first.</div>';
  }
  const roster = getRosterSet();
  return `<div class="chain-steps">${chain.steps
    .map((step, index) => `<div class="chain-step"><span class="chain-num">${index + 1}</span><span class="chain-ings">${(step.type === 'special' ? step.ingredients : [step.a, step.b])
      .map((name) => `<span class="chain-ing ${roster.has(name) ? 'have' : 'fused'}">${name}</span>`)
      .join(' + ')}</span><span class="chain-arrow">→</span><span class="chain-result${step.result === targetName ? ' chain-target' : ''}">${step.result}</span><span class="chain-meta">Lv${PERSONAS[step.result]?.lvl || '?'} ${PERSONAS[step.result]?.race || ''}</span>${step.type === 'special' ? '<span class="chain-badge-special">Special</span>' : ''}</div>`)
    .join('')}</div>`;
}

function showChainPlanner(targetName) {
  const card = velvetRoot.querySelector('#chain-planner-card');
  const label = velvetRoot.querySelector('#chain-target-name');
  const result = velvetRoot.querySelector('#chain-result');
  plannerTargetName = targetName;
  card.style.display = '';
  label.textContent = targetName;
  result.innerHTML = '<div style="color:var(--text-muted)">Computing planner...</div>';
  setTimeout(() => {
    result.innerHTML = renderPlanner(buildFusionPlanner(targetName));
  }, 10);
}

function closeChainPlanner() {
  plannerTargetName = null;
  velvetRoot.querySelector('#chain-planner-card').style.display = 'none';
}

function openFusionPlannerTarget(targetName) {
  if (!initialized || !targetName || !PERSONAS[targetName]) {
    return;
  }
  switchTab('fusion');
  showChainPlanner(targetName);
}

function switchTab(tab) {
  velvetRoot.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  velvetRoot.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tab}`);
  });
  if (tab === 'fusion') {
    closeCompDetailDrawer();
    renderSpecialFusions();
    if (allFusions.length) {
      renderRecommendedFusions();
    }
  } else if (tab === 'compendium') {
    renderCompendium();
  }
}

function rerenderFromStore() {
  renderRoster();
  renderSpecialFusions();
  if (fuseAName && !getRosterSet().has(fuseAName)) {
    fuseAName = null;
  }
  if (fuseBName && !getRosterSet().has(fuseBName)) {
    fuseBName = null;
  }
  updateFusionResult();
  if (allFusions.length) {
    computeAllFusions();
  }
  if (selectedPersona) {
    renderCompendium();
    showCompDetail(selectedPersona, { openDrawer: false });
  } else {
    renderCompendium();
  }
  if (plannerTargetName) {
    showChainPlanner(plannerTargetName);
  }
}

function scheduleRerenderFromStore() {
  if (storeRenderQueued) {
    return;
  }
  storeRenderQueued = true;
  const run = () => {
    storeRenderQueued = false;
    rerenderFromStore();
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

function initVelvet({ root, store }) {
  if (initialized) {
    return;
  }
  velvetRoot = root;
  velvetStore = store;
  initialized = true;

  velvetRoot.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  const arcanaOptions = ARCANA_LIST.map((arcana) => `<option value="${arcana}">${arcana}</option>`).join('');
  velvetRoot.querySelector('#comp-arcana').innerHTML += arcanaOptions;
  velvetRoot.querySelector('#filter-arcana-fusion').innerHTML += arcanaOptions;
  velvetRoot.querySelector('#comp-elem-filter').innerHTML += Object.entries(ELEM_NAMES)
    .map(([key, label]) => `<option value="${key}">${label}</option>`)
    .join('');

  setupAutocomplete(
    'roster-search',
    'roster-ac-dd',
    (query) => personaList.filter((persona) => persona.name.toLowerCase().includes(query) && !getRosterSet().has(persona.name)),
    (persona) => addToRoster(persona.name),
    { clearOnSelect: true }
  );
  setupAutocomplete(
    'fuse-a',
    'fuse-a-dd',
    (query) => personaList.filter((persona) => getRosterSet().has(persona.name) && (!query || persona.name.toLowerCase().includes(query))),
    (persona) => {
      fuseAName = persona.name;
      velvetRoot.querySelector('#fuse-a').value = persona.name;
      updateFusionResult();
    },
    { clearOnSelect: false, showOnEmpty: true }
  );
  setupAutocomplete(
    'fuse-b',
    'fuse-b-dd',
    (query) => personaList.filter((persona) => getRosterSet().has(persona.name) && (!query || persona.name.toLowerCase().includes(query))),
    (persona) => {
      fuseBName = persona.name;
      velvetRoot.querySelector('#fuse-b').value = persona.name;
      updateFusionResult();
    },
    { clearOnSelect: false, showOnEmpty: true }
  );

  velvetRoot.querySelectorAll('.fusion-table th[data-sort]').forEach((header) => {
    header.addEventListener('click', () => {
      const { sort } = header.dataset;
      if (allFusionsSortKey === sort) {
        allFusionsSortDir *= -1;
      } else {
        allFusionsSortKey = sort;
        allFusionsSortDir = 1;
      }
      renderAllFusions();
    });
  });
  velvetRoot.querySelector('#filter-new-only').addEventListener('change', renderAllFusions);
  velvetRoot.querySelector('#filter-arcana-fusion').addEventListener('change', renderAllFusions);

  velvetRoot.querySelectorAll('.comp-table th[data-sort]').forEach((header) => {
    header.addEventListener('click', () => {
      const { sort } = header.dataset;
      if (compSortKey === sort) {
        compSortDir *= -1;
      } else {
        compSortKey = sort;
        compSortDir = 1;
      }
      renderCompendium();
    });
  });
  ['comp-arcana', 'comp-lvl-min', 'comp-lvl-max', 'comp-search', 'comp-elem-filter', 'comp-resist-type'].forEach((id) => {
    const element = velvetRoot.querySelector(`#${id}`);
    element.addEventListener('input', renderCompendium);
    element.addEventListener('change', renderCompendium);
  });
  velvetRoot.querySelector('#comp-detail-close').addEventListener('click', closeCompDetailDrawer);
  velvetRoot.querySelector('#comp-detail-overlay').addEventListener('click', closeCompDetailDrawer);
  window.addEventListener('resize', syncCompDetailLayout);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCompDetailDrawer();
    }
  });

  velvetRoot.querySelector('#roster-clear-btn').addEventListener('click', clearRoster);
  velvetRoot.querySelector('#fusion-reset-btn').addEventListener('click', resetFusion);
  velvetRoot.querySelector('#fusion-calc-btn').addEventListener('click', computeAllFusions);
  velvetRoot.querySelector('#chain-planner-close').addEventListener('click', closeChainPlanner);
  velvetRoot.querySelector('#globalSearch').addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase().trim();
    const activeTab = velvetRoot.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab === 'compendium') {
      velvetRoot.querySelector('#comp-search').value = query;
      renderCompendium();
    } else if (activeTab === 'roster') {
      velvetRoot.querySelectorAll('.roster-card').forEach((card) => {
        const name = card.querySelector('.r-name').textContent.toLowerCase();
        card.style.display = !query || name.includes(query) ? '' : 'none';
      });
    }
  });

  velvetRoot.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-action="remove-roster"]');
    if (removeButton) {
      removeFromRoster(removeButton.dataset.name);
      return;
    }
    const fusionButton = event.target.closest('[data-action="populate-fusion"]');
    if (fusionButton) {
      autoPopulateFusion(fusionButton.dataset.a, fusionButton.dataset.b);
      return;
    }
    const addRosterButton = event.target.closest('[data-action="add-roster"]');
    if (addRosterButton) {
      addToRoster(addRosterButton.dataset.name);
      return;
    }
    const setTargetButton = event.target.closest('[data-action="set-target"]');
    if (setTargetButton) {
      closeCompDetailDrawer();
      switchTab('fusion');
      showChainPlanner(setTargetButton.dataset.name);
      return;
    }
    const compRow = event.target.closest('#comp-body tr[data-name]');
    if (compRow) {
      selectedPersona = compRow.dataset.name;
      renderCompendium();
      showCompDetail(selectedPersona, { openDrawer: isCompDetailDrawerMode() });
    }
  });

  velvetStore.subscribe(scheduleRerenderFromStore);
  renderCompDetailEmptyState();
  renderRoster();
  renderCompendium();
  renderSpecialFusions();
}

window.openVelvetFusionTarget = openFusionPlannerTarget;
window.initVelvet = initVelvet;
})();
