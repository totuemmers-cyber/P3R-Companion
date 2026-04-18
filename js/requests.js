(() => {
let requestsRoot;
let requestsStore;
let initialized = false;

const requestState = {
  query: '',
  category: '',
  status: 'open',
  selectedId: null
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSnapshot() {
  return requestsStore.getState();
}

function parseMonthDayLabel(label) {
  if (!label || typeof label !== 'string') {
    return null;
  }
  const parts = label.replace(',', '').split('/');
  if (parts.length === 2) {
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    if (Number.isFinite(month) && Number.isFinite(day)) {
      return { month, day };
    }
  }

  const textParts = label.replace(',', '').split(/\s+/);
  if (textParts.length >= 2) {
    const month = MONTH_NAME_TO_NUM[textParts[0]];
    const day = Number(textParts[1]);
    if (month && Number.isFinite(day)) {
      return { month, day };
    }
  }
  return null;
}

function dateToNum(date) {
  const month = date.month >= 4 ? date.month : date.month + 12;
  return month * 100 + date.day;
}

function compareDates(left, right) {
  return dateToNum(left) - dateToNum(right);
}

function daysBetween(left, right) {
  const leftYear = left.month >= 4 ? 2009 : 2010;
  const rightYear = right.month >= 4 ? 2009 : 2010;
  const leftDate = new Date(leftYear, left.month - 1, left.day);
  const rightDate = new Date(rightYear, right.month - 1, right.day);
  return Math.round((rightDate - leftDate) / 86400000);
}

function isRequestComplete(snapshot, requestId) {
  return Boolean(snapshot.objectives?.[requestId]);
}

function getRequestStatus(request, snapshot) {
  const currentDate = snapshot.profile.gameDate;
  const availableDate = parseMonthDayLabel(request.available);
  const deadlineDate = parseMonthDayLabel(request.deadline);

  if (isRequestComplete(snapshot, request.id)) {
    return { state: 'complete', label: 'Completed', daysLeft: null };
  }
  if (availableDate && compareDates(currentDate, availableDate) < 0) {
    const daysLeft = daysBetween(currentDate, availableDate);
    return {
      state: 'upcoming',
      label: `Opens ${request.available}`,
      daysLeft
    };
  }
  if (deadlineDate) {
    const daysLeft = daysBetween(currentDate, deadlineDate);
    if (daysLeft < 0) {
      return {
        state: 'expired',
        label: `Expired ${request.deadline}`,
        daysLeft
      };
    }
    if (daysLeft <= 5) {
      return {
        state: 'soon',
        label: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
        daysLeft
      };
    }
  }
  return {
    state: 'open',
    label: request.deadline ? `Deadline ${request.deadline}` : 'Open',
    daysLeft: deadlineDate ? daysBetween(currentDate, deadlineDate) : null
  };
}

function getVisibleRequests(snapshot) {
  return ELIZABETH_REQUESTS.filter((request) => {
    const availableDate = parseMonthDayLabel(request.available);
    return !availableDate || compareDates(snapshot.profile.gameDate, availableDate) >= 0;
  });
}

function getUpcomingRequests(snapshot) {
  return ELIZABETH_REQUESTS
    .filter((request) => {
      const availableDate = parseMonthDayLabel(request.available);
      return availableDate && compareDates(snapshot.profile.gameDate, availableDate) < 0;
    })
    .sort((left, right) => {
      const leftDate = parseMonthDayLabel(left.available);
      const rightDate = parseMonthDayLabel(right.available);
      return compareDates(leftDate, rightDate) || left.number - right.number;
    });
}

function getFilteredRequests(snapshot) {
  const query = requestState.query.trim().toLowerCase();
  return getVisibleRequests(snapshot).filter((request) => {
    if (requestState.category && request.category !== requestState.category) {
      return false;
    }

    const status = getRequestStatus(request, snapshot);
    if (requestState.status === 'open' && !['open', 'soon', 'expired'].includes(status.state)) {
      return false;
    }
    if (requestState.status === 'completed' && status.state !== 'complete') {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      request.number,
      request.title,
      request.reward,
      request.solution,
      request.prerequisite || '',
      request.targetPersona || '',
      request.targetSkill || '',
      request.categoryLabel
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

function ensureSelection(requests) {
  if (!requests.length) {
    requestState.selectedId = null;
    return;
  }
  if (requestState.selectedId && requests.some((request) => request.id === requestState.selectedId)) {
    return;
  }
  requestState.selectedId = requests[0].id;
}

function renderSummary(snapshot) {
  const visible = getVisibleRequests(snapshot);
  const completed = visible.filter((request) => isRequestComplete(snapshot, request.id)).length;
  const open = visible.length - completed;
  const upcoming = getUpcomingRequests(snapshot);
  const expired = visible.filter((request) => getRequestStatus(request, snapshot).state === 'expired').length;

  requestsRoot.querySelector('#requests-summary').innerHTML = `
    <div class="requests-summary-pill">
      <span class="requests-summary-label">Visible now</span>
      <span class="requests-summary-value">${visible.length}</span>
      <span class="requests-summary-copy">Requests available as of ${escapeHtml(
        `${snapshot.profile.gameDate.month}/${snapshot.profile.gameDate.day}`
      )}.</span>
    </div>
    <div class="requests-summary-pill">
      <span class="requests-summary-label">Open</span>
      <span class="requests-summary-value">${open}</span>
      <span class="requests-summary-copy">Unfinished requests you can work on right now.</span>
    </div>
    <div class="requests-summary-pill">
      <span class="requests-summary-label">Completed</span>
      <span class="requests-summary-value">${completed}</span>
      <span class="requests-summary-copy">Saved through the same progress export as the rest of the app.</span>
    </div>
    <div class="requests-summary-pill">
      <span class="requests-summary-label">Coming soon</span>
      <span class="requests-summary-value">${upcoming.length}</span>
      <span class="requests-summary-copy">${
        expired > 0 ? `${expired} expired request${expired === 1 ? '' : 's'} still visible.` : 'Later waves stay hidden until they unlock.'
      }</span>
    </div>
  `;
}

function renderUpcoming(snapshot) {
  const upcoming = getUpcomingRequests(snapshot).slice(0, 4);
  const container = requestsRoot.querySelector('#requests-upcoming');
  if (!upcoming.length) {
    container.classList.remove('has-items');
    container.innerHTML = '';
    return;
  }

  container.classList.add('has-items');
  container.innerHTML = `
    <h2 class="requests-upcoming-title">Coming up next</h2>
    <div class="requests-upcoming-list">
      ${upcoming
        .map(
          (request) => `
            <div class="requests-upcoming-item">
              <span class="requests-upcoming-date">${escapeHtml(request.available || 'Later')}</span>
              <span class="requests-upcoming-name">#${request.number} ${escapeHtml(request.title)}</span>
            </div>`
        )
        .join('')}
    </div>
  `;
}

function buildStatusChip(status) {
  if (status.state === 'complete') {
    return 'request-chip status-complete';
  }
  if (status.state === 'expired') {
    return 'request-chip status-expired';
  }
  if (status.state === 'soon') {
    return 'request-chip status-soon';
  }
  return 'request-chip';
}

function renderList(snapshot) {
  const filtered = getFilteredRequests(snapshot);
  ensureSelection(filtered);

  const container = requestsRoot.querySelector('#requests-list');
  if (!filtered.length) {
    container.innerHTML = `
      <div class="requests-empty">
        No currently visible Elizabeth request matches these filters. Later requests stay hidden until their unlock date.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((request) => {
      const status = getRequestStatus(request, snapshot);
      const isActive = request.id === requestState.selectedId;
      return `
        <article class="request-item${isActive ? ' active' : ''}" data-request-id="${escapeHtml(request.id)}">
          <div class="request-item-top">
            <div class="request-item-name">#${request.number} ${escapeHtml(request.title)}</div>
            <div class="request-item-number">${escapeHtml(request.available || 'Open')}</div>
          </div>
          <div class="request-chip-row">
            <span class="request-chip system">${escapeHtml(request.systemLabel)}</span>
            <span class="request-chip">${escapeHtml(request.categoryLabel)}</span>
            <span class="request-chip reward">${escapeHtml(request.reward || 'Reward unknown')}</span>
            ${request.deadline ? `<span class="request-chip deadline">Deadline ${escapeHtml(request.deadline)}</span>` : ''}
            <span class="${buildStatusChip(status)}">${escapeHtml(status.label)}</span>
          </div>
          <div class="request-item-copy">${escapeHtml(request.solution || 'Open the detail panel for the compact completion guide.')}</div>
        </article>
      `;
    })
    .join('');
}

function renderDetail(snapshot) {
  const filtered = getFilteredRequests(snapshot);
  const selected =
    filtered.find((request) => request.id === requestState.selectedId) ||
    getVisibleRequests(snapshot).find((request) => request.id === requestState.selectedId) ||
    null;
  const container = requestsRoot.querySelector('#requests-detail');

  if (!selected) {
    container.innerHTML = `
      <div class="requests-detail-empty">
        <h2>Select a request</h2>
        <div>Pick any visible Elizabeth request to see its reward, timing, prerequisite, and compact solution.</div>
      </div>
    `;
    return;
  }

  const status = getRequestStatus(selected, snapshot);
  const actions = [];
  if (selected.floor) {
    actions.push(
      `<button class="request-action-btn" data-action="tartarus-floor" data-floor="${selected.floor}">Open Floor ${selected.floor}F</button>`
    );
  } else if (selected.system === 'tartarus') {
    actions.push('<button class="request-action-btn" data-action="tartarus">Open Tartarus</button>');
  }

  if (selected.targetPersona && PERSONAS[selected.targetPersona]) {
    actions.push(
      `<button class="request-action-btn" data-action="velvet-target" data-target="${escapeHtml(selected.targetPersona)}">Open ${escapeHtml(
        selected.targetPersona
      )} in Velvet</button>`
    );
  } else if (selected.system === 'velvet') {
    actions.push('<button class="request-action-btn" data-action="velvet">Open Velvet Room</button>');
  }

  container.innerHTML = `
    <div class="request-detail-head">
      <div>
        <h2 class="request-detail-title">#${selected.number} ${escapeHtml(selected.title)}</h2>
        <p class="request-detail-subtitle">${escapeHtml(selected.systemLabel)} • ${escapeHtml(selected.categoryLabel)}</p>
      </div>
      <label class="request-complete-toggle">
        <input type="checkbox" data-request-toggle="${escapeHtml(selected.id)}"${isRequestComplete(snapshot, selected.id) ? ' checked' : ''}>
        <span>Completed</span>
      </label>
    </div>

    <div class="request-chip-row">
      <span class="${buildStatusChip(status)}">${escapeHtml(status.label)}</span>
      ${selected.deadline ? `<span class="request-chip deadline">Deadline ${escapeHtml(selected.deadline)}</span>` : ''}
      ${selected.targetPersona ? `<span class="request-chip system">Target ${escapeHtml(selected.targetPersona)}</span>` : ''}
      ${selected.targetSkill ? `<span class="request-chip system">Need ${escapeHtml(selected.targetSkill)}</span>` : ''}
      ${selected.floor ? `<span class="request-chip system">${selected.floor}F${selected.block ? ` • ${escapeHtml(selected.block)}` : ''}</span>` : ''}
    </div>

    <div class="request-detail-grid">
      <div class="request-detail-card">
        <span class="request-detail-label">Unlock</span>
        <span class="request-detail-value numeric">${escapeHtml(selected.available || 'Unknown')}</span>
      </div>
      <div class="request-detail-card">
        <span class="request-detail-label">Reward</span>
        <span class="request-detail-value">${escapeHtml(selected.reward || 'Unknown')}</span>
      </div>
      <div class="request-detail-card">
        <span class="request-detail-label">Category</span>
        <span class="request-detail-value">${escapeHtml(selected.categoryLabel)}</span>
      </div>
      <div class="request-detail-card">
        <span class="request-detail-label">Deadline</span>
        <span class="request-detail-value numeric">${escapeHtml(selected.deadline || 'No deadline')}</span>
      </div>
    </div>

    ${
      selected.prerequisite
        ? `<div class="request-detail-section">
            <h3>Prerequisite</h3>
            <div class="request-detail-copy">${escapeHtml(selected.prerequisite)}</div>
          </div>`
        : ''
    }

    <div class="request-detail-section">
      <h3>Compact solution</h3>
      <div class="request-detail-copy">${escapeHtml(selected.solution || 'No compact solution has been added for this request yet.')}</div>
    </div>

    ${
      actions.length
        ? `<div class="request-detail-actions">${actions.join('')}</div>`
        : ''
    }
  `;
}

function renderRequests() {
  const snapshot = getSnapshot();
  renderSummary(snapshot);
  renderUpcoming(snapshot);
  renderList(snapshot);
  renderDetail(snapshot);
}

function onInputChange(event) {
  if (event.target.id === 'requests-search') {
    requestState.query = event.target.value || '';
    renderRequests();
    return;
  }
  if (event.target.id === 'requests-category') {
    requestState.category = event.target.value || '';
    renderRequests();
    return;
  }
  if (event.target.id === 'requests-status') {
    requestState.status = event.target.value || 'open';
    renderRequests();
    return;
  }
  const toggle = event.target.closest('[data-request-toggle]');
  if (toggle) {
    requestsStore.dispatch({
      type: 'OBJECTIVE_SET_COMPLETE',
      payload: {
        id: toggle.dataset.requestToggle,
        complete: toggle.checked
      }
    });
  }
}

function onClick(event) {
  const item = event.target.closest('[data-request-id]');
  if (item) {
    requestState.selectedId = item.dataset.requestId;
    renderRequests();
    return;
  }

  const action = event.target.closest('[data-action]');
  if (!action || !window.p3rApp) {
    return;
  }
  if (action.dataset.action === 'tartarus-floor') {
    window.p3rApp.openTartarusFloor(Number(action.dataset.floor));
    return;
  }
  if (action.dataset.action === 'tartarus') {
    window.p3rApp.switchSection('tartarus');
    return;
  }
  if (action.dataset.action === 'velvet-target') {
    window.p3rApp.openFusionTarget(action.dataset.target || '');
    return;
  }
  if (action.dataset.action === 'velvet') {
    window.p3rApp.switchSection('velvet');
  }
}

function initRequests({ root, store }) {
  if (initialized) {
    return;
  }
  requestsRoot = root;
  requestsStore = store;
  initialized = true;

  requestsRoot.addEventListener('input', onInputChange);
  requestsRoot.addEventListener('change', onInputChange);
  requestsRoot.addEventListener('click', onClick);
  requestsStore.subscribe(renderRequests);
  renderRequests();
}

window.initRequests = initRequests;
})();
