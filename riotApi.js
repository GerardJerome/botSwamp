const axios = require('axios');
require('dotenv').config();

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION = process.env.RIOT_REGION || 'europe';
const PLATFORM = process.env.RIOT_PLATFORM || 'euw1';

class RateLimiter {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.recentRequests = []; // { timestamp }
        
        // Limits (Safety margin applied: 18/1s instead of 20/1s, 90/2m instead of 100/2m)
        this.shortLimit = 18; 
        this.shortWindow = 1000; // 1 second
        this.longLimit = 90; 
        this.longWindow = 120000; // 2 minutes
    }

    async add(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const now = Date.now();
            
            // Clean up old history
            this.recentRequests = this.recentRequests.filter(r => now - r.timestamp < this.longWindow);

            // Check Short Limit (20/1s)
            const shortCount = this.recentRequests.filter(r => now - r.timestamp < this.shortWindow).length;
            if (shortCount >= this.shortLimit) {
                const oldestShort = this.recentRequests.filter(r => now - r.timestamp < this.shortWindow)[0];
                const wait = this.shortWindow - (now - oldestShort.timestamp) + 100; // +100ms buffer
                // console.log(`[RateLimit] Short limit hit. Waiting ${wait}ms`);
                await new Promise(r => setTimeout(r, wait));
                continue; // Re-evaluate
            }

            // Check Long Limit (100/2m)
            const longCount = this.recentRequests.length;
            if (longCount >= this.longLimit) {
                const oldestLong = this.recentRequests[0];
                const wait = this.longWindow - (now - oldestLong.timestamp) + 1000; // +1s buffer
                console.log(`[RateLimit] Long limit hit. Waiting ${(wait/1000).toFixed(1)}s...`);
                await new Promise(r => setTimeout(r, wait));
                continue; // Re-evaluate
            }

            // Execute
            const request = this.queue.shift();
            const { fn, resolve, reject } = request;
            
            // Mark timestamp BEFORE execution to be safe
            this.recentRequests.push({ timestamp: Date.now() });
            
            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                if (error.response && error.response.status === 429) {
                    // Handle 429 explicitly
                    const retryAfter = parseInt(error.response.headers['retry-after']) || 5;
                    console.log(`[RateLimit] 429 Received! Pausing for ${retryAfter}s`);
                    
                    // Put request back in front of queue
                    this.queue.unshift(request);
                    
                    // Wait for the requested time
                    await new Promise(r => setTimeout(r, retryAfter * 1000));
                } else {
                    reject(error);
                }
            }
        }

        this.processing = false;
    }
}

const limiter = new RateLimiter();

async function rateLimitedGet(url) {
    return limiter.add(() => axios.get(url));
}

async function getPuuidByRiotId(gameName, tagLine) {
    try {
        const response = await rateLimitedGet(`https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}?api_key=${RIOT_API_KEY}`);
        return response.data.puuid;
    } catch (error) {
        console.error('Error fetching PUUID:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function getSummonerByPuuid(puuid) {
    try {
        const response = await rateLimitedGet(`https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.error(`Summoner not found on platform ${PLATFORM}. The player might be on a different server.`);
            return null;
        }
        console.error('Error fetching Summoner:', error.response ? error.response.data : error.message);
        throw error;
    }
}

async function getRankedStats(puuid) {
    try {
        console.log(`Fetching Ranked Stats for PUUID: ${puuid}...`);
        const response = await rateLimitedGet(`https://${PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching Ranked Stats:', error.response ? error.response.data : error.message);
        return [];
    }
}

async function getLastMatches(puuid, count = 5) {
    try {
        const response = await rateLimitedGet(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&api_key=${RIOT_API_KEY}`);
        const matchIds = response.data;
        
        const matches = [];
        for (const matchId of matchIds) {
            try {
                const matchDetails = await rateLimitedGet(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`);
                const participant = matchDetails.data.info.participants.find(p => p.puuid === puuid);
                
                if (participant) {
                    matches.push({
                        championName: participant.championName,
                        kills: participant.kills,
                        deaths: participant.deaths,
                        assists: participant.assists,
                        win: participant.win,
                        queueId: matchDetails.data.info.queueId,
                        gameMode: matchDetails.data.info.gameMode,
                        gameEndTimestamp: matchDetails.data.info.gameEndTimestamp
                    });
                }
            } catch (err) {
                console.error(`Error fetching match ${matchId}:`, err.message);
            }
        }
        return matches;
    } catch (error) {
        console.error('Error fetching match history:', error.response ? error.response.data : error.message);
        return [];
    }
}

async function getTopChampionStats(puuid) {
    try {
        // Fetch last 30 ranked solo matches (queue 420)
        const count = 30; 
        const response = await rateLimitedGet(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=${count}&api_key=${RIOT_API_KEY}`);
        const matchIds = response.data;
        
        const championStats = {};

        // We can fire these in parallel, the RateLimiter will queue them up correctly!
        const promises = matchIds.map(async (matchId) => {
            try {
                const matchDetails = await rateLimitedGet(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`);
                const participant = matchDetails.data.info.participants.find(p => p.puuid === puuid);
                
                if (participant) {
                    const champ = participant.championName;
                    if (!championStats[champ]) {
                        championStats[champ] = { name: champ, games: 0, wins: 0 };
                    }
                    championStats[champ].games++;
                    if (participant.win) championStats[champ].wins++;
                }
            } catch (err) {
                // Ignore individual match errors
            }
        });

        await Promise.all(promises);

        let topChamp = null;
        let maxGames = 0;

        for (const champ in championStats) {
            if (championStats[champ].games > maxGames) {
                maxGames = championStats[champ].games;
                topChamp = championStats[champ];
            }
        }

        return topChamp;
    } catch (error) {
        console.error('Error fetching top champion stats:', error.message);
        return null;
    }
}

async function getFullStats(gameName, tagLine) {
    console.log(`Fetching stats for ${gameName}#${tagLine}...`);
    
    const puuid = await getPuuidByRiotId(gameName, tagLine);
    console.log(`PUUID found: ${puuid}`);
    
    if (!puuid) {
        throw new Error('PUUID not found');
    }

    let summoner = await getSummonerByPuuid(puuid);
    
    // If summoner is null or missing ID, we create a fake one just to display the name/icon if possible
    if (!summoner) {
        summoner = {
            name: gameName,
            profileIconId: 29, // Default icon
            summonerLevel: '???'
        };
    }

    // Try to get Ranked Stats (using PUUID directly now)
    let stats = [];
    try {
        stats = await getRankedStats(puuid);
    } catch (err) {
        console.warn('Failed to fetch ranked stats via PUUID.');
    }

    // Get Match History (should work with PUUID)
    const matches = await getLastMatches(puuid);
    
    return { summoner, stats, matches };
}

module.exports = {
    getPuuidByRiotId,
    getSummonerByPuuid,
    getRankedStats,
    getLastMatches,
    getFullStats,
    getTopChampionStats
};
