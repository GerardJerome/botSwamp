const FLAMES = [
    // General / Low Elo
    "T'es le genre de joueur qui flash pour voler le kill du support.",
    "Même un bot intermédiaire aurait mieux joué ce teamfight.",
    "Ton map awareness est aussi inexistant que ton skill.",
    "Si le feed était un art, tu serais Picasso.",
    "Arrête de ping, t'es mort 12 fois.",
    "C'est pas la jungle gap, c'est juste toi gap.",
    "T'as réussi à perdre ta lane contre un Yuumi top ?",
    "Ton clavier est débranché ou tu joues avec les pieds ?",
    "On dirait que tu joues avec un écran éteint.",
    "T'es la raison pour laquelle le bouton 'Surrender' existe.",
    "Tu vaux moins de gold qu'un sbire canon.",
    "T'as plus de morts que de minutes de jeu.",
    "C'est pas grave, l'important c'est de participer... ah non, c'est de gagner en fait.",
    "T'es aussi utile qu'un ward dans la fontaine.",
    "Tu devrais essayer TFT, y'a moins de touches à appuyer.",
    "Ton historique de match est plus rouge que le logo de Riot.",
    "T'as pas besoin d'anti-heal, t'as besoin d'anti-feed.",
    "T'es le meilleur joueur... de l'équipe adverse.",
    "Si tu jouais aussi bien que tu flames, tu serais Challenger.",
    "T'as raté ton ulti, ton flash, et ta vie.",
    "T'as un KDA de pacifiste.",
    "T'es le minion canon de l'équipe.",
    "Ton gameplay est une insulte au jeu vidéo.",
    "Même le client LoL bug moins que ton cerveau.",
    "T'as cru que c'était ARAM ?",
    "T'as pas de mains, ou t'as pas d'yeux ?",
    "T'es le yasuo 0/10 dont tout le monde parle.",
    "T'as réussi à rater un smite sur un baron à 10 HP.",
    "T'es la preuve vivante que le elo hell existe (c'est toi).",
    "T'as plus de dégâts sur les tours que sur les champions... ah non même pas.",
    
    // Hardstuck / Stagnation
    "Encore une semaine, encore le même rang. La boucle est bouclée.",
    "Tu bouges pas de ton elo, t'es un meuble en fait.",
    "T'as pris racine en Gold IV ou quoi ?",
    "La définition de la folie, c'est de refaire la même game et d'espérer monter.",
    "T'es hardstuck, accepte-le. C'est ton destin.",
    "T'as fait 50 games pour gagner 3 LP. Rentable.",
    "Ton graph de LP ressemble à un encéphalogramme plat.",
    "Tu montes, tu descends... t'es un ascenseur émotionnel pour tes mates.",
    "T'es pas bloqué par tes mates, t'es bloqué par ton talent.",
    "C'est bien, tu stabilises... dans la médiocrité.",
    "T'es l'ancre du navire, tu nous tires vers le fond.",
    "T'as campé ton elo comme un teemo dans un bush.",
    "T'as pas bougé d'un poil, c'est fascinant.",
    "T'es comme un NPC, tu restes au même endroit.",
    "T'as trouvé ta maison, c'est le Silver 2.",

    // Demotion / Loss Streak
    "La chute est vertigineuse. T'as oublié ton parachute ?",
    "À ce rythme là, tu vas finir en Iron avant la fin du mois.",
    "T'as perdu tellement de LP que la banque va saisir ton compte.",
    "C'est une lose streak ou tu essayes de battre un record ?",
    "T'as donné tes LP à la charité ?",
    "Redescends sur terre, ou plutôt en Silver.",
    "T'as tilté ? T'as tilté.",
    "C'est pas une mauvaise passe, c'est juste ton niveau réel qui revient.",
    "T'as perdu contre qui ? Ah oui, contre toi-même.",
    "Arrête, tu te fais du mal.",
    "T'as besoin d'un câlin ou d'un coach ?",
    "T'as perdu plus de LP que t'as de neurones.",
    "C'est la dégringolade, accroche-toi aux branches.",
    "T'as glissé chef.",
    "T'as décidé de visiter les profondeurs du classement ?",

    // High Winrate / Climbing (Sarcastic)
    "T'as payé combien pour le boost ?",
    "C'est facile de gagner quand on se fait carry.",
    "Profite, ça va pas durer. La lose streak arrive.",
    "T'as chatté le matchmaking, fais pas le malin.",
    "Wow, t'as gagné. T'as enfin allumé ton écran ?",
    "T'as joué des persos méta, aucune dignité.",
    "C'est pas toi qui est fort, c'est les autres qui sont nuls.",
    "T'as gagné 2 divisions ? T'as dû vendre ton âme.",
    "Bravo, t'es le roi des nuls.",
    "T'as smurf en Bronze ? Quel exploit...",
    "T'as trouvé le script parfait ?",
    "T'as soudoyé Riot ?",
    "C'est louche tout ça, très louche.",
    "T'as enfin branché ta souris ?",
    "Miracle ! Il sait jouer !"
];

