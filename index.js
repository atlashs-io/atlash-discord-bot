const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
app.use(express.json());

const BOT_TOKEN  = process.env.BOT_TOKEN;
const GUILD_ID   = '1479577180102197491';
const API_SECRET = process.env.API_SECRET;

const ROLE_IDS = {
  1: '1479578255739846666', // Básico
  2: '1479578433620148274', // Intermedio
  3: '1479578492176961616', // Avanzado
  4: '1479578536481128599', // Elite
};

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.once('ready', () => console.log(`Bot listo: ${client.user.tag}`));
client.login(BOT_TOKEN);

app.post('/assign-role', async (req, res) => {
  const { discord_id, package_id, access_token, secret } = req.body;

  if (secret !== API_SECRET) return res.status(401).json({ error: 'No autorizado' });
  if (!discord_id || !package_id) return res.status(400).json({ error: 'Faltan datos' });

  const roleId = ROLE_IDS[package_id];
  if (!roleId) return res.status(400).json({ error: 'Paquete inválido' });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);

    // Primero agregar al usuario al servidor usando su access_token
    if (access_token) {
      try {
        await guild.members.add(discord_id, { accessToken: access_token });
        console.log(`Usuario ${discord_id} agregado al servidor`);
      } catch (addErr) {
        // Si ya está en el servidor, continuar
        console.log(`Usuario ya en servidor o error al agregar: ${addErr.message}`);
      }
    }

    // Esperar un momento para que Discord procese el ingreso
    await new Promise(r => setTimeout(r, 1500));

    // Obtener el miembro y asignar rol
    const member = await guild.members.fetch(discord_id);

    // Quitar todos los roles de paquete primero
    const allRoles = Object.values(ROLE_IDS);
    const toRemove = allRoles.filter(r => member.roles.cache.has(r));
    if (toRemove.length > 0) await member.roles.remove(toRemove);

    // Asignar el rol correcto
    await member.roles.add(roleId);

    console.log(`Rol paquete ${package_id} asignado a ${discord_id}`);
    res.json({ success: true, message: `Rol asignado: paquete ${package_id}` });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Error asignando rol', detail: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
