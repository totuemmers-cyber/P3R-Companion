(() => {
const REMINDER_GROUP_ORDER = ['overdue', 'today', 'soon', 'later', 'done'];
const REMINDER_GROUP_LABELS = {
  overdue: 'Overdue',
  today: 'Today',
  soon: 'Soon',
  later: 'Later',
  done: 'Done'
};

function dateToNum(date) {
  if (!date || !Number.isFinite(date.month) || !Number.isFinite(date.day)) {
    return 99999;
  }
  const month = date.month >= 4 ? date.month : date.month + 12;
  return month * 100 + date.day;
}

function daysBetween(left, right) {
  if (!left || !right) {
    return 999;
  }
  const leftYear = left.month >= 4 ? 2009 : 2010;
  const rightYear = right.month >= 4 ? 2009 : 2010;
  const leftDate = new Date(leftYear, left.month - 1, left.day);
  const rightDate = new Date(rightYear, right.month - 1, right.day);
  return Math.round((rightDate - leftDate) / 86400000);
}

function getReminderGroup(reminder, currentDate) {
  if (reminder.status === 'done') {
    return 'done';
  }
  const daysLeft = daysBetween(currentDate, reminder.date);
  if (daysLeft < 0) {
    return 'overdue';
  }
  if (daysLeft === 0) {
    return 'today';
  }
  if (daysLeft <= 7) {
    return 'soon';
  }
  return 'later';
}

function priorityWeight(priority) {
  if (priority === 'critical') return 30;
  if (priority === 'high') return 20;
  if (priority === 'low') return 0;
  return 10;
}

function enrichReminder(reminder, currentDate) {
  const group = getReminderGroup(reminder, currentDate);
  const daysLeft = daysBetween(currentDate, reminder.date);
  const urgencyScore =
    group === 'overdue'
      ? 100 + Math.abs(daysLeft)
      : group === 'today'
        ? 90
        : group === 'soon'
          ? 60 - daysLeft
          : group === 'later'
            ? 20 - Math.min(daysLeft, 20)
            : 0;
  return {
    ...reminder,
    group,
    daysLeft,
    urgencyScore: urgencyScore + priorityWeight(reminder.priority)
  };
}

function createReminderPlannerModel(snapshot) {
  const currentDate = snapshot.profile?.gameDate || { month: 4, day: 7 };
  const reminders = (snapshot.reminders || [])
    .map((reminder) => enrichReminder(reminder, currentDate))
    .sort((left, right) => {
      const groupDelta = REMINDER_GROUP_ORDER.indexOf(left.group) - REMINDER_GROUP_ORDER.indexOf(right.group);
      if (groupDelta) return groupDelta;
      return dateToNum(left.date) - dateToNum(right.date) || right.urgencyScore - left.urgencyScore || left.title.localeCompare(right.title);
    });
  const active = reminders.filter((reminder) => reminder.status !== 'done');
  const urgent = active
    .filter(
      (reminder) =>
        reminder.group === 'overdue' ||
        reminder.group === 'today' ||
        (reminder.group === 'soon' && (reminder.priority === 'critical' || reminder.priority === 'high'))
    )
    .sort((left, right) => right.urgencyScore - left.urgencyScore)
    .slice(0, 3);

  return {
    reminders,
    groups: Object.fromEntries(REMINDER_GROUP_ORDER.map((group) => [group, reminders.filter((reminder) => reminder.group === group)])),
    urgent,
    routePicks: urgent.slice(0, 1),
    summary: {
      activeCount: active.length,
      todayCount: active.filter((reminder) => reminder.group === 'today').length,
      overdueCount: active.filter((reminder) => reminder.group === 'overdue').length,
      soonCount: active.filter((reminder) => reminder.group === 'soon').length
    }
  };
}

function formatReminderDate(date) {
  if (!date) {
    return 'No date';
  }
  return `${MONTH_NAMES[date.month] || date.month} ${date.day}`;
}

window.p3rReminders = {
  groupOrder: REMINDER_GROUP_ORDER,
  groupLabels: REMINDER_GROUP_LABELS,
  createReminderPlannerModel,
  formatReminderDate
};
})();