function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomFlame() {
    return pickRandom(FLAMES);
}

function getWeeklyFlame(diff, gamesPlayed, winrate) {
    // Inactif
    if (gamesPlayed === 0) {
        return pickRandom([
            "💤 Tu dors ou quoi ? Lance une game, feignasse.",
            "💤 T'as désinstallé le jeu ? On te voit plus.",
            "💤 Le clavier prend la poussière ?",
            "💤 T'as peur de perdre tes LP imaginaires ?",
            "💤 AFK Life ? Reviens souffrir avec nous.",
            "💤 T'es en vacances ou t'as juste ragequit la vie ?",
            "💤 C'est bien, repose tes mains, elles servent à rien de toute façon.",
            "💤 T'as trouvé un travail ? C'est décevant.",
            "💤 Zzz... Réveille-toi, la faille t'attend.",
            "💤 T'as pris ta retraite anticipée ?"
        ]);
    }
    
    // Huge Climb (> 100 LP)
    if (diff > 100) {
        return pickRandom([
            "🚀 Wow, t'as activé l'écran ? Continue comme ça.",
            "🚀 T'as mangé quoi ce matin ? Du skill ?",
            "🚀 C'est le smurf de qui ça ?",
            "🚀 T'as enfin compris comment jouer, il était temps.",
            "🚀 Stop le boost, c'est grillé.",
            "🚀 T'as pris des cours ou t'as juste eu de la chance ?",
            "🚀 L'ascension fulgurante ! (Avant la chute).",
            "🚀 T'es dopé ?",
            "🚀 Incroyable, tu sais cliquer !",
            "🚀 T'as volé les mains de Faker ?"
        ]);
    }

    // Good Climb (> 50 LP)
    if (diff > 50) {
        return pickRandom([
            "📈 Pas mal, t'as enfin compris comment jouer.",
            "📈 Ça monte, ça monte. Fais gaffe au vertige.",
            "📈 T'as gagné quelques games, prends pas la confiance.",
            "📈 C'est correct, pour un joueur de ton niveau.",
            "📈 T'as eu des bons mates, avoue.",
            "📈 T'as arrêté de int ? Bravo.",
            "📈 Une bonne semaine, ça change de d'habitude.",
            "📈 T'as trouvé la marche avant.",
            "📈 Continue, tu sortiras peut-être du elo hell.",
            "📈 C'est suspect, mais je valide."
        ]);
    }

    // Small Climb (> 0 LP)
    if (diff > 0) {
        return pickRandom([
            "😐 Tu montes doucement... très doucement.",
            "😐 C'est mieux que rien, j'imagine.",
            "😐 T'as gagné 1 LP, champagne ?",
            "😐 T'avances à la vitesse d'un escargot asthmatique.",
            "😐 C'est laborieux, mais ça passe.",
            "😐 T'as pas brillé, mais t'as pas coulé.",
            "😐 Mouais. Peut mieux faire.",
            "😐 T'as fait acte de présence.",
            "😐 T'as gratté quelques points, petit rat.",
            "😐 C'est pas la gloire, mais c'est pas la honte."
        ]);
    }
    
    // Huge Drop (< -100 LP)
    if (diff < -100) {
        return pickRandom([
            "💀 T'as décidé de derank pour jouer avec tes potes Iron ?",
            "💀 C'est un massacre. Appelle le 15.",
            "💀 T'as joué les yeux bandés ?",
            "💀 T'as perdu ton cerveau en même temps que tes LP.",
            "💀 C'est criminel de jouer comme ça.",
            "💀 T'as fait exprès ? Dis-moi que t'as fait exprès.",
            "💀 T'es une catastrophe ambulante.",
            "💀 T'as ruiné la semaine de combien de mates ?",
            "💀 Désinstalle, c'est pour ton bien.",
            "💀 T'as touché le fond, et t'as creusé."
        ]);
    }

    // Bad Drop (< -50 LP)
    if (diff < -50) {
        return pickRandom([
            "📉 La chute libre. Ouvre les yeux quand tu joues.",
            "📉 T'as glissé sur une peau de banane ?",
            "📉 C'est moche à voir.",
            "📉 T'as perdu le mode d'emploi du jeu ?",
            "📉 T'as fait une donation de LP ?",
            "📉 T'es en train de throw ta saison.",
            "📉 Ça descend vite, très vite.",
            "📉 T'as besoin d'aide ?",
            "📉 Arrête l'hémorragie.",
            "📉 T'es un distributeur de LP gratuit."
        ]);
    }

    // Small Drop (< 0 LP)
    if (diff < 0) {
        return pickRandom([
            "🤡 T'as perdu des LP. Classique.",
            "🤡 T'as reculé pour mieux... reculer ?",
            "🤡 C'est pas ta semaine.",
            "🤡 T'as trébuché.",
            "🤡 Un petit pas en arrière pour l'humanité.",
            "🤡 T'as perdu, mais avec panache (non).",
            "🤡 T'as pas réussi à carry, dommage.",
            "🤡 T'as un peu choke.",
            "🤡 C'est la faute du jungler, c'est ça ?",
            "🤡 T'as perdu quelques plumes."
        ]);
    }

    // Low Winrate (< 45%)
    if (winrate < 45) {
        return pickRandom([
            "🤢 Ton winrate me donne la nausée.",
            "🤢 Moins de 45% WR ? T'es un agent double ?",
            "🤢 T'es statistiquement un poids pour ton équipe.",
            "🤢 T'as plus de chances de gagner au loto que de gagner ta lane.",
            "🤢 C'est gênant ce winrate.",
            "🤢 T'as envisagé de changer de jeu ?",
            "🤢 T'es le maillon faible.",
            "🤢 T'as un winrate de bot.",
            "🤢 C'est rouge, très rouge.",
            "🤢 T'as besoin d'un miracle."
        ]);
    }

    // High Winrate (> 60%)
    if (winrate > 60) {
        return pickRandom([
            "🤖 T'es scripté ou t'as payé un boost ?",
            "🤖 60%+ WR ? C'est louche.",
            "🤖 T'es en smurf queue ?",
            "🤖 T'as trouvé la recette magique.",
            "🤖 C'est indécent de gagner autant.",
            "🤖 T'as vendu ton âme au diable ?",
            "🤖 T'es on fire.",
            "🤖 Calme-toi, tu vas te faire ban.",
            "🤖 T'es trop fort pour ce elo (ou pas).",
            "🤖 GG, mais fais pas le malin."
        ]);
    }

    return getRandomFlame();
}

