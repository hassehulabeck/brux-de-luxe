<?php

/**
 * The suggestion box: turns a bug report or an idea from the app into a
 * GitHub issue. For a bug, the saved game is committed to the
 * `bug-reports` branch and linked from the issue, so it can be replayed.
 *
 * Runs on the web hotel next to the static app (copied from public/ into
 * dist/ by Vite). The GitHub token lives in feedback-config.php, which
 * deploy.yml writes from repository secrets; it is never committed.
 *
 *   POST ./api/feedback.php   JSON body, see validate() below
 *   → 200 { "issue": 12 }
 *   → 4xx/5xx { "error": "A sentence to show the player" }
 */

declare(strict_types=1);

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;
const NAME_MAX = 60;
const BODY_MAX = 2_000_000; // bytes; a whole saved game is far smaller
const PER_CLIENT = 5; // reports per client per WINDOW_SECONDS
const WINDOW_SECONDS = 600;
const REPORTS_BRANCH = 'bug-reports';
const FROM_APP_LABEL = 'from-the-app';
const KINDS = [
    'bug' => ['word' => 'Bug', 'label' => 'bug'],
    'idea' => ['word' => 'Idea', 'label' => 'enhancement'],
];

final class FeedbackError extends Exception
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
    echo json_encode(['issue' => handle()]);
} catch (FeedbackError $e) {
    http_response_code($e->status);
    echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('feedback: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Something went wrong on the server. Try again later.']);
}

function handle(): int
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        throw new FeedbackError('Send suggestions with POST.', 405);
    }
    $config = loadConfig();

    $raw = file_get_contents('php://input', false, null, 0, BODY_MAX + 1);
    if ($raw === false || strlen($raw) > BODY_MAX) {
        throw new FeedbackError('That report is too big to send.', 413);
    }
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        throw new FeedbackError('That was not a suggestion.', 400);
    }
    $feedback = validate($input);

    $client = hash('sha256', ($_SERVER[$config['client_key']] ?? '') . '|' . $config['repo']);
    if (!allowFeedback($config['rate_dir'], $client, time())) {
        throw new FeedbackError("That's a lot of suggestions! Wait a few minutes.", 429);
    }

    return submitFeedback(new GitHub($config), $feedback, new DateTimeImmutable('now', new DateTimeZone('UTC')));
}

/**
 * The config file returns ['token' => ..., 'repo' => 'owner/name']. Tests also set
 * 'api' (a fake GitHub), 'rate_dir' and 'client_key' (which $_SERVER entry tells clients apart).
 *
 * @return array{token: string, repo: string, api: string, rate_dir: string, client_key: string}
 */
function loadConfig(): array
{
    $path = getenv('BRUX_FEEDBACK_CONFIG') ?: __DIR__ . '/feedback-config.php';
    $config = is_file($path) ? require $path : null;
    if (!is_array($config) || empty($config['token']) || empty($config['repo'])) {
        throw new FeedbackError('The suggestion box is closed for now.', 503);
    }
    return [
        'token' => (string) $config['token'],
        'repo' => (string) $config['repo'],
        'api' => rtrim((string) ($config['api'] ?? 'https://api.github.com'), '/'),
        'rate_dir' => (string) ($config['rate_dir'] ?? sys_get_temp_dir()),
        'client_key' => (string) ($config['client_key'] ?? 'REMOTE_ADDR'),
    ];
}

// --- Checking the form ----------------------------------------------------------

/**
 * Checks what the app sent and returns the cleaned-up fields.
 * Throws a FeedbackError with a friendly sentence when something is off.
 */
