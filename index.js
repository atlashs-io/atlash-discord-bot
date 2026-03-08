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

// Roles acumulativos — Elite ve todo, Basico solo basico
const ROLES_POR_PAQUETE = {
  1: [1],
  2: [1, 2],
  3: [1, 2, 3],
  4: [1, 2, 3, 4],
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('ready', () => console.log(`Bot listo: ${client.user.tag}`));
client.login(BOT_TOKEN);

// ── Endpoint principal ────────────────────────────────────────
app.post('/assign-role', async (req, res) => {
  const { discord_id, package_id, access_token, secret } = req.body;

  if (secret !== API_SECRET) return res.status(401).json({ error: 'No autorizado' });
  if (!discord_id || !package_id) return res.status(400).json({ error: 'Faltan datos' });

  const roleId = ROLE_IDS[package_id];
  if (!roleId) return res.status(400).json({ error: 'Paquete inválido' });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    // ── Paso 1: unir al usuario al servidor si tiene access_token ──
    if (access_token) {
      await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${discord_id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${BOT_TOKEN}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ access_token }),
      });
      // Esperar un momento para que Discord procese la entrada
      await new Promise(r => setTimeout(r, 1500));
    }

    // ── Paso 2: obtener el miembro (ya debe estar en el servidor) ──
    const member = await guild.members.fetch({ user: discord_id, force: true });

    // ── Paso 3: quitar todos los roles de paquete anteriores ──────
    const allRoles = Object.values(ROLE_IDS);
    const toRemove = allRoles.filter(r => member.roles.cache.has(r));
    if (toRemove.length > 0) await member.roles.remove(toRemove);

    // ── Paso 4: asignar roles acumulativos según paquete ─────────
    const rolesAAsignar = ROLES_POR_PAQUETE[package_id].map(n => ROLE_IDS[n]);
    await member.roles.add(rolesAAsignar);

    res.json({ success: true, message: `Roles asignados para paquete ${package_id}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error asignando rol', detail: err.message });
  }
});

// ── Quitar roles (para cuando vence el paquete) ───────────────
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

// ── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', bot: client.user?.tag }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
