const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { getFullStats, getTopChampionStats } = require('./riotApi');
const { getRandomFlame, getWeeklyFlame, getSeasonFlame } = require('./flames');

const TRACKED_PLAYERS_FILE = path.join(__dirname, 'data', 'tracked_players.json');
const WEEKLY_STATS_FILE = path.join(__dirname, 'data', 'weekly_stats.json');
const CONFIG_FILE = path.join(__dirname, 'data', 'recap_config.json');

// Helper to read/write JSON
function readJson(file, defaultVal) {
    if (!fs.existsSync(file)) return defaultVal;
    return JSON.parse(fs.readFileSync(file));
}

function writeJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Manage Tracked Players
async function addTrackedPlayer(gameName, tagLine, puuid, discordId) {
    const players = readJson(TRACKED_PLAYERS_FILE, []);
    const existingIndex = players.findIndex(p => p.puuid === puuid);
    
    if (existingIndex !== -1) {
        // Update existing player
        players[existingIndex] = { gameName, tagLine, puuid, discordId };
        writeJson(TRACKED_PLAYERS_FILE, players);
        return "updated";
    }

    players.push({ gameName, tagLine, puuid, discordId });
    writeJson(TRACKED_PLAYERS_FILE, players);
    return "added";
}

async function removeTrackedPlayer(gameName, tagLine) {
    let players = readJson(TRACKED_PLAYERS_FILE, []);
    const initialLength = players.length;
    players = players.filter(p => !(p.gameName.toLowerCase() === gameName.toLowerCase() && p.tagLine.toLowerCase() === tagLine.toLowerCase()));
    writeJson(TRACKED_PLAYERS_FILE, players);
    return players.length < initialLength;
}

function setRecapChannel(channelId) {
    const config = readJson(CONFIG_FILE, {});
    config.channelId = channelId;
    writeJson(CONFIG_FILE, config);
}

function getRecapChannel() {
    const config = readJson(CONFIG_FILE, {});
    return config.channelId;
}

function setRecapSchedule(schedule) {
    const config = readJson(CONFIG_FILE, {});
    config.schedule = schedule;
    writeJson(CONFIG_FILE, config);
}

function getRecapSchedule() {
    const config = readJson(CONFIG_FILE, {});
    return config.schedule || '0 4 * * 0,3'; // Default: Wednesday & Sunday 4:00 AM
}

// Rank value for comparison
const TIERS = {
    "IRON": 0, "BRONZE": 400, "SILVER": 800, "GOLD": 1200,
    "PLATINUM": 1600, "EMERALD": 2000, "DIAMOND": 2400,
    "MASTER": 2800, "GRANDMASTER": 2800, "CHALLENGER": 2800
};

const RANKS = { "IV": 0, "III": 100, "II": 200, "I": 300 };

function getTotalLp(tier, rank, lp) {
    let total = TIERS[tier] || 0;
    if (tier !== 'MASTER' && tier !== 'GRANDMASTER' && tier !== 'CHALLENGER') {
        total += RANKS[rank] || 0;
    }
    return total + lp;
}

function setSeasonEndDate(dateStr) {
    const config = readJson(CONFIG_FILE, {});
    config.seasonEndDate = dateStr;
    writeJson(CONFIG_FILE, config);
}

function getSeasonEndDate() {
    const config = readJson(CONFIG_FILE, {});
    return config.seasonEndDate;
}

