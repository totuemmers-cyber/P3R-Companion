(() => {
const RUN_STATE_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date) {
  return `${MONTH_NAMES[date.month]} ${date.day}`;
}

function buildMonthOptions(selectedMonth) {
  return RUN_STATE_MONTHS.map(
    (month) => `<option value="${month}"${month === selectedMonth ? ' selected' : ''}>${escapeHtml(MONTH_NAMES[month])}</option>`
  ).join('');
}

function buildDayOptions(month, selectedDay) {
  const maxDay = DAYS_IN_MONTH[month] || 31;
  const safeDay = Math.min(selectedDay, maxDay);
  let html = '';
  for (let day = 1; day <= maxDay; day += 1) {
    html += `<option value="${day}"${day === safeDay ? ' selected' : ''}>${day}</option>`;
  }
  return html;
}

function buildStatOptions(stat, selectedValue) {
  return SOCIAL_STATS[stat]
    .map(
      (label, index) =>
        `<option value="${index + 1}"${index + 1 === selectedValue ? ' selected' : ''}>${index + 1} - ${escapeHtml(label)}</option>`
    )
    .join('');
}

function renderReadonlyItem(label, value) {
  return `<div class="run-state-readonly-item"><span class="run-state-readonly-label">${escapeHtml(
    label
  )}</span><span class="run-state-readonly-value">${escapeHtml(value)}</span></div>`;
}

function getCurrentBlockLabel(floor) {
  if (typeof BLOCKS === 'undefined') {
    return 'Unknown';
  }
  const block = BLOCKS.find((entry) => floor >= entry.fMin && floor <= entry.fMax);
  return block ? `${block.name} (${block.floors})` : 'Outside Tartarus';
}

function renderEditableField(label, field, controlHtml) {
  return `<label class="run-state-field"><span class="run-state-label">${escapeHtml(
    label
  )}</span>${controlHtml.replace('__FIELD__', escapeHtml(field))}</label>`;
}

function renderFields(profile, fields, readOnly) {
  const parts = [];

  fields.forEach((field) => {
    if (field === 'date') {
      if (readOnly) {
        parts.push(renderReadonlyItem('Date', formatDate(profile.gameDate)));
      } else {
        parts.push(
          renderEditableField(
            'Month',
            'month',
            `<select data-rs-field="__FIELD__">${buildMonthOptions(profile.gameDate.month)}</select>`
          )
        );
        parts.push(
          renderEditableField(
            'Day',
            'day',
            `<select data-rs-field="__FIELD__">${buildDayOptions(profile.gameDate.month, profile.gameDate.day)}</select>`
          )
        );
      }
      return;
    }

    if (field === 'level') {
      if (readOnly) {
        parts.push(renderReadonlyItem('Player Level', `Lv ${profile.playerLevel}`));
      } else {
        parts.push(
          renderEditableField(
            'Player Level',
            'level',
            `<input data-rs-field="__FIELD__" type="number" min="1" max="99" value="${profile.playerLevel}" />`
          )
        );
      }
      return;
    }

    if (field === 'floor') {
      if (readOnly) {
        parts.push(renderReadonlyItem('Current Floor', `${profile.currentFloor}F`));
      } else {
        parts.push(
          renderEditableField(
            'Current Floor',
            'floor',
            `<input data-rs-field="__FIELD__" type="number" min="2" max="264" value="${profile.currentFloor}" />`
          )
        );
      }
      return;
    }

    if (field === 'block') {
      parts.push(renderReadonlyItem('Current Block', getCurrentBlockLabel(profile.currentFloor)));
      return;
    }

    if (['academics', 'charm', 'courage'].includes(field)) {
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      if (readOnly) {
        parts.push(renderReadonlyItem(label, `${profile.stats[field]} - ${SOCIAL_STATS[field][profile.stats[field] - 1]}`));
      } else {
        parts.push(
          renderEditableField(
            label,
            field,
            `<select data-rs-field="__FIELD__">${buildStatOptions(field, profile.stats[field])}</select>`
          )
        );
      }
    }
  });

  return parts.join('');
}

function mountRunStatePanel({
  root,
  store,
  selector,
  title,
  subtitle = '',
  note = '',
  fields = [],
  readOnly = false
}) {
  const container = root?.querySelector(selector);
  let renderQueued = false;
  if (!container || container.dataset.runStateMounted === '1') {
    return;
  }

  function render() {
    const profile = store.getState().profile;
    const gridClass = readOnly ? 'run-state-readonly-grid' : 'run-state-grid';

    container.innerHTML = `
      <div class="run-state-panel${readOnly ? ' is-readonly' : ''}">
        <div class="run-state-header">
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="run-state-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <div class="${gridClass}">
          ${renderFields(profile, fields, readOnly)}
        </div>
        ${note ? `<p class="run-state-note">${escapeHtml(note)}</p>` : ''}
      </div>
    `;
  }

  function scheduleRender() {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    const run = () => {
      renderQueued = false;
      render();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  }

  function onChange(event) {
    const target = event.target;
    const field = target?.dataset?.rsField;
    if (!field || readOnly) {
      return;
    }

    if (field === 'month' || field === 'day') {
      const monthSelect = container.querySelector('[data-rs-field="month"]');
      const daySelect = container.querySelector('[data-rs-field="day"]');
      const nextMonth = Number(monthSelect?.value);
      const maxDay = DAYS_IN_MONTH[nextMonth] || 31;
      const nextDay = Math.min(Number(daySelect?.value), maxDay);
      store.dispatch({
        type: 'PROFILE_SET_DATE',
        payload: {
          month: nextMonth,
          day: nextDay
        }
      });
      return;
    }

    if (field === 'level') {
      store.dispatch({
        type: 'PROFILE_SET_LEVEL',
        payload: Number(target.value)
      });
      return;
    }

    if (field === 'floor') {
      const value = Number(target.value);
      if (!Number.isFinite(value) || value < 2 || value > 264) {
        return;
      }
      store.dispatch({
        type: 'PROFILE_SET_FLOOR',
        payload: value
      });
      return;
    }

    if (['academics', 'charm', 'courage'].includes(field)) {
      store.dispatch({
        type: 'PROFILE_SET_STAT',
        payload: {
          stat: field,
          value: Number(target.value)
        }
      });
    }
  }

  container.dataset.runStateMounted = '1';
  container.addEventListener('change', onChange);
  store.subscribe(scheduleRender);
  render();
}

window.mountRunStatePanel = mountRunStatePanel;
})();
