<?php

/**
 * The game log: one row per game played with the app, for the playtesting
 * loop. The app posts twice per game, when it starts and when it ends.
 *
 * Runs on the web hotel next to the static app (copied from public/ into
 * dist/ by Vite). The database settings live in games-config.php, which
 * deploy.yml writes from repository secrets; it is never committed.
 *
 *   POST ./api/games.php   JSON body, see validate() below
 *     { "event": "start", "gameId": uuid, "at": ISO time, "commit": "abc1234",
 *       "seats": [{ "color": "blue", "bot": null | "easy" | ... }] }
 *     { "event": "end", "gameId": uuid, "at": ISO time, "moves": 412,
 *       "scores": [{ "player": 0, "color": "blue", "bot": null, "total": 61, ... }] }
 *   → 200 { "ok": true }
 *   → 4xx/5xx { "error": "..." }
 *
 * Debug mode ('debug' => true in the config, set by the GAMES_DEBUG
 * repository variable): a GET connects to the database and creates the
 * table without storing anything, and server errors include the real
 * message. Switch it off again afterwards: the messages name the database.
 *
 * Privacy: the visitor's IP address is never stored whole, only its network
 * (IPv4 /24, IPv6 /48), which is enough for rough geography. Player names
 * are not sent at all.
 */

declare(strict_types=1);

const BODY_MAX = 20_000; // bytes; a game's scores are about 1 kB
const PER_CLIENT = 30; // requests per client per WINDOW_SECONDS (an offline queue sends several at once)
const WINDOW_SECONDS = 600;
const COLOR_MAX = 20;
const COMMIT_MAX = 40;
const SCORE_FIELDS = ['scoringTrack', 'buildings', 'nobleMaterials', 'mannekenPis', 'total'];

/** The table. Plain types, so the same SQL works in MySQL and in SQLite (tests). */
const SCHEMA = <<<'SQL'
    CREATE TABLE IF NOT EXISTS games (
        game_id VARCHAR(36) NOT NULL PRIMARY KEY,
        ip_network VARCHAR(45) NULL,
        app_commit VARCHAR(40) NULL,
        player_count INT NULL,
        seats TEXT NULL,
        started_at DATETIME NULL,
        ended_at DATETIME NULL,
        start_received_at DATETIME NULL,
        end_received_at DATETIME NULL,
        moves INT NULL,
        winning_score INT NULL,
        scores TEXT NULL
    )
    SQL;

final class GameLogError extends Exception
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message);
    }
}

// --- Entry point --------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    handle();
    echo json_encode(['ok' => true]);
} catch (GameLogError $e) {
    http_response_code($e->status);
    echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('games: ' . $e->getMessage());
    http_response_code(500);
    $error = 'Something went wrong on the server.';
    if (debugMode()) {
        $error .= ' ' . get_class($e) . ': ' . $e->getMessage();
    }
    echo json_encode(['error' => $error]);
}

function handle(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method === 'GET' && debugMode()) {
        connect(loadConfig()); // throws with the real message if the database is out of reach
        return;
    }
    if ($method !== 'POST') {
        throw new GameLogError('Send game events with POST.', 405);
    }
    $config = loadConfig();

    $raw = file_get_contents('php://input', false, null, 0, BODY_MAX + 1);
    if ($raw === false || strlen($raw) > BODY_MAX) {
        throw new GameLogError('That game event is too big.', 413);
    }
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        throw new GameLogError('That was not a game event.', 400);
    }
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $event = validate($input, $now);

    $ip = (string) ($_SERVER[$config['client_key']] ?? '');
    if (!allowRequest($config['rate_dir'], hash('sha256', $ip . '|games'), $now->getTimestamp())) {
        throw new GameLogError('Too many game events. Try again later.', 429);
    }

    $db = connect($config);
    if ($event['event'] === 'start') {
        saveStart($db, $event, ipNetwork($ip), $now);
    } else {
        saveEnd($db, $event, ipNetwork($ip), $now);
    }
}

/**
 * The config file returns ['dsn' => 'mysql:host=...;dbname=...;charset=utf8mb4',
 * 'user' => ..., 'password' => ...]. Tests also set 'rate_dir' and 'client_key'
 * (which $_SERVER entry holds the visitor's address).
 *
 * @return array{dsn: string, user: string, password: string, rate_dir: string, client_key: string, debug: bool}
 */