function getSeasonFlame(currentTotal, peakTotal, winrate, gamesPlayed) {
    const drop = peakTotal - currentTotal;

    // Huge Drop from Peak (> 400 LP)
    if (drop > 400) {
        return pickRandom([
            "📉 T'as perdu 4 divisions depuis ton peak ? T'as eu un AVC ?",
            "📉 T'as dégringolé de l'Everest sans corde.",
            "📉 T'étais au sommet, maintenant t'es dans le ravin.",
            "📉 C'est plus une chute, c'est un crash aérien.",
            "📉 T'as perdu tout ton skill en cours de route ?",
            "📉 T'as peak par chance, avoue.",
            "📉 La gravité a été cruelle avec toi.",
            "📉 T'as fait une chute libre sans parachute.",
            "📉 T'es passé de héros à zéro.",
            "📉 C'est triste de finir si bas."
        ]);
    }

    // Big Drop from Peak (> 200 LP)
    if (drop > 200) {
        return pickRandom([
            "🤡 T'as peak et t'as tout reperdu. La définition de l'échec.",
            "🤡 T'as pas su garder ton rang, dommage.",
            "🤡 T'as craqué sous la pression.",
            "🤡 T'es redescendu sur terre.",
            "🤡 T'as perdu 200 LP ? C'est beaucoup quand même.",
            "🤡 T'as pas le mental pour rester en haut.",
            "🤡 T'as fait l'ascenseur, mais que dans un sens.",
            "🤡 T'as gâché ton potentiel.",
            "🤡 T'as fini la saison en roue libre.",
            "🤡 T'as tilté sur la fin ?"
        ]);
    }

    // Drop from Peak (> 100 LP)
    if (drop > 100) {
        return pickRandom([
            "📉 T'as pas tenu la pression. T'es redescendu comme un soufflé.",
            "📉 T'as fini un peu plus bas que prévu.",
            "📉 T'as pas réussi à maintenir ton peak.",
            "📉 T'as lâché l'affaire sur la fin.",
            "📉 Un peu décevant cette fin de saison.",
            "📉 T'as perdu quelques plumes dans la bataille.",
            "📉 T'aurais dû arrêter quand t'étais au top.",
            "📉 T'as voulu trop jouer, t'as perdu.",
            "📉 C'est dommage, t'étais si haut.",
            "📉 T'as fini sur une mauvaise note."
        ]);
    }
    
    // Finished at Peak (within 20 LP)
    if (currentTotal >= peakTotal - 20) {
        return pickRandom([
            "🏆 T'as fini au sommet (de ta médiocrité).",
            "🏆 Bravo, t'as fini sur ton peak !",
            "🏆 T'as tout donné jusqu'à la fin.",
            "🏆 T'as pas lâché, respect.",
            "🏆 T'as fini en beauté.",
            "🏆 T'as atteint ton objectif ?",
            "🏆 C'est propre, rien à dire.",
            "🏆 T'as fini fort.",
            "🏆 T'es un monstre (ou pas).",
            "🏆 T'as sécurisé le rang."
        ]);
    }
    
    // Hardstuck Negative WR
    if (gamesPlayed > 1000 && winrate < 50) {
        return pickRandom([
            "💀 1000 games pour un winrate négatif. Désinstalle.",
            "💀 T'as passé ta vie sur le jeu pour perdre.",
            "💀 T'es l'addiction incarnée.",
            "💀 T'as besoin de sortir dehors.",
            "💀 1000 games de souffrance.",
            "💀 T'as pas progressé d'un poil en 1000 games.",
            "💀 C'est triste de jouer autant pour être aussi nul.",
            "💀 T'as gâché une année de ta vie.",
            "💀 T'es masochiste ?",
            "💀 Riot te remercie pour ton temps (perdu)."
        ]);
    }

    // Tourist
    if (gamesPlayed < 50) {
        return pickRandom([
            "👻 T'as à peine joué. T'es un touriste.",
            "👻 T'as fait tes placements et t'as arrêté ?",
            "👻 T'es venu, t'as vu, t'es reparti.",
            "👻 T'as pas vraiment participé à la saison.",
            "👻 T'es un casual.",
            "👻 T'as peur de jouer ?",
            "👻 T'as mieux à faire que de jouer à LoL (tu as raison).",
            "👻 T'as pas l'âme d'un compétiteur.",
            "👻 T'es juste là pour les récompenses ?",
            "👻 T'as joué en dilettante."
        ]);
    }

    return getRandomFlame();
}

module.exports = { getRandomFlame, getWeeklyFlame, getSeasonFlame };