async function generateSeasonRecap(client) {
    const channelId = getRecapChannel();
    if (!channelId) return console.log("No recap channel configured.");

    const channel = await client.channels.fetch(channelId);
    if (!channel) return console.log("Recap channel not found.");

    const players = readJson(TRACKED_PLAYERS_FILE, []);
    const weeklyStats = readJson(WEEKLY_STATS_FILE, {});
    
    const embed = new EmbedBuilder()
        .setTitle("🏁 Récapitulatif de Fin de Saison")
        .setColor(0xFFD700) // Gold color
        .setDescription("La saison est terminée ! Voici les résultats finaux.")
        .setTimestamp();

    const playerResults = [];
    const pings = [];

    for (const player of players) {
        try {
            const { stats } = await getFullStats(player.gameName, player.tagLine);
            const queue = stats.find(q => q.queueType === 'RANKED_SOLO_5x5');
            
            let fieldName = `${player.gameName} #${player.tagLine}`;
            let fieldValue = "";
            let totalLp = -1;

            if (!queue) {
                fieldValue = "Pas de classement final.";
            } else {
                // Ping if they have data
                if (player.discordId) pings.push(`<@${player.discordId}>`);

                const currentMax = weeklyStats[player.puuid]?.max || { tier: queue.tier, rank: queue.rank, lp: queue.leaguePoints, date: "N/A" };
                totalLp = getTotalLp(queue.tier, queue.rank, queue.leaguePoints);
                const peakTotal = getTotalLp(currentMax.tier, currentMax.rank, currentMax.lp);
                const winrate = Math.round((queue.wins / (queue.wins + queue.losses)) * 100);
                const gamesPlayed = queue.wins + queue.losses;

                fieldValue = `🏅 **Rang Final**: ${queue.tier} ${queue.rank} - ${queue.leaguePoints} LP\n`;
                fieldValue += `🏆 **Peak Saison**: ${currentMax.tier} ${currentMax.rank} - ${currentMax.lp} LP (${currentMax.date})\n`;
                fieldValue += `📊 **Winrate**: ${winrate}% (${queue.wins}W / ${queue.losses}L)\n`;
                
                // Fetch Top Champion
                const topChamp = await getTopChampionStats(player.puuid);
                if (topChamp) {
                    const champWinrate = Math.round((topChamp.wins / topChamp.games) * 100);
                    fieldValue += `⚔️ **Main Champ**: ${topChamp.name} (${topChamp.games} games, ${champWinrate}% WR)\n`;
                }

                const comment = getSeasonFlame(totalLp, peakTotal, winrate, gamesPlayed);
                fieldValue += `🔥 **L'avis du coach**: *"${comment}"*`;
            }
            
            playerResults.push({ totalLp, fieldName, fieldValue });
        } catch (err) {
            console.error(`Error processing season recap for ${player.gameName}:`, err);
            playerResults.push({ totalLp: -2, fieldName: `${player.gameName} #${player.tagLine}`, fieldValue: "❌ Erreur lors de la récupération" });
        }
    }
    
    playerResults.sort((a, b) => b.totalLp - a.totalLp);

    playerResults.forEach((res, index) => {
        let rankPrefix = `**#${index + 1}**`;
        if (index === 0) rankPrefix = "🥇";
        if (index === 1) rankPrefix = "🥈";
        if (index === 2) rankPrefix = "🥉";
        
        embed.addFields({ name: `${rankPrefix} ${res.fieldName}`, value: res.fieldValue, inline: false });
    });

    const content = pings.length > 0 ? `📢 ${pings.join(' ')}` : "";
    channel.send({ content, embeds: [embed] });
}

