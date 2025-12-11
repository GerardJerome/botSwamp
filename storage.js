const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE_PATH = path.join(DATA_DIR, 'stats.json');
const DAILY_FILE_PATH = path.join(DATA_DIR, 'daily_stats.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({}));
}

if (!fs.existsSync(DAILY_FILE_PATH)) {
    fs.writeFileSync(DAILY_FILE_PATH, JSON.stringify({}));
}

const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const RANKS = ["IV", "III", "II", "I"];

function convertToTotalLp(tier, rank, lp) {
    let tierIdx = TIERS.indexOf(tier);
    if (tierIdx === -1) return 0;

    // Master, Grandmaster, Challenger (Index 7+) don't use divisions like IV-I in the same way for LP calc
    // They just have raw LP. We assume a base value to compare with lower tiers.
    if (tierIdx >= 7) { 
        // Base for Master = 7 * 400 = 2800 LP
        return (7 * 400) + lp; 
    }

    let rankIdx = RANKS.indexOf(rank);
    if (rankIdx === -1) rankIdx = 0;

    // Each tier has 400 LP (4 divisions * 100 LP)
    // Each division has 100 LP
    const tierBase = tierIdx * 400;
    const rankBase = rankIdx * 100;
    
    return tierBase + rankBase + lp;
}

function getEntryTimestamp(entry) {
    if (entry.timestamp) return entry.timestamp;
    if (entry.date) {
        const parts = entry.date.split(/[\s/:]/);
        if (parts.length >= 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            const hour = parts.length >= 4 ? parseInt(parts[3], 10) : 0;
            const minute = parts.length >= 5 ? parseInt(parts[4], 10) : 0;
            const second = parts.length >= 6 ? parseInt(parts[5], 10) : 0;
            return new Date(year, month - 1, day, hour, minute, second).getTime();
        }
    }
    return 0;
}

function saveStats(puuid, queueType, tier, rank, lp) {
    try {
        let data = {};
        if (fs.existsSync(FILE_PATH)) {
            data = JSON.parse(fs.readFileSync(FILE_PATH));
        }

        if (!data[puuid]) {
            data[puuid] = [];
        }
        
        const now = Date.now();
        const d = new Date(now);
        const dateStr = `${d.getDate().toString().padStart(2, '0')}:${(d.getMonth() + 1).toString().padStart(2, '0')}:${d.getFullYear()}`;
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        
        // Get history for this queue
        const history = data[puuid].filter(e => e.queueType === queueType);
        const lastEntry = history.length > 0 ? history[history.length - 1] : null;

        // Only add new entry if stats have changed
        // We also check if timestamp is present to ensure we upgrade old entries to new format
        if (lastEntry && lastEntry.tier === tier && lastEntry.rank === rank && lastEntry.lp === lp && lastEntry.timestamp) {
            console.log(`[Storage] Stats identical to last entry for ${puuid}, skipping save.`);
            return; 
        }

        console.log(`[Storage] Saving new stats for ${puuid}: ${tier} ${rank} ${lp} LP`);
        data[puuid].push({
            date: dateStr,
            time: timeStr,
            timestamp: now,
            queueType,
            tier,
            rank,
            lp
        });
        
        fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving stats:', error);
    }
}

function getLpDiff(puuid, queueType, currentLp, currentTier, currentRank) {
    try {
        if (!fs.existsSync(FILE_PATH)) return { diff: null, message: "Start tracking..." };

        const data = JSON.parse(fs.readFileSync(FILE_PATH));
        if (!data[puuid]) return { diff: null, message: "Start tracking..." };

        const history = data[puuid].filter(entry => entry.queueType === queueType);
        
        // We need at least 2 entries to compare (Current + Previous)
        // Since saveStats is called before this, the last entry is the current state.
        if (history.length < 2) return { diff: null, message: "Start tracking..." };

        // Get the entry immediately preceding the current one
        const refEntry = history[history.length - 2];

        const now = Date.now();
        const refTs = getEntryTimestamp(refEntry);
        const currentTotal = convertToTotalLp(currentTier, currentRank, currentLp);
        const oldTotal = convertToTotalLp(refEntry.tier, refEntry.rank, refEntry.lp);
        
        const daysAgo = Math.round((now - refTs) / (1000 * 60 * 60 * 24));
        
        let dateDisplay = refEntry.date;
        if (!dateDisplay) {
            const d = new Date(refTs);
            dateDisplay = `${d.getDate().toString().padStart(2, '0')}:${(d.getMonth() + 1).toString().padStart(2, '0')}:${d.getFullYear()}`;
        }
        
        if (refEntry.time) {
            dateDisplay += ` ${refEntry.time}`;
        } else if (refEntry.timestamp) {
            const d = new Date(refEntry.timestamp);
            const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
            // Avoid duplicating time if it's somehow already in date string (unlikely with current format)
            if (!dateDisplay.includes(timeStr)) {
                dateDisplay += ` ${timeStr}`;
            }
        }

        return {
            diff: currentTotal - oldTotal,
            daysAgo: daysAgo,
            oldTier: refEntry.tier,
            oldRank: refEntry.rank,
            oldLp: refEntry.lp,
            date: dateDisplay
        };

    } catch (error) {
        console.error('Error calculating LP diff:', error);
        return null;
    }
}

function saveDailyStats(data) {
    fs.writeFileSync(DAILY_FILE_PATH, JSON.stringify(data, null, 2));
}

function getDailyStats() {
    if (!fs.existsSync(DAILY_FILE_PATH)) return {};
    return JSON.parse(fs.readFileSync(DAILY_FILE_PATH));
}

module.exports = { saveStats, getLpDiff, convertToTotalLp, saveDailyStats, getDailyStats };
