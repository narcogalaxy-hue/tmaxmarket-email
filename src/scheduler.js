const activeTimers = new Map();
let useUnref = true;

function setUnref(val) {
  useUnref = val;
}

function scheduleEmail(id, delayMs, callback) {
  if (activeTimers.has(id)) {
    clearTimeout(activeTimers.get(id));
  }
  const timer = setTimeout(async () => {
    activeTimers.delete(id);
    try {
      await callback();
    } catch (err) {
      console.error(`Scheduled email ${id} failed:`, err);
    }
  }, delayMs);

  if (useUnref && timer.unref) timer.unref();

  activeTimers.set(id, timer);
  return id;
}

function cancelScheduled(id) {
  if (activeTimers.has(id)) {
    clearTimeout(activeTimers.get(id));
    activeTimers.delete(id);
    return true;
  }
  return false;
}

function getActiveCount() {
  return activeTimers.size;
}

function clearAll() {
  for (const [id, timer] of activeTimers) {
    clearTimeout(timer);
  }
  activeTimers.clear();
}

module.exports = { scheduleEmail, cancelScheduled, getActiveCount, clearAll, setUnref };