function validate(array $in): array
{
    // Honeypot: the field is hidden in the form, so only bots fill it in.
    if (trim((string) ($in['website'] ?? '')) !== '') {
        throw new FeedbackError('That was not a suggestion.', 400);
    }
    $kind = $in['kind'] ?? null;
    if (!is_string($kind) || !isset(KINDS[$kind])) {
        throw new FeedbackError('Is it a bug or an idea?', 400);
    }
    $title = trim(text($in['title'] ?? ''));
    if (mb_strlen($title) < 3) {
        throw new FeedbackError('Give it a short title.', 400);
    }
    if (mb_strlen($title) > TITLE_MAX) {
        throw new FeedbackError('Keep the title under ' . TITLE_MAX . ' characters.', 400);
    }
    $description = trim(text($in['description'] ?? ''));
    if ($description === '') {
        throw new FeedbackError('Tell us a bit more.', 400);
    }
    if (mb_strlen($description) > DESCRIPTION_MAX) {
        throw new FeedbackError('That description is too long.', 400);
    }
    $name = mb_substr(trim(text($in['name'] ?? '')), 0, NAME_MAX);

    $c = is_array($in['client'] ?? null) ? $in['client'] : [];
    $client = [
        'commit' => mb_substr(text($c['commit'] ?? ''), 0, 40),
        'userAgent' => mb_substr(text($c['userAgent'] ?? ''), 0, 300),
        'screen' => mb_substr(text($c['screen'] ?? ''), 0, 40),
    ];
    $summary = mb_substr(trim(text($in['summary'] ?? '')), 0, 300);

    $attachment = null;
    if (isset($in['attachment'])) {
        $a = $in['attachment'];
        if (!is_array($a) || !is_array($a['game'] ?? null) || ($a['game']['version'] ?? null) !== 1) {
            throw new FeedbackError('The attached game could not be read.', 400);
        }
        $errors = array_slice(array_map(fn($e) => mb_substr(text($e), 0, 4000), (array) ($a['errors'] ?? [])), 0, 20);
        $attachment = ['game' => $a['game'], 'errors' => array_values($errors)];
    }

    return compact('kind', 'title', 'description', 'name', 'client', 'summary', 'attachment');
}

function text(mixed $v): string
{
    return is_string($v) ? $v : '';
}

