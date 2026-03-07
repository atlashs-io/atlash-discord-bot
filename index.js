const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(express.json());

const BOT_TOKEN   = process.env.BOT_TOKEN;
const GUILD_ID    = '1479577180102197491';
const API_SECRET  = process.env.API_SECRET; // clave entre PHP y el bot

const ROLE_IDS = {
  1: '1479578255739846666', // Básico
  2: '1479578433620148274', // Intermedio
  3: '1479578492176961616', // Avanzado
  4: '1479578536481128599', // Elite
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', () => console.log(`Bot listo: ${client.user.tag}`));
client.login(BOT_TOKEN);

// ── Endpoint que llama Hostinger ──────────────────────────────
app.post('/assign-role', async (req, res) => {
  const { discord_id, package_id, secret } = req.body;

  if (secret !== API_SECRET) return res.status(401).json({ error: 'No autorizado' });
  if (!discord_id || !package_id) return res.status(400).json({ error: 'Faltan datos' });

  const roleId = ROLE_IDS[package_id];
  if (!roleId) return res.status(400).json({ error: 'Paquete inválido' });

  try {
    const guild  = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discord_id);

    // Quitar todos los roles de paquete primero
    const allRoles = Object.values(ROLE_IDS);
    await member.roles.remove(allRoles.filter(r => member.roles.cache.has(r)));

    // Asignar el rol correcto
    await member.roles.add(roleId);

    res.json({ success: true, message: `Rol asignado: paquete ${package_id}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error asignando rol', detail: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
