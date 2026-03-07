<?php
// discord_callback.php — va en public_html/
// Maneja el OAuth2 callback de Discord y asigna el rol

session_start();
require_once 'db.php';

define('DISCORD_CLIENT_ID',     '1479933587045351685');
define('DISCORD_CLIENT_SECRET', 'TU_CLIENT_SECRET_AQUI'); // ← lo ponemos abajo
define('DISCORD_REDIRECT_URI',  'https://atlash.io/discord_callback.php');
define('BOT_API_URL',           'TU_URL_DE_RAILWAY'); // ← después de hacer deploy
define('BOT_API_SECRET',        'TU_API_SECRET');      // ← misma que en Railway

// ── Paso 1: recibir el code de Discord ───────────────────────
$code = $_GET['code'] ?? null;
if (!$code) { die('Error: no se recibió código de Discord.'); }

// ── Paso 2: intercambiar code por access_token ───────────────
$response = file_get_contents('https://discord.com/api/oauth2/token', false, stream_context_create([
  'http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/x-www-form-urlencoded',
    'content' => http_build_query([
      'client_id'     => DISCORD_CLIENT_ID,
      'client_secret' => DISCORD_CLIENT_SECRET,
      'grant_type'    => 'authorization_code',
      'code'          => $code,
      'redirect_uri'  => DISCORD_REDIRECT_URI,
    ])
  ]
]));

$tokenData = json_decode($response, true);
if (!isset($tokenData['access_token'])) {
  die('Error obteniendo token: ' . json_encode($tokenData));
}

// ── Paso 3: obtener info del usuario Discord ─────────────────
$userResponse = file_get_contents('https://discord.com/api/users/@me', false, stream_context_create([
  'http' => [
    'header' => 'Authorization: Bearer ' . $tokenData['access_token']
  ]
]));

$discordUser = json_decode($userResponse, true);
$discordId   = $discordUser['id'] ?? null;

if (!$discordId) { die('Error obteniendo usuario Discord.'); }

// ── Paso 4: obtener wallet de la sesión ──────────────────────
$wallet = $_SESSION['wallet'] ?? $_GET['wallet'] ?? null;
if (!$wallet) { die('Error: no hay wallet en sesión.'); }

// ── Paso 5: buscar paquete en la DB ──────────────────────────
try {
  $stmt = $pdo->prepare("SELECT package_id FROM compras WHERE wallet_address = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1");
  $stmt->execute([$wallet]);
  $row = $stmt->fetch(PDO::FETCH_ASSOC);
  $packageId = $row['package_id'] ?? 0;
} catch (Exception $e) {
  die('Error DB: ' . $e->getMessage());
}

if (!$packageId) {
  die('No tienes un paquete activo. <a href="/recompensas/recompensas.php">Adquiere uno aquí</a>');
}

// ── Paso 6: llamar al bot para asignar rol ───────────────────
$botResponse = file_get_contents(BOT_API_URL . '/assign-role', false, stream_context_create([
  'http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode([
      'discord_id' => $discordId,
      'package_id' => $packageId,
      'secret'     => BOT_API_SECRET,
    ])
  ]
]));

$botResult = json_decode($botResponse, true);

// ── Paso 7: redirigir al servidor Discord ────────────────────
if ($botResult['success'] ?? false) {
  header('Location: https://discord.gg/TU_INVITE_AQUI');
  exit;
} else {
  die('Error asignando rol: ' . json_encode($botResult));
}
?>
