const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(express.json());

const BOT_TOKEN  = process.env.BOT_TOKEN;
const GUILD_ID   = '1479577180102197491';
const API_SECRET = process.env.API_SECRET;

const ROLE_IDS = {
  1: '1479578255739846666', // Basico
  2: '1479578433620148274', // Intermedio
  3: '1479578492176961616', // Avanzado
  4: '1479578536481128599', // Elite
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('ready', () => console.log(`Bot listo: ${client.user.tag}`));
client.login(BOT_TOKEN);

app.post('/assign-role', async (req, res) => {
  const { discord_id, access_token, secret } = req.body;
  const package_id = parseInt(req.body.package_id);

  if (secret !== API_SECRET) return res.status(401).json({ error: 'No autorizado' });
  if (!discord_id || !package_id) return res.status(400).json({ error: 'Faltan datos' });

  const roleId = ROLE_IDS[package_id];
  if (!roleId) return res.status(400).json({ error: 'Paquete inválido: ' + package_id });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    // Unir al usuario al servidor
    if (access_token) {
      await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${discord_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token }),
      });
      await new Promise(r => setTimeout(r, 2000));
    }

    const member = await guild.members.fetch({ user: discord_id, force: true });

    // Solo agregar el rol — sin quitar nada
    await member.roles.add(roleId);

    console.log(`Rol ${roleId} asignado a ${discord_id} (paquete ${package_id})`);
    res.json({ success: true, message: `Rol asignado: paquete ${package_id}` });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Error asignando rol', detail: err.message });
  }
});

app.post('/remove-roles', async (req, res) => {
  const { discord_id, secret } = req.body;
  if (secret !== API_SECRET) return res.status(401).json({ error: 'No autorizado' });

  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch({ user: discord_id, force: true });
    const allRoles = Object.values(ROLE_IDS);
    const toRemove = allRoles.filter(r => member.roles.cache.has(r));
    if (toRemove.length > 0) await member.roles.remove(toRemove);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error quitando roles', detail: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok', bot: client.user?.tag }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