function loadConfig(): array
{
    $path = getenv('BRUX_GAMES_CONFIG') ?: __DIR__ . '/games-config.php';
    $config = is_file($path) ? require $path : null;
    if (!is_array($config) || empty($config['dsn'])) {
        throw new GameLogError('The game log is off.', 503);
    }
    return [
        'dsn' => (string) $config['dsn'],
        'user' => (string) ($config['user'] ?? ''),
        'password' => (string) ($config['password'] ?? ''),
        'rate_dir' => (string) ($config['rate_dir'] ?? sys_get_temp_dir()),
        'client_key' => (string) ($config['client_key'] ?? 'REMOTE_ADDR'),
        'debug' => ($config['debug'] ?? false) === true,
    ];
}

function debugMode(): bool
{
    try {
        return loadConfig()['debug'];
    } catch (Throwable) {
        return false;
    }
}

// --- Checking the event ---------------------------------------------------------

/**
 * Checks what the app sent and returns the cleaned-up event.
 * Throws a GameLogError (400) when something is off.
 */
function validate(array $in, DateTimeImmutable $now): array
{
    $event = $in['event'] ?? null;
    if ($event !== 'start' && $event !== 'end') {
        throw new GameLogError('Is it the start or the end of a game?', 400);
    }
    $gameId = $in['gameId'] ?? null;
    if (!is_string($gameId) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $gameId)) {
        throw new GameLogError('The game has no valid id.', 400);
    }
    $at = clientTime($in['at'] ?? null, $now);

    if ($event === 'start') {
        $seats = $in['seats'] ?? null;
        if (!is_array($seats) || !array_is_list($seats) || count($seats) < 2 || count($seats) > 5) {
            throw new GameLogError('A game has 2 to 5 seats.', 400);
        }
        return [
            'event' => 'start',
            'gameId' => $gameId,
            'at' => $at,
            'commit' => mb_substr(text($in['commit'] ?? ''), 0, COMMIT_MAX),
            'seats' => array_map(fn($s) => seat($s), $seats),
        ];
    }

    $moves = $in['moves'] ?? null;
    if (!is_int($moves) || $moves < 0) {
        throw new GameLogError('How many moves were played?', 400);
    }
    $scores = $in['scores'] ?? null;
    if (!is_array($scores) || !array_is_list($scores) || count($scores) < 2 || count($scores) > 5) {
        throw new GameLogError('A game ends with 2 to 5 scores.', 400);
    }
    return [
        'event' => 'end',
        'gameId' => $gameId,
        'at' => $at,
        'moves' => $moves,
        'scores' => array_map(fn($s) => score($s), $scores),
    ];
}

