(() => {
const STORE_KEY = 'p3r-companion-state';
const LEGACY_ROSTER_KEY = 'p3r-roster';
const LEGACY_SOCIAL_KEY = 'p3r-social-links';
const STORE_DAYS_IN_MONTH = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function clampInt(value, min, max, fallback) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, num));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stringifyState(value) {
  return JSON.stringify(value);
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeDate(rawDate, fallbackDate) {
  if (!isPlainObject(rawDate)) {
    return { ...fallbackDate };
  }

  const rawMonth = clampInt(rawDate.month, 1, 12, fallbackDate.month);
  const month = rawMonth === 2 || rawMonth === 3 ? fallbackDate.month : rawMonth;
  const maxDay = STORE_DAYS_IN_MONTH[month] || 31;
  const day = clampInt(rawDate.day, 1, maxDay, fallbackDate.day);

  return { month, day };
}

function sanitizeStats(rawStats, fallbackStats) {
  const nextStats = { ...fallbackStats };
  if (!isPlainObject(rawStats)) {
    return nextStats;
  }

  Object.keys(nextStats).forEach((key) => {
    nextStats[key] = clampInt(rawStats[key], 1, 6, nextStats[key]);
  });

  return nextStats;
}

function sanitizeRanks(rawRanks, arcanaOrder) {
  const nextRanks = {};
  const source = isPlainObject(rawRanks) ? rawRanks : {};

  arcanaOrder.forEach((arcana) => {
    nextRanks[arcana] = clampInt(source[arcana], 0, 10, 0);
  });

  return nextRanks;
}

function sanitizeRoster(rawRoster, validPersonaNames) {
  if (!Array.isArray(rawRoster)) {
    return [];
  }

  const seen = new Set();
  const nextRoster = [];

  rawRoster.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    if (!validPersonaNames.has(entry) || seen.has(entry)) {
      return;
    }
    seen.add(entry);
    nextRoster.push(entry);
  });

  return nextRoster;
}

function sanitizeSocialLinks(rawSocialLinks, createDefaultSocialLinksState, arcanaOrder) {
  const defaults = createDefaultSocialLinksState();
  if (!isPlainObject(rawSocialLinks)) {
    return defaults;
  }

  return {
    ranks: sanitizeRanks(rawSocialLinks.ranks, arcanaOrder)
  };
}

function sanitizeProfile(rawProfile, createDefaultProfileState) {
  const defaults = createDefaultProfileState();
  if (!isPlainObject(rawProfile)) {
    return defaults;
  }

  return {
    gameDate: sanitizeDate(rawProfile.gameDate, defaults.gameDate),
    playerLevel: clampInt(rawProfile.playerLevel, 1, 99, defaults.playerLevel),
    currentFloor: clampInt(rawProfile.currentFloor, 2, 264, defaults.currentFloor),
    stats: sanitizeStats(rawProfile.stats, defaults.stats)
  };
}

function sanitizeObjectives(rawObjectives) {
  const source = isPlainObject(rawObjectives) ? rawObjectives : {};
  const nextObjectives = {};

  Object.entries(source).forEach(([key, value]) => {
    if (typeof key !== 'string') {
      return;
    }
    nextObjectives[key] = Boolean(value);
  });

  return nextObjectives;
}

function sanitizeLinkedEpisodes(rawLinkedEpisodes) {
  const source = isPlainObject(rawLinkedEpisodes) ? rawLinkedEpisodes : {};
  const sanitizeFlags = (rawFlags) => {
    const flags = {};
    if (!isPlainObject(rawFlags)) {
      return flags;
    }
    Object.entries(rawFlags).forEach(([key, value]) => {
      if (typeof key === 'string' && key) {
        flags[key] = Boolean(value);
      }
    });
    return flags;
  };

  return {
    completed: sanitizeFlags(source.completed),
    skipped: sanitizeFlags(source.skipped)
  };
}

