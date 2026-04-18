(() => {
function createDefaultSocialLinksState() {
  const ranks = {};
  ARCANA_LIST.forEach((arcana) => {
    ranks[arcana] = 0;
  });

  return {
    gameDate: { month: 4, day: 7 },
    stats: { academics: 1, charm: 1, courage: 1 },
    ranks
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

function bootstrap() {
  const store = createStore({
    validPersonaNames: new Set(Object.keys(PERSONAS)),
    arcanaOrder: ARCANA_LIST,
    createDefaultSocialLinksState
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

  switchSection('tartarus');

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