/** The client's clock, in UTC. A queued event can be days old, but not from the future. */
function clientTime(mixed $value, DateTimeImmutable $now): string
{
    try {
        $time = is_string($value) ? new DateTimeImmutable($value) : null;
    } catch (Exception) {
        $time = null;
    }
    if ($time === null || $time > $now->modify('+1 day') || $time < $now->modify('-1 year')) {
        throw new GameLogError('The time of the event is missing or wrong.', 400);
    }
    return $time->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

/** @return array{color: string, bot: ?string} */
function seat(mixed $s): array
{
    if (!is_array($s)) {
        throw new GameLogError('A seat could not be read.', 400);
    }
    $bot = $s['bot'] ?? null;
    if ($bot !== null && (!is_string($bot) || !preg_match('/^[a-z]{1,20}$/', $bot))) {
        throw new GameLogError('A bot seat could not be read.', 400);
    }
    return ['color' => mb_substr(text($s['color'] ?? ''), 0, COLOR_MAX), 'bot' => $bot];
}

/** One seat's final score, field by field as the app's FinalScore has it. */
function score(mixed $s): array
{
    if (!is_array($s) || !is_int($s['player'] ?? null)) {
        throw new GameLogError('A score could not be read.', 400);
    }
    $rows = $s['rows'] ?? null;
    if (!is_array($rows) || !array_is_list($rows) || count($rows) !== 4 || array_filter($rows, fn($r) => !is_int($r))) {
        throw new GameLogError('A score could not be read.', 400);
    }
    $clean = ['player' => $s['player'], ...seat($s)];
    foreach (SCORE_FIELDS as $field) {
        if (!is_int($s[$field] ?? null)) {
            throw new GameLogError('A score could not be read.', 400);
        }
        $clean[$field] = $s[$field];
    }
    $clean['rows'] = $rows;
    return $clean;
}

function text(mixed $v): string
{
    return is_string($v) ? $v : '';
}

/**
 * The network part of an address: 203.0.113.57 → 203.0.113.0, and IPv6 keeps
 * its first 48 bits. Enough to tell roughly where, not who. null if unreadable.
 */
function ipNetwork(string $ip): ?string
{
    $packed = @inet_pton($ip);
    if ($packed === false) {
        return null;
    }
    $keep = strlen($packed) === 4 ? 3 : 6; // bytes
    return inet_ntop(substr($packed, 0, $keep) . str_repeat("\0", strlen($packed) - $keep));
}

/** A limited number of requests per client per ten minutes, so nobody can fill the table. */
function allowRequest(string $dir, string $client, int $now): bool
{
    $file = rtrim($dir, '/') . '/brux-games-' . substr($client, 0, 32) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return true; // no writable temp folder: better to log the game than to lose it
    }
    flock($handle, LOCK_EX);
    $times = json_decode(stream_get_contents($handle) ?: '[]', true);
    $recent = array_values(array_filter(is_array($times) ? $times : [], fn($t) => is_int($t) && $now - $t < WINDOW_SECONDS));
    $allowed = count($recent) < PER_CLIENT;
    if ($allowed) {
        $recent[] = $now;
    }
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($recent));
    flock($handle, LOCK_UN);
    fclose($handle);
    return $allowed;
}

// --- Storing --------------------------------------------------------------------

function connect(array $config): PDO
{
    $db = new PDO($config['dsn'], $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $db->exec(SCHEMA);
    return $db;
}

/**
 * Insert the row, or update it if the game is already there. A select first,
 * then an insert or an update: plain SQL that MySQL and SQLite both speak.
 */
function upsert(PDO $db, string $gameId, array $fields): void
{
    $exists = $db->prepare('SELECT 1 FROM games WHERE game_id = ?');
    $exists->execute([$gameId]);
    if ($exists->fetchColumn() === false) {
        $columns = ['game_id', ...array_keys($fields)];
        $sql = sprintf(
            'INSERT INTO games (%s) VALUES (%s)',
            implode(', ', $columns),
            implode(', ', array_fill(0, count($columns), '?')),
        );
        $db->prepare($sql)->execute([$gameId, ...array_values($fields)]);
    } else {
        $sets = implode(', ', array_map(fn($c) => "{$c} = ?", array_keys($fields)));
        $db->prepare("UPDATE games SET {$sets} WHERE game_id = ?")->execute([...array_values($fields), $gameId]);
    }
}

function saveStart(PDO $db, array $e, ?string $ipNetwork, DateTimeImmutable $now): void
{
    upsert($db, $e['gameId'], [
        'ip_network' => $ipNetwork,
        'app_commit' => $e['commit'],
        'player_count' => count($e['seats']),
        'seats' => json_encode($e['seats'], JSON_UNESCAPED_UNICODE),
        'started_at' => $e['at'],
        'start_received_at' => $now->format('Y-m-d H:i:s'),
    ]);
}

/** Ending again after an undo replaces the result. Keeps the start's address if there was one. */
function saveEnd(PDO $db, array $e, ?string $ipNetwork, DateTimeImmutable $now): void
{
    $fields = [
        'player_count' => count($e['scores']),
        'ended_at' => $e['at'],
        'end_received_at' => $now->format('Y-m-d H:i:s'),
        'moves' => $e['moves'],
        'winning_score' => max(array_column($e['scores'], 'total')),
        'scores' => json_encode($e['scores'], JSON_UNESCAPED_UNICODE),
    ];
    $known = $db->prepare('SELECT ip_network FROM games WHERE game_id = ?');
    $known->execute([$e['gameId']]);
    if (($known->fetchColumn() ?: null) === null) {
        $fields['ip_network'] = $ipNetwork;
    }
    upsert($db, $e['gameId'], $fields);
}
