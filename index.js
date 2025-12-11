const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, WebhookClient, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getFullStats } = require('./riotApi');
const { saveStats, getLpDiff, saveDailyStats, getDailyStats, convertToTotalLp } = require('./storage');
const { addTrackedPlayer, removeTrackedPlayer, setRecapChannel, generateWeeklyRecap, setRecapSchedule, getRecapSchedule, setSeasonEndDate, generateSeasonRecap } = require('./recap');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Helper to read tracked players directly
function getTrackedPlayers() {
    const file = path.join(__dirname, 'data', 'tracked_players.json');
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file));
}

// Daily Snapshot Logic
async function runDailySnapshot() {
    console.log('Running daily stats snapshot...');
    const players = getTrackedPlayers();
    const dailyData = {};

    for (const player of players) {
        try {
            const { stats } = await getFullStats(player.gameName, player.tagLine);
            const queue = stats.find(q => q.queueType === 'RANKED_SOLO_5x5');
            
            if (queue) {
                dailyData[player.puuid] = {
                    tier: queue.tier,
                    rank: queue.rank,
                    lp: queue.leaguePoints,
                    wins: queue.wins,
                    losses: queue.losses,
                    timestamp: Date.now()
                };
            }
        } catch (err) {
            console.error(`Failed to snapshot ${player.gameName}:`, err);
        }
    }
    saveDailyStats(dailyData);
    console.log('Daily snapshot saved.');
}

// Global Error Handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.on('error', error => {
    console.error('Discord Client Error:', error);
});

