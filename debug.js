const axios = require('axios');
require('dotenv').config();

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION = process.env.RIOT_REGION || 'europe';
const PLATFORM = process.env.RIOT_PLATFORM || 'euw1';

console.log('--- CONFIGURATION ---');
console.log('API KEY:', RIOT_API_KEY ? 'Present' : 'MISSING');
console.log('REGION:', REGION);
console.log('PLATFORM:', PLATFORM);
console.log('---------------------');

const api = axios.create({
    headers: { 'X-Riot-Token': RIOT_API_KEY }
});

async function runDebug() {
    const gameName = 'Kazors';
    const tagLine = 'KEUM';

    console.log(`\n1. Fetching PUUID for ${gameName}#${tagLine}...`);
    try {
        const accountUrl = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
        console.log(`   URL: ${accountUrl}`);
        const accountRes = await api.get(accountUrl);
        console.log('   SUCCESS! PUUID:', accountRes.data.puuid);
        
        const puuid = accountRes.data.puuid;

        console.log(`\n2. Fetching Summoner for PUUID: ${puuid}...`);
        const summonerUrl = `https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
        console.log(`   URL: ${summonerUrl}`);
        
        const summonerRes = await api.get(summonerUrl);
        console.log('   RESPONSE STATUS:', summonerRes.status);
        console.log('   RESPONSE HEADERS:', JSON.stringify(summonerRes.headers['content-type']));
        console.log('   RESPONSE DATA (RAW):');
        console.dir(summonerRes.data, { depth: null });

        if (!summonerRes.data.id) {
            console.error('\n   ❌ ERROR: The "id" field is MISSING from the response!');
        } else {
            console.log('\n   ✅ SUCCESS: Summoner ID found:', summonerRes.data.id);
        }

    } catch (error) {
        console.error('\n   ❌ ERROR OCCURRED:');
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        } else {
            console.error('   Message:', error.message);
        }
    }
}

runDebug();