function sanitizeFusionSettings(rawFusionSettings) {
  const source = isPlainObject(rawFusionSettings) ? rawFusionSettings : {};
  const manualUnlocks = isPlainObject(source.manualUnlocks) ? source.manualUnlocks : {};
  const nextManualUnlocks = {};

  Object.entries(manualUnlocks).forEach(([key, value]) => {
    if (typeof key === 'string' && key) {
      nextManualUnlocks[key] = Boolean(value);
    }
  });

  return {
    dlcEnabled: source.dlcEnabled === undefined ? true : Boolean(source.dlcEnabled),
    manualUnlocks: nextManualUnlocks
  };
}

function sanitizeState(rawState, options) {
  const baseState = {
    version: 1,
    roster: [],
    profile: options.createDefaultProfileState(),
    socialLinks: options.createDefaultSocialLinksState(),
    objectives: {},
    linkedEpisodes: sanitizeLinkedEpisodes({}),
    fusionSettings: sanitizeFusionSettings({})
  };

  if (!isPlainObject(rawState)) {
    return baseState;
  }

  const legacySocialLinks = isPlainObject(rawState.socialLinks) ? rawState.socialLinks : {};

  return {
    version: 1,
    roster: sanitizeRoster(rawState.roster, options.validPersonaNames),
    profile: sanitizeProfile(
      isPlainObject(rawState.profile)
        ? rawState.profile
        : {
            gameDate: legacySocialLinks.gameDate,
            stats: legacySocialLinks.stats
          },
      options.createDefaultProfileState
    ),
    socialLinks: sanitizeSocialLinks(
      legacySocialLinks,
      options.createDefaultSocialLinksState,
      options.arcanaOrder
    ),
    objectives: sanitizeObjectives(rawState.objectives),
    linkedEpisodes: sanitizeLinkedEpisodes(rawState.linkedEpisodes),
    fusionSettings: sanitizeFusionSettings(rawState.fusionSettings)
  };
}

