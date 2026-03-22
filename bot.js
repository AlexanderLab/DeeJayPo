const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const {
    Client,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");
const { Shoukaku, Connectors } = require("shoukaku");

console.log("INICIANDO DEEJAYPO");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
    console.error("ERROR: DISCORD_TOKEN no encontrado en el entorno.");
} else {
    console.log("Token de Discord cargado correctamente.");
}

// Lista de nodos v4 (Verificados)
const Nodes = [
    {
        name: 'Jirayu-Node',
        url: 'lavalink.jirayu.net:443',
        auth: 'youshallnotpass',
        secure: true
    },
    {
        name: 'Serenetia-V4',
        url: 'lavalinkv4.serenetia.com:443',
        auth: 'https://dsc.gg/ajidevserver',
        secure: true
    },
    {
        name: 'Lava-Link-Fallback',
        url: 'lava.link:443',
        auth: 'youshallnotpass',
        secure: true
    }
];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// Opciones de Shoukaku
const shoukakuOptions = {
    resume: true,
    resumeTimeout: 30,
    resumeByLibrary: true,
    reconnectTries: 3,
    reconnectInterval: 10,
    restTimeout: 10,
    moveOnDisconnect: true,
    userAgent: 'DeeJayPo/5.5 (DiscordBot; Shoukaku/v4)'
};

// Inicializar Shoukaku
const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes, shoukakuOptions);

shoukaku.on('error', (name, error) => console.error(`Lavalink Error en ${name}:`, error.message || error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node ${name} conectado correctamente.`));

// Colas de reproducción
const players = new Map();

// Comandos
const commands = [
    new SlashCommandBuilder()
        .setName('onegai')
        .setDescription('Reproduce música con Lavalink v4')
        .addStringOption(o => o.setName('query').setDescription('Canción a buscar').setRequired(true)),
    new SlashCommandBuilder().setName('skip').setDescription('Salta la canción'),
    new SlashCommandBuilder().setName('stop').setDescription('Detiene el bot'),
    new SlashCommandBuilder().setName('queue').setDescription('Ver la cola')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once(Events.ClientReady, async () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands actualizados.');
    } catch (e) { console.error('Error comandos:', e); }
});

client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand()) return;
    if (i.commandName === 'onegai') executePlay(i);
    if (i.commandName === 'skip') executeSkip(i);
    if (i.commandName === 'stop') executeStop(i);
    if (i.commandName === 'queue') executeQueue(i);
});

async function executePlay(i) {
    const q = i.options.getString('query');
    await i.deferReply();

    const ch = i.member.voice.channel;
    if (!ch) return i.editReply("¡Entra a un canal de voz!");

    const node = shoukaku.options.nodeResolver(shoukaku.nodes);
    if (!node) return i.editReply("No hay nodos de audio activos.");

    try {
        const isUrl = q.startsWith('http');
        const res = await node.rest.resolve(isUrl ? q : `ytsearch:${q}`);

        let tracks = [];
        if (res.loadType === 'track') tracks = [res.data];
        else if (res.loadType === 'playlist') tracks = res.data.tracks;
        else if (res.loadType === 'search') tracks = res.data;
        else if (Array.isArray(res.data)) tracks = res.data;

        if (!tracks || tracks.length === 0) return i.editReply("No encontré nada.");

        const track = tracks[0];
        const gid = i.guild.id;
        let pData = players.get(gid);

        if (!pData) {
            const player = await shoukaku.joinVoiceChannel({
                guildId: gid,
                channelId: ch.id,
                shardId: 0
            });
            pData = { shoukakuPlayer: player, queue: [] };
            players.set(gid, pData);

            player.on('end', () => {
                pData.queue.shift();
                playTrack(gid);
            });

            player.on('exception', (err) => {
                console.error("Error en reproductor:", err);
                pData.queue.shift();
                playTrack(gid);
            });
        }

        pData.queue.push(track);
        if (pData.queue.length === 1) {
            await playTrack(gid);
            i.editReply(`Reproduciendo: **${track.info.title}** 🎵`);
        } else {
            i.editReply(`Añadido: **${track.info.title}**`);
        }
    } catch (e) {
        console.error("Error:", e);
        i.editReply("Error al cargar la canción.");
    }
}

async function playTrack(gid) {
    const d = players.get(gid);
    if (!d || d.queue.length === 0) {
        if (d) shoukaku.leaveVoiceChannel(gid);
        players.delete(gid);
        return;
    }

    const track = d.queue[0];
    const encoded = track.encoded || track.track;

    try {
        // Estructura CRÍTICA para Lavalink v4 / Shoukaku v4
        // Debe ser un objeto con la propiedad 'track' que contenga 'encoded'
        await d.shoukakuPlayer.playTrack({
            track: { encoded: encoded }
        });
        console.log(`Reproduciendo ahora: ${track.info.title}`);
    } catch (e) {
        console.error("Error al enviar playTrack:", e);
        d.queue.shift();
        playTrack(gid);
    }
}

function executeSkip(i) {
    const d = players.get(i.guild.id);
    if (!d) return i.reply("No hay nada sonando.");
    d.shoukakuPlayer.stopTrack();
    i.reply("Saltada. ⏭️");
}

function executeStop(i) {
    const d = players.get(i.guild.id);
    if (!d) return i.reply("No hay nada sonando.");
    shoukaku.leaveVoiceChannel(i.guild.id);
    players.delete(i.guild.id);
    i.reply("Música detenida. 🛑");
}

function executeQueue(i) {
    const d = players.get(i.guild.id);
    if (!d || d.queue.length === 0) return i.reply("La cola está vacía.");
    const list = d.queue.slice(0, 10).map((t, idx) => `${idx + 1}. ${t.info.title}`).join("\n");
    i.reply(`**Cola actual:**\n${list}`);
}

client.login(TOKEN);