/** A few reports per client per ten minutes, so a stuck button can't flood the issues. */
function allowFeedback(string $dir, string $client, int $now): bool
{
    $file = rtrim($dir, '/') . '/brux-feedback-' . substr($client, 0, 32) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return true; // no writable temp folder: better to take the report than to lose it
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

// --- Filing the issue ------------------------------------------------------------

function submitFeedback(GitHub $gh, array $f, DateTimeImmutable $now): int
{
    $gh->ensureLabel(FROM_APP_LABEL, '8a4b14', 'Sent from the suggestion box in the app');

    $filePath = null;
    $fileUrl = null;
    if ($f['attachment'] !== null) {
        $filePath = sprintf('reports/%s/%s-%s.json', $now->format('Y-m-d'), $now->format('His'), bin2hex(random_bytes(4)));
        $report = [
            'format' => 'brux-report/1',
            'receivedAt' => $now->format(DATE_ATOM),
            'kind' => $f['kind'],
            'title' => $f['title'],
            'client' => $f['client'],
            'errors' => $f['attachment']['errors'],
            'game' => $f['attachment']['game'],
        ];
        $json = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $fileUrl = $gh->commitFile(REPORTS_BRANCH, $filePath, $json, 'Report: ' . $f['title']);
    }

    $kind = KINDS[$f['kind']];
    $version = $f['client']['commit'] !== '' ? " ({$f['client']['commit']})" : '';
    return $gh->createIssue(
        "[{$kind['word']}] {$f['title']}{$version}",
        issueBody($f, $filePath, $fileUrl),
        [$kind['label'], FROM_APP_LABEL],
    );
}

/** The repo is public: keep free text from pinging GitHub users. */
function defang(string $s): string
{
    return str_replace('@', "@\u{200B}", $s);
}

function issueBody(array $f, ?string $filePath, ?string $fileUrl): string
{
    $c = $f['client'];
    $lines = ['**From:** ' . defang($f['name'] !== '' ? $f['name'] : 'Anonymous')];
    if ($c['commit'] !== '') {
        $lines[] = "**Version:** {$c['commit']}";
    }
    if ($f['summary'] !== '') {
        $lines[] = '**Game:** ' . defang($f['summary']);
    }
    $lines[] = '**Browser:** ' . defang(trim("{$c['userAgent']} · {$c['screen']}", ' ·'));
    array_push($lines, '', '### Description', '', defang($f['description']));
    if ($filePath !== null && $fileUrl !== null) {
        array_push(
            $lines,
            '',
            '### Game',
            '',
            "[{$filePath}]({$fileUrl}): the setup and every move so far.",
            '',
            'Replay it: download the file and open it with **Import** on the start screen, or',
            '`git fetch origin ' . REPORTS_BRANCH . ' && git show origin/' . REPORTS_BRANCH . ':' . $filePath . ' > report.json`',
        );
    }
    $errors = $f['attachment']['errors'] ?? [];
    if ($errors) {
        array_push($lines, '', '### Errors in the browser', '', '```');
        array_push($lines, ...array_map(fn($e) => str_replace('```', "'''", $e), $errors));
        $lines[] = '```';
    }
    return implode("\n", $lines);
}

/** The small slice of the GitHub REST API the suggestion box needs. */
final class GitHub
{
    public function __construct(private readonly array $config) {}

    /** @return array{0: int, 1: mixed} status and decoded body */
    private function call(string $method, string $path, ?array $body = null): array
    {
        $curl = curl_init("{$this->config['api']}/repos/{$this->config['repo']}{$path}");
        curl_setopt_array($curl, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => [
                "Authorization: Bearer {$this->config['token']}",
                'Accept: application/vnd.github+json',
                'X-GitHub-Api-Version: 2022-11-28',
                'Content-Type: application/json',
                'User-Agent: brux-de-luxe-feedback',
            ],
            CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body),
        ]);
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($response === false) {
            throw new FeedbackError("Couldn't reach GitHub. Try again in a moment.", 502);
        }
        return [$status, json_decode((string) $response, true)];
    }

    /** Like call(), but anything other than 2xx is an error. */
    private function ok(string $method, string $path, ?array $body = null): mixed
    {
        [$status, $data] = $this->call($method, $path, $body);
        if ($status < 200 || $status >= 300) {
            error_log("feedback: GitHub {$method} {$path}: {$status} " . json_encode($data));
            throw new FeedbackError("Couldn't send it right now. Try again later.", 502);
        }
        return $data;
    }

    public function ensureLabel(string $name, string $color, string $description): void
    {
        [$status] = $this->call('POST', '/labels', compact('name', 'color', 'description'));
        if ($status >= 300 && $status !== 422) { // 422: the label is already there
            error_log("feedback: GitHub label {$status}");
        }
    }

    public function createIssue(string $title, string $body, array $labels): int
    {
        return (int) $this->ok('POST', '/issues', compact('title', 'body', 'labels'))['number'];
    }

    /** Commits one file to $branch (created as an orphan branch if missing). Returns its web URL. */
    public function commitFile(string $branch, string $path, string $content, string $message): string
    {
        try {
            $this->commitOnce($branch, $path, $content, $message);
        } catch (FeedbackError) {
            // Two reports at once: the second branch update is not a fast-forward. Try once more on the new head.
            $this->commitOnce($branch, $path, $content, $message);
        }
        return "https://github.com/{$this->config['repo']}/blob/{$branch}/{$path}";
    }

    private function commitOnce(string $branch, string $path, string $content, string $message): void
    {
        [$status, $ref] = $this->call('GET', "/git/ref/heads/{$branch}");
        $parent = $status === 200 ? $ref['object']['sha'] : null;
        $tree = ['tree' => [['path' => $path, 'mode' => '100644', 'type' => 'blob', 'content' => $content]]];
        if ($parent !== null) {
            $tree['base_tree'] = $this->ok('GET', "/git/commits/{$parent}")['tree']['sha'];
        }
        $treeSha = $this->ok('POST', '/git/trees', $tree)['sha'];
        $commit = $this->ok('POST', '/git/commits', ['message' => $message, 'tree' => $treeSha, 'parents' => $parent ? [$parent] : []]);
        if ($parent !== null) {
            $this->ok('PATCH', "/git/refs/heads/{$branch}", ['sha' => $commit['sha']]);
        } else {
            $this->ok('POST', '/git/refs', ['ref' => "refs/heads/{$branch}", 'sha' => $commit['sha']]);
        }
    }
}