const commands = [
    new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Get ranked stats for a player (defaults to linked account)')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Riot ID Game Name (Optional if tracked)')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('Riot ID Tag Line (Optional if tracked)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('recap')
        .setDescription('Send ranked stats recap to the configured Webhook')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Riot ID Game Name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('Riot ID Tag Line')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('track')
        .setDescription('Add a player to the weekly recap')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Riot ID Game Name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('Riot ID Tag Line')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user to link (optional)')
                .setRequired(false)),
    new SlashCommandBuilder()
        .setName('untrack')
        .setDescription('Remove a player from the weekly recap')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Riot ID Game Name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('Riot ID Tag Line')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('Set the channel for weekly recaps'),
    new SlashCommandBuilder()
        .setName('forcerecap')
        .setDescription('Force generate the weekly recap now'),
    new SlashCommandBuilder()
        .setName('setschedule')
        .setDescription('Set the cron schedule for weekly recaps')
        .addStringOption(option => 
            option.setName('cron')
                .setDescription('Cron expression (e.g., "0 9 * * 1")')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('doc')
        .setDescription('Show available commands and usage'),
    new SlashCommandBuilder()
        .setName('setenddate')
        .setDescription('Set the season end date (DD/MM/YYYY)')
        .addStringOption(option => 
            option.setName('date')
                .setDescription('Date (DD/MM/YYYY)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('seasonrecap')
        .setDescription('Force generate the season end recap'),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        const route = process.env.GUILD_ID 
            ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
            : Routes.applicationCommands(process.env.CLIENT_ID);

        await rest.put(
            route,
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    const schedule = getRecapSchedule();
    console.log(`Scheduling recap with: ${schedule}`);
    
    if (global.cronTask) global.cronTask.stop();
    global.cronTask = cron.schedule(schedule, () => {
        console.log('Running weekly recap...');
        generateWeeklyRecap(client);
    });

    // Daily Snapshot at 6:00 AM
    cron.schedule('0 6 * * *', () => {
        runDailySnapshot();
    });
});

client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'track') {
        await interaction.deferReply();
        const gameName = interaction.options.getString('name');
        const tagLine = interaction.options.getString('tag');
        const targetUser = interaction.options.getUser('user') || interaction.user;
        
        try {
            const { summoner } = await getFullStats(gameName, tagLine);
            const result = await addTrackedPlayer(gameName, tagLine, summoner.puuid, targetUser.id);
            
            if (result === "added") {
                await interaction.editReply(`✅ **${gameName}#${tagLine}** a été ajouté au tracking hebdo (lié à <@${targetUser.id}>).`);
            } else if (result === "updated") {
                await interaction.editReply(`🔄 **${gameName}#${tagLine}** a été mis à jour (lié à <@${targetUser.id}>).`);
            } else {
                await interaction.editReply(`⚠️ **${gameName}#${tagLine}** est déjà tracké.`);
            }
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Impossible de trouver **${gameName}#${tagLine}**. Vérifiez le Riot ID.`);
        }
        return;
    }

    if (commandName === 'untrack') {
        const gameName = interaction.options.getString('name');
        const tagLine = interaction.options.getString('tag');
        const removed = await removeTrackedPlayer(gameName, tagLine);
        if (removed) {
            await interaction.reply(`🗑️ **${gameName}#${tagLine}** a été retiré du tracking.`);
        } else {
            await interaction.reply(`⚠️ **${gameName}#${tagLine}** n'était pas dans la liste.`);
        }
        return;
    }

    if (commandName === 'setchannel') {
        setRecapChannel(interaction.channelId);
        await interaction.reply(`✅ Ce channel (**${interaction.channel.name}**) recevra désormais le récap hebdo.`);
        return;
    }

    if (commandName === 'forcerecap') {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        await interaction.editReply("⏳ Génération du récap en cours...");
        await generateWeeklyRecap(client);
        await interaction.editReply("✅ Récap généré !");
        return;
    }

    if (commandName === 'setschedule') {
        const schedule = interaction.options.getString('cron');
        if (!cron.validate(schedule)) {
            await interaction.reply("❌ Expression Cron invalide. Exemple: `0 9 * * 1` (Lundi 9h00)");
            return;
        }
        
        setRecapSchedule(schedule);
        
        if (global.cronTask) global.cronTask.stop();
        global.cronTask = cron.schedule(schedule, () => {
            console.log('Running weekly recap...');
            generateWeeklyRecap(client);
        });
        
        await interaction.reply(`✅ Planning mis à jour : \`${schedule}\``);
        return;
    }

    if (commandName === 'setenddate') {
        const dateStr = interaction.options.getString('date');
        // Simple regex for DD/MM/YYYY
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
            await interaction.reply("❌ Format invalide. Utilisez `JJ/MM/AAAA` (ex: 10/01/2026).");
            return;
        }
        setSeasonEndDate(dateStr);
        await interaction.reply(`✅ Fin de saison fixée au **${dateStr}**. Un compte à rebours apparaîtra dans le récap hebdo.`);
        return;
    }

    if (commandName === 'seasonrecap') {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        await interaction.editReply("⏳ Génération du récap de fin de saison...");
        await generateSeasonRecap(client);
        await interaction.editReply("✅ Récap de saison généré !");
        return;
    }

    if (commandName === 'doc') {
        const embed = new EmbedBuilder()
            .setTitle("📚 Documentation des Commandes")
            .setColor(0x0099FF)
            .addFields(
                { name: '📊 Stats & Recap', value: 
                    '`/stats <name> <tag>` : Affiche les stats classées d\'un joueur.\n' +
                    '`/recap <name> <tag>` : Envoie les stats sur le Webhook configuré (si actif).' 
                },
                { name: '📅 Gestion du Récap Hebdo', value: 
                    '`/track <name> <tag>` : Ajoute un joueur au récapitulatif hebdomadaire.\n' +
                    '`/untrack <name> <tag>` : Retire un joueur du récapitulatif.\n' +
                    '`/setchannel` : Définit le salon actuel pour recevoir le récapitulatif.\n' +
                    '`/setschedule <cron>` : Définit l\'horaire du récap (ex: `0 9 * * 1` pour Lundi 9h).\n' +
                    '`/forcerecap` : Force la génération immédiate du récapitulatif.'
                },
                { name: '🏁 Fin de Saison', value: 
                    '`/setenddate <JJ/MM/AAAA>` : Définit la date de fin de saison pour le compte à rebours.\n' +
                    '`/seasonrecap` : Génère manuellement le récapitulatif final de la saison.'
                },
                { name: 'ℹ️ Info', value: 'Les stats sont comparées avec celles de la semaine précédente pour afficher la progression.' }
            );
        await interaction.reply({ embeds: [embed] });
        return;
    }

    let gameName = interaction.options.getString('name');
    let tagLine = interaction.options.getString('tag');

    if (commandName === 'stats') {
        await interaction.deferReply();

        // Auto-detect user if no args
        if (!gameName || !tagLine) {
            const tracked = getTrackedPlayers();
            const linkedPlayer = tracked.find(p => p.discordId === interaction.user.id);
            
            if (linkedPlayer) {
                gameName = linkedPlayer.gameName;
                tagLine = linkedPlayer.tagLine;
            } else {
                await interaction.editReply("❌ Tu n'as pas spécifié de pseudo et ton compte Discord n'est pas lié.\nUtilise `/track` pour lier ton compte ou précise `name` et `tag`.");
                return;
            }
        }

        try {
            const { summoner, stats } = await getFullStats(gameName, tagLine);
            
            const opggUrl = `https://www.op.gg/summoners/euw/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`;

            const embed = new EmbedBuilder()
                .setTitle(`Stats pour ${gameName}#${tagLine}`)
                .setURL(opggUrl)
                .setThumbnail(`http://ddragon.leagueoflegends.com/cdn/13.24.1/img/profileicon/${summoner.profileIconId}.png`)
                .setTimestamp();

            const soloQueue = stats.find(q => q.queueType === 'RANKED_SOLO_5x5');
            
            if (soloQueue) {
                const winrate = Math.round((soloQueue.wins / (soloQueue.wins + soloQueue.losses)) * 100);
                let desc = `**${soloQueue.tier} ${soloQueue.rank}** - ${soloQueue.leaguePoints} LP\n`;
                desc += `Wins: ${soloQueue.wins} | Losses: ${soloQueue.losses} | WR: ${winrate}%\n`;

                // Daily Diff Logic
                const dailyStats = getDailyStats();
                const startOfDay = dailyStats[summoner.puuid];

                if (startOfDay) {
                    const currentTotal = convertToTotalLp(soloQueue.tier, soloQueue.rank, soloQueue.leaguePoints);
                    const startTotal = convertToTotalLp(startOfDay.tier, startOfDay.rank, startOfDay.lp);
                    const diff = currentTotal - startTotal;
                    const gamesToday = (soloQueue.wins + soloQueue.losses) - (startOfDay.wins + startOfDay.losses);
                    
                    const sign = diff >= 0 ? "+" : "";
                    let emoji = "😐";
                    if (diff > 0) emoji = "📈";
                    if (diff < 0) emoji = "📉";
                    if (gamesToday === 0) emoji = "💤";

                    desc += `\n**Aujourd'hui (depuis 6h) :**\n`;
                    desc += `${emoji} **${sign}${diff} LP** (${gamesToday} games)`;
                } else {
                    desc += `\n*Pas de données enregistrées ce matin (6h).*`;
                }

                embed.setDescription(desc);
                embed.setColor(0x0099FF);
            } else {
                embed.setDescription("Pas de classement SoloQ.");
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Erreur lors de la récupération des stats pour **${gameName}#${tagLine}**.`);
        }
        return;
    }

    if (commandName === 'recap') {
        await interaction.deferReply();
        // Old recap logic (manual webhook) kept for compatibility but simplified
        try {
             const { summoner, stats } = await getFullStats(gameName, tagLine);
             // ... (rest of old logic if needed, or just redirect to use /forcerecap)
             await interaction.editReply("Cette commande est dépréciée. Utilise `/stats` pour voir tes stats ou `/forcerecap` pour le récap global.");
        } catch (e) {
            await interaction.editReply("Erreur.");
        }
        return;
    }
    } catch (error) {
        // Ignore "Unknown interaction" (10062) and "Already acknowledged" (40060) errors
        if (error.code === 10062 || error.code === 40060) {
            console.warn(`[Warn] Interaction error ${error.code}: ${error.message}`);
        } else {
            console.error('Interaction Handler Error:', error);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