// Core Recap Logic
async function generateWeeklyRecap(client) {
    const channelId = getRecapChannel();
    if (!channelId) return console.log("No recap channel configured.");

    const channel = await client.channels.fetch(channelId);
    if (!channel) return console.log("Recap channel not found.");

    const players = readJson(TRACKED_PLAYERS_FILE, []);
    if (players.length === 0) return channel.send("Aucun joueur tracké pour le récap hebdo.");

    const weeklyStats = readJson(WEEKLY_STATS_FILE, {});
    const endDate = getSeasonEndDate();
    
    let description = "";
    if (endDate) {
        const end = new Date(endDate.split('/').reverse().join('-')); // DD/MM/YYYY -> YYYY-MM-DD
        const now = new Date();
        const diffTime = end - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
            description = `⏳ **Fin de saison dans ${diffDays} jours** (${endDate})`;
        } else if (diffDays <= 0 && diffDays > -7) {
            description = "🏁 **La saison est terminée !**";
        }
    }

    const embed = new EmbedBuilder()
        .setTitle("📅 Récapitulatif Hebdomadaire (mais en faite c'est le mercredi et le dimanche)")
        .setColor(0x0099FF)
        .setTimestamp();
    
    if (description) embed.setDescription(description);

    const playerResults = [];
    const pings = [];

    for (const player of players) {
        try {
            const { stats } = await getFullStats(player.gameName, player.tagLine);
            const queue = stats.find(q => q.queueType === 'RANKED_SOLO_5x5'); // Focus on SoloQ for now

            if (!weeklyStats[player.puuid]) weeklyStats[player.puuid] = {};
            
            let fieldName = `${player.gameName} #${player.tagLine}`;
            let fieldValue = "";
            let totalLp = -1;

            if (!queue) {
                fieldValue = "Pas de données SoloQ.";
            } else {
                const currentTotal = getTotalLp(queue.tier, queue.rank, queue.leaguePoints);
                totalLp = currentTotal;
                const lastData = weeklyStats[player.puuid].lastCheck;
                const maxData = weeklyStats[player.puuid].max;

                // Update Max
                let isNewMax = false;
                if (!maxData || currentTotal > getTotalLp(maxData.tier, maxData.rank, maxData.lp)) {
                    weeklyStats[player.puuid].max = {
                        tier: queue.tier,
                        rank: queue.rank,
                        lp: queue.leaguePoints,
                        date: new Date().toLocaleDateString('fr-FR')
                    };
                    isNewMax = true;
                }

                let diff = 0;
                let gamesPlayed = 0;
                let winrate = Math.round((queue.wins / (queue.wins + queue.losses)) * 100);

                // Compare with last week
                if (lastData) {
                    gamesPlayed = (queue.wins + queue.losses) - (lastData.wins + lastData.losses);
                    const oldTotal = getTotalLp(lastData.tier, lastData.rank, lastData.lp);
                    diff = currentTotal - oldTotal;
                    const sign = diff >= 0 ? "+" : "";
                    
                    if (gamesPlayed <= 0) {
                        fieldValue = "💤 **Inactif cette période**\n";
                        fieldValue += `Actuel: **${queue.tier} ${queue.rank}** - ${queue.leaguePoints} LP\n`;
                        if (diff !== 0) {
                             fieldValue += `(Évolution: ${sign}${diff} LP)\n`;
                        }
                        fieldValue += `Semaine dernière: ${lastData.tier} ${lastData.rank} - ${lastData.lp} LP`;
                    } else {
                        let emoji = "😐";
                        if (diff >= 50) emoji = "🚀";
                        else if (diff > 0) emoji = "📈";
                        else if (diff <= -50) emoji = "💀";
                        else if (diff < 0) emoji = "📉";

                        fieldValue = `${emoji} **${sign}${diff} LP** en ${gamesPlayed} games\n`;
                        fieldValue += `Actuel: **${queue.tier} ${queue.rank}** - ${queue.leaguePoints} LP\n`;
                        fieldValue += `Semaine dernière: ${lastData.tier} ${lastData.rank} - ${lastData.lp} LP`;
                        
                        // Only ping if active
                        if (player.discordId) pings.push(`<@${player.discordId}>`);
                    }
                } else {
                    fieldValue = "🆕 **Début du tracking**\n";
                    fieldValue += `Actuel: ${queue.tier} ${queue.rank} - ${queue.leaguePoints} LP`;
                    // Ping for new tracking
                    if (player.discordId) pings.push(`<@${player.discordId}>`);
                }

                // Add Peak info
                const currentMax = weeklyStats[player.puuid].max;
                fieldValue += `\n🏆 Peak: ${currentMax.tier} ${currentMax.rank} - ${currentMax.lp} LP (${currentMax.date})`;
                
                // Fetch Top Champion
                const topChamp = await getTopChampionStats(player.puuid);
                if (topChamp) {
                    const champWinrate = Math.round((topChamp.wins / topChamp.games) * 100);
                    fieldValue += `\n⚔️ **Main Champ**: ${topChamp.name} (${topChamp.games} games, ${champWinrate}% WR)`;
                }

                // Add Contextual Flame
                const comment = getWeeklyFlame(diff, gamesPlayed, winrate);
                fieldValue += `\n🔥 **L'avis du coach**: *"${comment}"*`;

                // Update last check
                weeklyStats[player.puuid].lastCheck = {
                    tier: queue.tier,
                    rank: queue.rank,
                    lp: queue.leaguePoints,
                    wins: queue.wins,
                    losses: queue.losses,
                    date: new Date().toLocaleDateString('fr-FR')
                };
            }

            playerResults.push({ totalLp, fieldName, fieldValue });

        } catch (err) {
            console.error(`Error processing ${player.gameName}:`, err);
            playerResults.push({ totalLp: -2, fieldName: `${player.gameName} #${player.tagLine}`, fieldValue: "❌ Erreur lors de la récupération" });
        }
        fieldValue+= '\n =================================================='
    }

    // Sort by Total LP descending
    playerResults.sort((a, b) => b.totalLp - a.totalLp);

    playerResults.forEach((res, index) => {
        let rankPrefix = `**#${index + 1}**`;
        if (index === 0) rankPrefix = "🥇";
        if (index === 1) rankPrefix = "🥈";
        if (index === 2) rankPrefix = "🥉";

        embed.addFields({ name: `${rankPrefix} ${res.fieldName}`, value: res.fieldValue, inline: false });
    });

    writeJson(WEEKLY_STATS_FILE, weeklyStats);
    const content = pings.length > 0 ? `📢 ${pings.join(' ')}` : "";
    channel.send({ content, embeds: [embed] });
}

module.exports = {
    addTrackedPlayer,
    removeTrackedPlayer,
    setRecapChannel,
    generateWeeklyRecap,
    setRecapSchedule,
    getRecapSchedule,
    setSeasonEndDate,
    generateSeasonRecap
};
