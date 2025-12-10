const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, WebhookClient, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const cron = require('node-cron');
const { getFullStats } = require('./riotApi');
const { saveStats, getLpDiff } = require('./storage');
const { addTrackedPlayer, removeTrackedPlayer, setRecapChannel, generateWeeklyRecap, setRecapSchedule, getRecapSchedule, setSeasonEndDate, generateSeasonRecap } = require('./recap');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
        .setDescription('Get ranked stats for a player')
        .addStringOption(option => 
            option.setName('name')
                .setDescription('Riot ID Game Name')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('tag')
                .setDescription('Riot ID Tag Line')
                .setRequired(true)),
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

    const gameName = interaction.options.getString('name');
    const tagLine = interaction.options.getString('tag');

    if (commandName === 'stats' || commandName === 'recap') {
        await interaction.deferReply();

        try {
            const { summoner, stats, matches } = await getFullStats(gameName, tagLine);
            
            const embed = new EmbedBuilder()
                .setTitle(`Stats for ${gameName}#${tagLine}`)
                .setThumbnail(`http://ddragon.leagueoflegends.com/cdn/13.24.1/img/profileicon/${summoner.profileIconId}.png`)
                .setTimestamp()
                .addFields(
                    { name: 'Level', value: summoner.summonerLevel.toString(), inline: true }
                );

            if (stats.length > 0) {
                const soloQueue = stats.filter(q => q.queueType === 'RANKED_SOLO_5x5');
                
                if (soloQueue.length > 0) {
                    soloQueue.forEach(queue => {
                        // Save current stats for history
                        saveStats(summoner.puuid, queue.queueType, queue.tier, queue.rank, queue.leaguePoints);

                        // Calculate LP difference
                        const diffData = getLpDiff(summoner.puuid, queue.queueType, queue.leaguePoints, queue.tier, queue.rank);
                        let diffText = "";
                        
                        if (diffData) {
                            if (diffData.diff !== null && diffData.diff !== undefined) {
                                const sign = diffData.diff >= 0 ? "+" : "";
                                const diffVal = diffData.diff;
                                
                                // Color logic
                                // Green (32) if > 0
                                // Red (31) if < 0
                                // Black (30) if <= -100
                                // Purple (35) if >= 70
                                let color = "0;37"; // Default White
                                let emoji = "";

                                if (diffVal <= -100) {
                                    color = "0;30"; // Black
                                    emoji = "💀";
                                } else if (diffVal >= 70) {
                                    color = "0;35"; // Purple
                                    emoji = "🚀";
                                } else if (diffVal > 0) {
                                    color = "0;32"; // Green
                                    emoji = "📈";
                                } else if (diffVal < 0) {
                                    color = "0;31"; // Red
                                    emoji = "📉";
                                }
                                
                                diffText = `\n\`\`\`ansi\nDate du dernier record : ${diffData.date}\n\u001b[${color}mAncien rang : ${diffData.oldTier} ${diffData.oldRank} / ${sign}${diffVal} LP ${emoji}\u001b[0m\n\`\`\``;
                            } else if (diffData.message) {
                                diffText = `\n*(${diffData.message})*`;
                            }
                        }

                        const winRate = Math.round((queue.wins / (queue.wins + queue.losses)) * 100);
                        embed.addFields(
                            { 
                                name: 'Ranked Solo/Duo', 
                                value: `${queue.tier} ${queue.rank} - ${queue.leaguePoints} LP\n${queue.wins}W / ${queue.losses}L (${winRate}%)${diffText}`, 
                                inline: false 
                            }
                        );
                    });
                } else {
                    embed.addFields({ name: 'Ranked', value: 'Unranked in Solo/Duo', inline: false });
                }
            } else {
                embed.addFields({ name: 'Ranked', value: 'Unranked or Data Unavailable', inline: false });
            }

            if (matches && matches.length > 0) {
                let historyText = '';
                matches.forEach(match => {
                    const result = match.win ? '✅ Win' : '❌ Loss';
                    const kda = `${match.kills}/${match.deaths}/${match.assists}`;
                    historyText += `${result} | **${match.championName}** | ${kda}\n`;
                });
                embed.addFields({ name: 'Last 5 Matches', value: historyText, inline: false });
            }

            if (commandName === 'stats') {
                await interaction.editReply({ embeds: [embed] });
            } else if (commandName === 'recap') {
                if (!process.env.DISCORD_WEBHOOK_URL) {
                    await interaction.editReply('Webhook URL is not configured.');
                    return;
                }
                const webhookClient = new WebhookClient({ url: process.env.DISCORD_WEBHOOK_URL });
                await webhookClient.send({
                    content: `Recap for ${gameName}#${tagLine}`,
                    embeds: [embed],
                });
                await interaction.editReply('Recap sent to webhook!');
            }

        } catch (error) {
            console.error(error);
            // Only try to editReply if we deferred or replied, otherwise reply
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('Error fetching stats. Please check the Riot ID and try again.').catch(console.error);
            } else {
                // If deferReply failed, we might not be able to reply at all, but let's try
                await interaction.reply({ content: 'Error fetching stats.', ephemeral: true }).catch(console.error);
            }
        }
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
