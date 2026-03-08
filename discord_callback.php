<?php
// discord_callback.php — sube a public_html/
session_start();
require_once 'db.php';

define('DISCORD_CLIENT_ID',     '1479933587045351685');
define('DISCORD_CLIENT_SECRET', 'KoBp-XgfKIeP6dc8Rv0n_S8hopgiYNu2');
define('DISCORD_REDIRECT_URI',  'https://atlash.io/discord_callback.php');
define('BOT_API_URL',           'https://atlash-discord-bot-production.up.railway.app');
define('BOT_API_SECRET',        'atlash2024secret');

$code = $_GET['code'] ?? null;
if (!$code) { die('<h2>Error: no se recibió código.</h2><a href="/">Volver</a>'); }

// ── Paso 1: intercambiar code por access_token ───────────────
$tokenResponse = file_get_contents('https://discord.com/api/oauth2/token', false, stream_context_create([
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

$tokenData = json_decode($tokenResponse, true);
if (!isset($tokenData['access_token'])) {
    die('<h2>Error obteniendo token de Discord.</h2><pre>' . json_encode($tokenData, JSON_PRETTY_PRINT) . '</pre>');
}
$accessToken = $tokenData['access_token'];

// ── Paso 2: obtener info del usuario Discord ─────────────────
$userResponse = file_get_contents('https://discord.com/api/users/@me', false, stream_context_create([
    'http' => ['header' => 'Authorization: Bearer ' . $accessToken]
]));
$discordUser = json_decode($userResponse, true);
$discordId   = $discordUser['id'] ?? null;
if (!$discordId) { die('<h2>Error obteniendo usuario Discord.</h2>'); }

// ── Paso 3: obtener wallet del state o sesión ────────────────
$wallet = $_GET['state'] ?? $_SESSION['wallet'] ?? null;
if (!$wallet) { die('<h2>Error: conecta tu wallet primero.</h2><a href="/">Volver</a>'); }

// ── Paso 4: buscar paquete en la DB ──────────────────────────
try {
    $stmt = $pdo->prepare("
        SELECT package_id FROM compras 
        WHERE LOWER(wallet_address) = LOWER(?) 
        AND status = 'active' 
        ORDER BY created_at DESC LIMIT 1
    ");
    $stmt->execute([$wallet]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $packageId = $row['package_id'] ?? 0;
} catch (Exception $e) {
    die('<h2>Error DB: ' . $e->getMessage() . '</h2>');
}

if (!$packageId) {
    die('<h2>No tienes paquete activo.</h2><a href="/recompensas/recompensas.php">Ver paquetes</a>');
}

// ── Paso 5: llamar al bot (con access_token para agregar al servidor) ──
$botResponse = file_get_contents(BOT_API_URL . '/assign-role', false, stream_context_create([
    'http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/json\r\n",
        'content'       => json_encode([
            'discord_id'   => $discordId,
            'package_id'   => (int)$packageId,
            'access_token' => $accessToken,
            'secret'       => BOT_API_SECRET,
        ]),
        'ignore_errors' => true
    ]
]));

$botResult = json_decode($botResponse, true);

if ($botResult['success'] ?? false) {
    header('Location: https://discord.gg/gvnUqkcf');
    exit;
} else {
    die('<h2>Error: ' . json_encode($botResult) . '</h2>');
}
?>
