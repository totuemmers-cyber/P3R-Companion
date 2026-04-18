(() => {
function createDefaultSocialLinksState() {
  const ranks = {};
  ARCANA_LIST.forEach((arcana) => {
    ranks[arcana] = 0;
  });

  return {
    ranks
  };
}

function createDefaultProfileState() {
  return {
    gameDate: { month: 4, day: 7 },
    playerLevel: 1,
    currentFloor: 2,
    stats: { academics: 1, charm: 1, courage: 1 }
  };
}

function encodeSharePayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeSharePayload(code) {
  return JSON.parse(decodeURIComponent(escape(atob(code))));
}

function downloadSave(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'p3r-companion-save.json';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function setFeedback(element, message, isError = false) {
  element.textContent = message;
  element.className = `save-feedback ${isError ? 'error' : 'success'}`;
}

function dispatchClearableInputEvents(field) {
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

function initClearableInputs() {
  const fields = document.querySelectorAll(
    'input[type="text"], input[type="search"], input[type="number"], textarea'
  );

  fields.forEach((field) => {
    if (field.dataset.noClear === 'true' || field.closest('.input-clear-wrap')) {
      return;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'input-clear-wrap';
    if (field.tagName === 'TEXTAREA') {
      wrapper.classList.add('is-textarea');
    }

    field.parentNode.insertBefore(wrapper, field);
    wrapper.appendChild(field);
    field.classList.add('input-clearable');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'input-clear-btn';
    button.setAttribute('aria-label', `Clear ${field.getAttribute('placeholder') || 'input'}`);
    button.textContent = '×';
    wrapper.appendChild(button);

    const syncVisibility = () => {
      const hasValue = field.value !== '';
      wrapper.classList.toggle('has-value', hasValue);
      button.hidden = !hasValue;
    };

    button.addEventListener('click', () => {
      if (field.value === '') {
        return;
      }
      field.value = '';
      syncVisibility();
      dispatchClearableInputEvents(field);
      field.focus();
    });

    field.addEventListener('input', syncVisibility);
    field.addEventListener('change', syncVisibility);
    syncVisibility();
  });
}

function bootstrap() {
  const store = createStore({
    validPersonaNames: new Set(Object.keys(PERSONAS)),
    arcanaOrder: ARCANA_LIST,
    createDefaultSocialLinksState,
    createDefaultProfileState
  });

  const tabs = [...document.querySelectorAll('.app-nav-tab')];
  const sections = new Map(
    [...document.querySelectorAll('.app-section')].map((section) => [section.id, section])
  );
  const initialized = new Set();

  function ensureSection(sectionName) {
    if (initialized.has(sectionName)) {
      return;
    }

    const root = sections.get(sectionName);
    if (!root) {
      return;
    }

    if (sectionName === 'tartarus') {
      initTartarus({ root, store });
    } else if (sectionName === 'planner') {
      initPlanner({ root, store });
    } else if (sectionName === 'profile') {
      initProfile({ root, store });
    } else if (sectionName === 'velvet') {
      initVelvet({ root, store });
    } else if (sectionName === 'social-links') {
      initSocialLinks({ root, store });
    }

    initialized.add(sectionName);
  }

  function switchSection(sectionName) {
    tabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.section === sectionName);
    });
    sections.forEach((section, id) => {
      section.classList.toggle('active', id === sectionName);
    });
    ensureSection(sectionName);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchSection(tab.dataset.section));
  });

  window.p3rApp = {
    switchSection,
    openSocialLinks() {
      switchSection('social-links');
    },
    openTartarusFloor(floor) {
      if (Number.isFinite(floor)) {
        store.dispatch({
          type: 'PROFILE_SET_FLOOR',
          payload: floor
        });
      }
      switchSection('tartarus');
    },
    openShadowIntel(focusName = '') {
      switchSection('tartarus');
      if (typeof window.openShadowIntelViewExternal === 'function') {
        window.openShadowIntelViewExternal(focusName);
      }
    },
    openFusionTarget(targetName) {
      switchSection('velvet');
      if (typeof window.openVelvetFusionTarget === 'function') {
        window.openVelvetFusionTarget(targetName);
      }
    }
  };

  initClearableInputs();
  switchSection('profile');

  const overlay = document.getElementById('save-modal-overlay');
  const gearButton = document.getElementById('save-gear-btn');
  const closeButton = document.getElementById('save-modal-close');
  const downloadButton = document.getElementById('save-download');
  const copyCodeButton = document.getElementById('save-copy-code');
  const fileInput = document.getElementById('save-file-input');
  const codeInput = document.getElementById('save-code-input');
  const importCodeButton = document.getElementById('save-import-code');
  const exportFeedback = document.getElementById('save-export-feedback');
  const importFeedback = document.getElementById('save-import-feedback');

  function clearFeedback() {
    exportFeedback.textContent = '';
    exportFeedback.className = 'save-feedback';
    importFeedback.textContent = '';
    importFeedback.className = 'save-feedback';
  }

  function openModal() {
    overlay.classList.add('active');
  }

  function closeModal() {
    overlay.classList.remove('active');
    clearFeedback();
  }

  function importPayload(payload) {
    store.importSave(payload);
    setFeedback(importFeedback, 'Progress restored successfully.');
  }

  gearButton.addEventListener('click', openModal);
  closeButton.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  downloadButton.addEventListener('click', () => {
    downloadSave(store.exportSave());
    setFeedback(exportFeedback, 'Downloaded.');
  });

  copyCodeButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(encodeSharePayload(store.exportSave()));
      setFeedback(exportFeedback, 'Share code copied to clipboard.');
    } catch (error) {
      setFeedback(exportFeedback, 'Failed to copy share code.', true);
    }
  });

  fileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      importPayload(JSON.parse(text));
    } catch (error) {
      setFeedback(importFeedback, 'Could not parse the selected file.', true);
    } finally {
      event.target.value = '';
    }
  });

  importCodeButton.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!code) {
      setFeedback(importFeedback, 'Paste a share code first.', true);
      return;
    }

    try {
      importPayload(decodeSharePayload(code));
    } catch (error) {
      setFeedback(importFeedback, 'Invalid share code.', true);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
})();
