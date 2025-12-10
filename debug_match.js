const axios = require('axios');
require('dotenv').config();

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION = process.env.RIOT_REGION || 'europe';
const PLATFORM = process.env.RIOT_PLATFORM || 'euw1';

const api = axios.create({
    headers: { 'X-Riot-Token': RIOT_API_KEY }
});

async function debugMatch() {
    const gameName = 'Kazors';
    const tagLine = 'KEUM';

    console.log(`Fetching PUUID for ${gameName}#${tagLine}...`);
    const accountRes = await api.get(`https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`);
    const puuid = accountRes.data.puuid;

    console.log(`Fetching last match for PUUID: ${puuid}...`);
    const matchesRes = await api.get(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1`);
    const matchId = matchesRes.data[0];
    console.log(`Match ID: ${matchId}`);

    console.log(`Fetching match details...`);
    const matchDetails = await api.get(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`);
    
    const participant = matchDetails.data.info.participants.find(p => p.puuid === puuid);
    
    console.log('\n--- PARTICIPANT DATA (Search for Rank/Tier) ---');
    // Log specific fields that might contain rank info
    console.log('summonerName:', participant.summonerName);
    console.log('summonerId:', participant.summonerId);
    console.log('win:', participant.win);
    
    // Check for hidden rank info
    const keys = Object.keys(participant);
    const rankKeys = keys.filter(k => k.toLowerCase().includes('rank') || k.toLowerCase().includes('tier') || k.toLowerCase().includes('league'));
    
    if (rankKeys.length > 0) {
        console.log('Found potential rank keys:', rankKeys);
        rankKeys.forEach(k => console.log(`${k}:`, participant[k]));
    } else {
        console.log('No obvious rank keys found in participant data.');
    }

    console.log('\n--- FULL PARTICIPANT OBJECT (First level) ---');
    console.log(Object.keys(participant));
}

debugMatch();
