const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');
const logger = createLogger('DB');

const DATA_FILE = path.join(process.cwd(), 'database.json');

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('Error loading database:', err);
    return [];
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Error saving database:', err);
  }
}

// --- Basic entry operations (now all include guildId) ---

function addEntry(key, guildId, userId, value) {
  const data = loadData();
  const size = (typeof value === 'number')
    ? value.toString().replace(/[^0-9]/g, '').length
    : String(value).length;
  const entry = {
    key,
    guildId,
    userid: userId,
    value,
    date: new Date().toISOString(),
    size,
  };
  data.push(entry);
  saveData(data);
  return entry;
}

function getEntriesByKey(key, guildId) {
  const data = loadData();
  return data.filter(entry => entry.key === key && entry.guildId === guildId);
}

function getAllKeys(guildId) {
  const data = loadData();
  return [...new Set(data
    .filter(entry => entry.guildId === guildId)
    .map(entry => entry.key)
  )];
}

function incrementEntry(key, guildId, userId, amount) {
  const data = loadData();
  const index = data.findIndex(entry => entry.key === key && entry.guildId === guildId && entry.userid === userId);
  const now = new Date().toISOString();

  if (index !== -1) {
    const oldValue = Number(data[index].value) || 0;
    const newValue = oldValue + amount;
    data[index].value = newValue;
    data[index].date = now;
    data[index].size = String(newValue).length;
    saveData(data);
    return data[index];
  } else {
    const entry = {
      key,
      guildId,
      userid: userId,
      value: amount,
      date: now,
      size: String(amount).length,
    };
    data.push(entry);
    saveData(data);
    return entry;
  }
}

function deleteEntry(key, guildId) {
  const data = loadData();
  const initialLength = data.length;
  const newData = data.filter(entry => !(entry.key === key && entry.guildId === guildId));
  if (newData.length === initialLength) return false;
  saveData(newData);
  return true;
}

function deleteEntryByUser(key, guildId, userId) {
  const data = loadData();
  const index = data.findIndex(entry => entry.key === key && entry.guildId === guildId && entry.userid === userId);
  if (index === -1) return false;
  data.splice(index, 1);
  saveData(data);
  return true;
}

function upsertEntry(key, guildId, userId, value) {
  const data = loadData();
  const index = data.findIndex(entry => entry.key === key && entry.guildId === guildId && entry.userid === userId);
  const now = new Date().toISOString();
  const size = (typeof value === 'number')
    ? value.toString().replace(/[^0-9]/g, '').length
    : String(value).length;

  if (index !== -1) {
    data[index].value = value;
    data[index].date = now;
    data[index].size = size;
    saveData(data);
    return { entry: data[index], created: false };
  } else {
    const entry = { key, guildId, userid: userId, value, date: now, size };
    data.push(entry);
    saveData(data);
    return { entry, created: true };
  }
}

function findLowestAvailableKey(guildId) {
  const data = loadData();
  const prefix = 'store_';
  const usedKeys = data
    .filter(entry => entry.guildId === guildId && entry.key.startsWith(prefix))
    .map(entry => {
      const num = parseInt(entry.key.slice(prefix.length), 10);
      return isNaN(num) ? null : num;
    })
    .filter(n => n !== null);
  if (usedKeys.length === 0) return 0;
  const maxUsed = Math.max(...usedKeys);
  for (let i = 0; i <= maxUsed + 1; i++) {
    if (!usedKeys.includes(i)) return i;
  }
  return 0;
}

// For birthday checker: get all entries for a guild by key prefix
function getEntriesByKeyPrefix(prefix, guildId) {
  const data = loadData();
  return data.filter(entry => entry.guildId === guildId && entry.key.startsWith(prefix));
}

module.exports = {
  addEntry,
  getEntriesByKey,
  getAllKeys,
  incrementEntry,
  deleteEntry,
  deleteEntryByUser,
  upsertEntry,
  findLowestAvailableKey,
  getEntriesByKeyPrefix,
};