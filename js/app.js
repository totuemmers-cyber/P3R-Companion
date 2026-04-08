// P3R Companion — App Controller
document.addEventListener('DOMContentLoaded', function() {
  var tabs = document.querySelectorAll('.app-nav-tab');
  var sections = document.querySelectorAll('.app-section');
  var initialized = {};

  function switchSection(name) {
    tabs.forEach(function(t) { t.classList.toggle('active', t.dataset.section === name); });
    sections.forEach(function(s) { s.classList.toggle('active', s.id === name); });
    if (!initialized[name]) {
      initialized[name] = true;
      if (name === 'tartarus') initTartarus();
      if (name === 'velvet') initVelvet();
      if (name === 'social-links') initSocialLinks();
    }
  }

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() { switchSection(this.dataset.section); });
  });

  // Init first section
  switchSection('tartarus');

  // ========== SAVE / LOAD SYSTEM ==========
  var overlay = document.getElementById('save-modal-overlay');
  var gearBtn = document.getElementById('save-gear-btn');
  var closeBtn = document.getElementById('save-modal-close');
  var exportFeedback = document.getElementById('save-export-feedback');
  var importFeedback = document.getElementById('save-import-feedback');

  function openSaveModal() { overlay.classList.add('active'); }
  function closeSaveModal() {
    overlay.classList.remove('active');
    exportFeedback.textContent = '';
    importFeedback.textContent = '';
  }

  gearBtn.addEventListener('click', openSaveModal);
  closeBtn.addEventListener('click', closeSaveModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeSaveModal();
  });

  function collectData() {
    return {
      version: 1,
      roster: JSON.parse(localStorage.getItem('p3r-roster') || '[]'),
      socialLinks: JSON.parse(localStorage.getItem('p3r-social-links') || 'null'),
      exportedAt: new Date().toISOString()
    };
  }

  function showFeedback(el, msg, isError) {
    el.textContent = msg;
    el.className = 'save-feedback ' + (isError ? 'error' : 'success');
  }

  // Download .json
  document.getElementById('save-download').addEventListener('click', function() {
    var data = collectData();
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'p3r-companion-save.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback(exportFeedback, 'Downloaded!', false);
  });

  // Copy share code
  document.getElementById('save-copy-code').addEventListener('click', function() {
    var data = collectData();
    var code = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    navigator.clipboard.writeText(code).then(function() {
      showFeedback(exportFeedback, 'Share code copied to clipboard!', false);
    }, function() {
      showFeedback(exportFeedback, 'Failed to copy — try downloading instead.', true);
    });
  });

  function importData(json) {
    if (!json || typeof json !== 'object' || !json.version) {
      showFeedback(importFeedback, 'Invalid save data — missing version field.', true);
      return;
    }
    if (Array.isArray(json.roster)) {
      localStorage.setItem('p3r-roster', JSON.stringify(json.roster));
    }
    if (json.socialLinks && typeof json.socialLinks === 'object') {
      localStorage.setItem('p3r-social-links', JSON.stringify(json.socialLinks));
    }
    // Refresh sections
    if (window.reloadRoster) window.reloadRoster();
    if (window.reloadSocialLinks) window.reloadSocialLinks();
    showFeedback(importFeedback, 'Progress restored successfully!', false);
  }

  // File upload
  document.getElementById('save-file-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var json = JSON.parse(ev.target.result);
        importData(json);
      } catch(err) {
        showFeedback(importFeedback, 'Could not parse file — is it a valid .json?', true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Import share code
  document.getElementById('save-import-code').addEventListener('click', function() {
    var code = document.getElementById('save-code-input').value.trim();
    if (!code) {
      showFeedback(importFeedback, 'Paste a share code first.', true);
      return;
    }
    try {
      var json = JSON.parse(decodeURIComponent(escape(atob(code))));
      importData(json);
    } catch(err) {
      showFeedback(importFeedback, 'Invalid share code — could not decode.', true);
    }
  });
});
