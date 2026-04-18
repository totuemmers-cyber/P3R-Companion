(() => {
let profileRoot;
let profileStore;
let initialized = false;

function getProfileState() {
  return profileStore.getState().profile;
}

function updateDayOptions(selectedMonth, selectedDay) {
  const daySelect = profileRoot.querySelector('#profile-day');
  if (!daySelect) {
    return;
  }
  const maxDay = DAYS_IN_MONTH[selectedMonth] || 31;
  daySelect.innerHTML = '';
  for (let day = 1; day <= maxDay; day += 1) {
    const option = document.createElement('option');
    option.value = String(day);
    option.textContent = String(day);
    daySelect.appendChild(option);
  }
  daySelect.value = String(Math.min(selectedDay, maxDay));
}

function renderProfile() {
  const profile = getProfileState();
  const monthSelect = profileRoot.querySelector('#profile-month');
  if (monthSelect && !monthSelect.dataset.init) {
    monthSelect.dataset.init = '1';
    monthSelect.innerHTML = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1]
      .map((month) => `<option value="${month}">${MONTH_NAMES[month]}</option>`)
      .join('');
  }
  if (monthSelect) {
    monthSelect.value = String(profile.gameDate.month);
  }

  updateDayOptions(profile.gameDate.month, profile.gameDate.day);

  const levelInput = profileRoot.querySelector('#profile-level');
  if (levelInput) {
    levelInput.value = String(profile.playerLevel);
  }

  ['academics', 'charm', 'courage'].forEach((stat) => {
    const select = profileRoot.querySelector(`#profile-${stat}`);
    if (select && !select.dataset.init) {
      select.dataset.init = '1';
      select.innerHTML = SOCIAL_STATS[stat]
        .map((label, index) => `<option value="${index + 1}">${index + 1} - ${label}</option>`)
        .join('');
    }
    if (select) {
      select.value = String(profile.stats[stat]);
    }
  });
}

function onDateChange() {
  const monthSelect = profileRoot.querySelector('#profile-month');
  const daySelect = profileRoot.querySelector('#profile-day');
  const month = Number(monthSelect.value);
  updateDayOptions(month, Number(daySelect.value));
  profileStore.dispatch({
    type: 'PROFILE_SET_DATE',
    payload: {
      month,
      day: Number(profileRoot.querySelector('#profile-day').value)
    }
  });
}

function onLevelChange() {
  const levelInput = profileRoot.querySelector('#profile-level');
  profileStore.dispatch({
    type: 'PROFILE_SET_LEVEL',
    payload: Number(levelInput.value)
  });
}

function onStatChange(event) {
  const stat = event.target.id.replace('profile-', '');
  profileStore.dispatch({
    type: 'PROFILE_SET_STAT',
    payload: {
      stat,
      value: Number(event.target.value)
    }
  });
}

function initProfile({ root, store }) {
  if (initialized) {
    return;
  }

  profileRoot = root;
  profileStore = store;
  initialized = true;

  profileRoot.querySelector('#profile-month')?.addEventListener('change', onDateChange);
  profileRoot.querySelector('#profile-day')?.addEventListener('change', onDateChange);
  profileRoot.querySelector('#profile-level')?.addEventListener('change', onLevelChange);
  ['academics', 'charm', 'courage'].forEach((stat) => {
    profileRoot.querySelector(`#profile-${stat}`)?.addEventListener('change', onStatChange);
  });

  profileStore.subscribe(renderProfile);
  renderProfile();
}

window.initProfile = initProfile;
})();
