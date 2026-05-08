(() => {
const DEFAULT_MAX_PLANNER_DEPTH = 6;
const DEFAULT_MAX_PLANNER_RECIPES = 12;

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function createFusionEngine(options) {
  const {
    personas,
    specialRecipes,
    arcanaChart,
    arcanaList,
    socialLinks,
    fusionUnlocks = { dlcPersonas: [], gatedPersonas: {} },
    getState,
    maxPlannerDepth = DEFAULT_MAX_PLANNER_DEPTH,
    maxPlannerRecipes = DEFAULT_MAX_PLANNER_RECIPES
  } = options;

  const dlcPersonas = new Set(fusionUnlocks.dlcPersonas || []);
  const gatedPersonas = fusionUnlocks.gatedPersonas || {};
  const specialPersonas = new Set(Object.keys(specialRecipes));
  const personaList = Object.entries(personas)
    .map(([name, data]) => ({ name, ...data }))
    .sort((left, right) => left.lvl - right.lvl || left.name.localeCompare(right.name));
  const resultsByArcana = {};
  const ingredientsByArcana = {};
  const reverseLookupCache = new Map();

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

  function getSnapshot() {
    return getState?.() || {};
  }

  function getRosterSet() {
    return new Set((getSnapshot().roster || []).filter((name) => personas[name]));
  }

  function getFusionSettings() {
    return getSnapshot().fusionSettings || { dlcEnabled: true, manualUnlocks: {} };
  }

  function isPersonaUnlocked(name) {
    if (!personas[name]) {
      return false;
    }
    const state = getSnapshot();
    const settings = state.fusionSettings || { dlcEnabled: true, manualUnlocks: {} };
    if (getRosterSet().has(name)) {
      return true;
    }
    if (dlcPersonas.has(name) && !settings.dlcEnabled) {
      return false;
    }
    const gate = gatedPersonas[name];
    if (!gate) {
      return true;
    }
    if (gate.type === 'social') {
      return (state.socialLinks?.ranks?.[gate.arcana] || 0) >= 10;
    }
    if (gate.type === 'socialAll') {
      return arcanaList.every((arcana) => {
        const link = socialLinks[arcana];
        return !link || link.automatic || (state.socialLinks?.ranks?.[arcana] || 0) >= 10;
      });
    }
    if (gate.type === 'objective') {
      return Boolean(state.objectives?.[gate.id]);
    }
    if (gate.type === 'linkedEpisode') {
      return Boolean(state.linkedEpisodes?.completed?.[gate.id] || settings.manualUnlocks?.[gate.legacyKey]);
    }
    if (gate.type === 'manual') {
      return Boolean(settings.manualUnlocks?.[gate.key]);
    }
    return true;
  }

  function getPersonaUnlockLabel(name) {
    if (dlcPersonas.has(name) && !getFusionSettings().dlcEnabled) {
      return 'Enable DLC Personas in Fusion Settings';
    }
    return gatedPersonas[name]?.label || '';
  }

  function getAvailabilitySignature() {
    const state = getSnapshot();
    const settings = state.fusionSettings || { dlcEnabled: true, manualUnlocks: {} };
    const manual = Object.entries(settings.manualUnlocks || {})
      .filter(([, value]) => value)
      .map(([key]) => key)
      .sort()
      .join(',');
    const ranks = Object.entries(state.socialLinks?.ranks || {})
      .filter(([, rank]) => rank >= 10)
      .map(([arcana]) => arcana)
      .sort()
      .join(',');
    const objectives = Object.entries(state.objectives || {})
      .filter(([, complete]) => complete)
      .map(([id]) => id)
      .sort()
      .join(',');
    const linkedEpisodes = Object.entries(state.linkedEpisodes?.completed || {})
      .filter(([, complete]) => complete)
      .map(([id]) => id)
      .sort()
      .join(',');
    const roster = (state.roster || []).filter((name) => personas[name]).sort().join(',');
    return `${settings.dlcEnabled ? 'dlc' : 'base'}|${manual}|${ranks}|${objectives}|${linkedEpisodes}|${roster}`;
  }

  function getAvailableResultsByArcana(arcana) {
    return (resultsByArcana[arcana] || []).filter((persona) => isPersonaUnlocked(persona.name));
  }

  function getResultArcana(a1, a2) {
    if (a1 === a2) {
      return a1;
    }
    return arcanaChart[a1]?.[a2] || null;
  }

  function checkSpecialRecipe(names) {
    const nameSet = new Set(names);
    for (const [result, ingredients] of Object.entries(specialRecipes)) {
      if (ingredients.length === names.length && ingredients.every((ingredient) => nameSet.has(ingredient))) {
        return result;
      }
    }
    return null;
  }

  function fuseSameArcana(p1, p2) {
    const candidates = getAvailableResultsByArcana(p1.race).filter(
      (candidate) => candidate.name !== p1.name && candidate.name !== p2.name
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

  function selectClosestFusionResult(resultArcana, targetLevel, p1, p2) {
    return getAvailableResultsByArcana(resultArcana)
      .filter((candidate) => candidate.name !== p1.name && candidate.name !== p2.name)
      .sort(
        (left, right) =>
          Math.abs(left.lvl - targetLevel) - Math.abs(right.lvl - targetLevel) ||
          left.lvl - right.lvl ||
          left.name.localeCompare(right.name)
      )[0] || null;
  }

  function fuseDyad(p1, p2) {
    const special = checkSpecialRecipe([p1.name, p2.name]);
    if (special) {
      return isPersonaUnlocked(special) ? { name: special, ...personas[special], special: true } : null;
    }
    if (p1.race === p2.race) {
      return fuseSameArcana(p1, p2);
    }
    const resultArcana = getResultArcana(p1.race, p2.race);
    if (!resultArcana) {
      return null;
    }
    const targetLevel = Math.ceil((p1.lvl + p2.lvl) / 2);
    return selectClosestFusionResult(resultArcana, targetLevel, p1, p2);
  }

  function reverseLookup(targetName) {
    const cacheKey = `${targetName}|${getAvailabilitySignature()}`;
    if (reverseLookupCache.has(cacheKey)) {
      return reverseLookupCache.get(cacheKey);
    }
    const target = personas[targetName];
    if (!target || !isPersonaUnlocked(targetName)) {
      return [];
    }
    if (specialRecipes[targetName]) {
      const specialResults = [{ type: 'special', ingredients: specialRecipes[targetName] }];
      reverseLookupCache.set(cacheKey, specialResults);
      return specialResults;
    }
    const results = [];
    const seen = new Set();
    for (let i = 0; i < arcanaList.length; i += 1) {
      for (let j = i; j < arcanaList.length; j += 1) {
        const a1 = arcanaList[i];
        const a2 = arcanaList[j];
        const resultArcana = getResultArcana(a1, a2);
        if (resultArcana !== target.race) {
          continue;
        }
        const list1 = (ingredientsByArcana[a1] || []).filter((persona) => isPersonaUnlocked(persona.name));
        const list2 = a1 === a2
          ? list1
          : (ingredientsByArcana[a2] || []).filter((persona) => isPersonaUnlocked(persona.name));
        for (const p1 of list1) {
          for (const p2 of list2) {
            if (p1.name === p2.name || (a1 === a2 && p1.lvl >= p2.lvl)) {
              continue;
            }
            const result = fuseDyad(p1, p2);
            if (result?.name === targetName) {
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
    reverseLookupCache.set(cacheKey, results);
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
          (sum, ingredient) => sum + (personas[ingredient]?.lvl || 99),
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
      .slice(0, maxPlannerRecipes);
  }

  function buildPlanNode(targetName, roster, memo, depth = 0, trail = new Set()) {
    if (!personas[targetName]) {
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

    if (!roster.has(targetName) && !isPersonaUnlocked(targetName)) {
      return {
        status: 'locked',
        name: targetName,
        blockers: [targetName],
        hintIngredients: [],
        directOwnedCount: 0,
        ingredientLevelSum: 999,
        recipeKey: targetName,
        unlockLabel: getPersonaUnlockLabel(targetName)
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

    if (trail.has(targetName) || depth > maxPlannerDepth) {
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
        (sum, ingredient) => sum + (personas[ingredient]?.lvl || 99),
        0
      );
      const recipeKey = recipe.ingredients.join('|');

      if (childNodes.every((child) => child.status !== 'blocked' && child.status !== 'locked')) {
        const path = childNodes.flatMap((child) => child.path).concat({
          type: recipe.type,
          result: targetName,
          ingredients: [...recipe.ingredients],
          level: personas[targetName]?.lvl || 0,
          arcana: personas[targetName]?.race || ''
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

  function buildFusionPlanner(targetName, currentLevel = getSnapshot().profile?.playerLevel || 1) {
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
    if (node.status === 'locked') {
      return {
        status: 'locked',
        target: targetName,
        path: [],
        nextActions: [],
        neededFirst: [],
        blockers: node.blockers || [targetName],
        unlockLabel: node.unlockLabel || getPersonaUnlockLabel(targetName)
      };
    }
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

  function clearCache() {
    reverseLookupCache.clear();
  }

  return {
    personaList,
    gatedPersonas,
    dlcPersonas,
    getAvailableResultsByArcana,
    getResultArcana,
    isPersonaUnlocked,
    getPersonaUnlockLabel,
    fuseDyad,
    reverseLookup,
    buildFusionPlanner,
    clearCache
  };
}

window.createFusionEngine = createFusionEngine;
})();