function readJson(localStorageRef, key) {
  const raw = localStorageRef.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function readPersistedState(localStorageRef, options) {
  const persisted = readJson(localStorageRef, STORE_KEY);
  if (persisted) {
    return sanitizeState(persisted, options);
  }

  const legacyRoster = readJson(localStorageRef, LEGACY_ROSTER_KEY);
  const legacySocialLinks = readJson(localStorageRef, LEGACY_SOCIAL_KEY);

  if (legacyRoster || legacySocialLinks) {
    return sanitizeState(
      {
        version: 1,
        roster: legacyRoster,
        socialLinks: legacySocialLinks
      },
      options
    );
  }

  return sanitizeState({}, options);
}

function validateImportedPayload(rawData) {
  if (!isPlainObject(rawData)) {
    throw new Error('Invalid save data.');
  }
  if (rawData.version === undefined) {
    throw new Error('Invalid save data: missing version.');
  }
  if (!Array.isArray(rawData.roster)) {
    throw new Error('Invalid save data: roster must be an array.');
  }
  if (rawData.profile !== undefined && !isPlainObject(rawData.profile)) {
    throw new Error('Invalid save data: profile must be an object.');
  }
  if (!isPlainObject(rawData.socialLinks)) {
    throw new Error('Invalid save data: socialLinks must be an object.');
  }
  if (rawData.objectives !== undefined && !isPlainObject(rawData.objectives)) {
    throw new Error('Invalid save data: objectives must be an object.');
  }
  if (rawData.linkedEpisodes !== undefined && !isPlainObject(rawData.linkedEpisodes)) {
    throw new Error('Invalid save data: linkedEpisodes must be an object.');
  }
  if (rawData.fusionSettings !== undefined && !isPlainObject(rawData.fusionSettings)) {
    throw new Error('Invalid save data: fusionSettings must be an object.');
  }
}

function createStore(options) {
  const listeners = new Set();
  const localStorageRef = options.localStorageRef || window.localStorage;

  let state = readPersistedState(localStorageRef, options);
  let lastPersistedState = null;

  function emit(snapshot = getState()) {
    listeners.forEach((listener) => listener(snapshot));
  }

  function persist() {
    const serialized = stringifyState(state);
    if (serialized === lastPersistedState) {
      return;
    }
    localStorageRef.setItem(STORE_KEY, serialized);
    lastPersistedState = serialized;
  }

  function getState() {
    return clone(state);
  }

  function setState(nextState) {
    state = nextState;
    persist();
    const snapshot = getState();
    emit(snapshot);
    return snapshot;
  }

  function reducer(currentState, action) {
    switch (action.type) {
      case 'ROSTER_ADD': {
        const name = action.payload;
        if (!options.validPersonaNames.has(name) || currentState.roster.includes(name)) {
          return currentState;
        }
        return { ...currentState, roster: [...currentState.roster, name] };
      }
      case 'ROSTER_REMOVE': {
        const name = action.payload;
        if (!currentState.roster.includes(name)) {
          return currentState;
        }
        return {
          ...currentState,
          roster: currentState.roster.filter((entry) => entry !== name)
        };
      }
      case 'ROSTER_CLEAR':
        if (currentState.roster.length === 0) {
          return currentState;
        }
        return { ...currentState, roster: [] };
      case 'SOCIALLINKS_SET_DATE': {
        const nextDate = sanitizeDate(action.payload, currentState.profile.gameDate);
        return {
          ...currentState,
          profile: {
            ...currentState.profile,
            gameDate: nextDate
          }
        };
      }
      case 'SOCIALLINKS_SET_STAT': {
        const { stat, value } = action.payload;
        if (!Object.prototype.hasOwnProperty.call(currentState.profile.stats, stat)) {
          return currentState;
        }
        return {
          ...currentState,
          profile: {
            ...currentState.profile,
            stats: {
              ...currentState.profile.stats,
              [stat]: clampInt(value, 1, 6, currentState.profile.stats[stat])
            }
          }
        };
      }
      case 'PROFILE_SET_DATE': {
        const nextDate = sanitizeDate(action.payload, currentState.profile.gameDate);
        return {
          ...currentState,
          profile: {
            ...currentState.profile,
            gameDate: nextDate
          }
        };
      }
      case 'PROFILE_SET_LEVEL':
        return {
          ...currentState,
          profile: {
            ...currentState.profile,
            playerLevel: clampInt(action.payload, 1, 99, currentState.profile.playerLevel)
          }
        };
      case 'PROFILE_SET_FLOOR':
        return {
          ...currentState,
          profile: {
            ...currentState.profile,
            currentFloor: clampInt(action.payload, 2, 264, currentState.profile.currentFloor)
          }
        };
      case 'PROFILE_SET_STAT': {
        const { stat, value } = action.payload;
        if (!Object.prototype.hasOwnProperty.call(currentState.profile.stats, stat)) {
          return currentState;
        }
        return {
          ...currentState,
          profile: {
            ...currentState.profile,
            stats: {
              ...currentState.profile.stats,
              [stat]: clampInt(value, 1, 6, currentState.profile.stats[stat])
            }
          }
        };
      }
      case 'SOCIALLINKS_SET_RANK': {
        const { arcana, value } = action.payload;
        if (!options.arcanaOrder.includes(arcana)) {
          return currentState;
        }
        return {
          ...currentState,
          socialLinks: {
            ...currentState.socialLinks,
            ranks: {
              ...currentState.socialLinks.ranks,
              [arcana]: clampInt(value, 0, 10, currentState.socialLinks.ranks[arcana] || 0)
            }
          }
        };
      }
      case 'OBJECTIVE_SET_COMPLETE': {
        const { id, complete } = action.payload || {};
        if (typeof id !== 'string' || !id) {
          return currentState;
        }
        const currentValue = Boolean(currentState.objectives[id]);
        if (currentValue === Boolean(complete)) {
          return currentState;
        }
        return {
          ...currentState,
          objectives: {
            ...currentState.objectives,
            [id]: Boolean(complete)
          }
        };
      }
      case 'LINKED_EPISODE_SET_COMPLETE': {
        const { id, complete } = action.payload || {};
        if (typeof id !== 'string' || !id) {
          return currentState;
        }
        const currentValue = Boolean(currentState.linkedEpisodes.completed[id]);
        if (currentValue === Boolean(complete)) {
          return currentState;
        }
        return {
          ...currentState,
          linkedEpisodes: {
            completed: {
              ...currentState.linkedEpisodes.completed,
              [id]: Boolean(complete)
            },
            skipped: {
              ...currentState.linkedEpisodes.skipped,
              [id]: false
            }
          }
        };
      }
      case 'LINKED_EPISODE_SET_SKIPPED': {
        const { id, skipped } = action.payload || {};
        if (typeof id !== 'string' || !id) {
          return currentState;
        }
        const currentValue = Boolean(currentState.linkedEpisodes.skipped[id]);
        if (currentValue === Boolean(skipped)) {
          return currentState;
        }
        return {
          ...currentState,
          linkedEpisodes: {
            completed: {
              ...currentState.linkedEpisodes.completed,
              [id]: false
            },
            skipped: {
              ...currentState.linkedEpisodes.skipped,
              [id]: Boolean(skipped)
            }
          }
        };
      }
      case 'FUSION_SET_DLC_ENABLED':
        return {
          ...currentState,
          fusionSettings: {
            ...currentState.fusionSettings,
            dlcEnabled: Boolean(action.payload)
          }
        };
      case 'FUSION_SET_MANUAL_UNLOCK': {
        const { key, unlocked } = action.payload || {};
        if (typeof key !== 'string' || !key) {
          return currentState;
        }
        const currentValue = Boolean(currentState.fusionSettings.manualUnlocks[key]);
        if (currentValue === Boolean(unlocked)) {
          return currentState;
        }
        return {
          ...currentState,
          fusionSettings: {
            ...currentState.fusionSettings,
            manualUnlocks: {
              ...currentState.fusionSettings.manualUnlocks,
              [key]: Boolean(unlocked)
            }
          }
        };
      }
      case 'STATE_IMPORT':
        return sanitizeState(action.payload, options);
      case 'STATE_RESET':
        return sanitizeState({}, options);
      default:
        return currentState;
    }
  }

  function dispatch(action) {
    const nextState = reducer(state, action);
    if (nextState === state) {
      return getState();
    }
    return setState(nextState);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  function loadFromStorage() {
    state = readPersistedState(localStorageRef, options);
    persist();
    const snapshot = getState();
    emit(snapshot);
    return snapshot;
  }

  function saveToStorage() {
    persist();
  }

  function exportSave() {
    const snapshot = getState();
    return {
      version: snapshot.version,
      roster: snapshot.roster,
      profile: snapshot.profile,
      socialLinks: snapshot.socialLinks,
      objectives: snapshot.objectives,
      linkedEpisodes: snapshot.linkedEpisodes,
      fusionSettings: snapshot.fusionSettings,
      exportedAt: new Date().toISOString()
    };
  }

  function importSave(rawData) {
    validateImportedPayload(rawData);
    return dispatch({
      type: 'STATE_IMPORT',
      payload: {
        version: rawData.version,
        roster: rawData.roster,
        profile: rawData.profile,
        socialLinks: rawData.socialLinks,
        objectives: rawData.objectives,
        linkedEpisodes: rawData.linkedEpisodes,
        fusionSettings: rawData.fusionSettings
      }
    });
  }

  persist();

  return {
    getState,
    subscribe,
    dispatch,
    loadFromStorage,
    saveToStorage,
    exportSave,
    importSave
  };
}

window.createStore = createStore;
})();
