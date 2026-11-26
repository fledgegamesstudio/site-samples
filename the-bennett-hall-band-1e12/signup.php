<?php
declare(strict_types=1);

/*
 * Email list signup for a musician client site. Lives in the web root as /signup.php; everything it keeps lives
 * outside it. No third-party service, script or cookie: a plain POST, one JSON line per signup in
 * <data_dir>/signups.jsonl (outside the web root), a honeypot field, and a per-visitor rate limit.
 *
 * Config: a PHP file returning an array (private/signup-config.php, written by bin/package.mjs), found at the path in
 * the SIGNUP_CONFIG environment variable (nginx: fastcgi_param SIGNUP_CONFIG ...) or ../private/signup-config.php.
 *   'places'   => list of place tags the form offers (a posted place must be one of them, or empty)
 *   'salt'     => random text; the visitor's IP is stored only as a salted hash, for the rate limit
 *   'data_dir' => folder for signups.jsonl and the rate files
 *
 * Every row has "confirmed": false. Nothing is emailed from here: a double opt-in message needs working outgoing
 * mail on the server, which is a separate step (see premium/README.md, musician kind).
 * Tests define SIGNUP_LIB_ONLY before including this file and call signup_handle() directly.
 */

const SIGNUP_PER_HOUR = 5;

function signup_line(mixed $v, int $max): string
{
    $s = is_string($v) ? $v : '';
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

/**
 * @param array<string, mixed> $post
 * @param array{places: list<string>, salt: string, data_dir: string} $cfg
 * @return array{0: int, 1: string} [HTTP status, where to go or a message]: 303 + path, or 400/429/405 + words
 */
function signup_handle(string $method, array $post, string $ip, array $cfg, ?int $now = null): array
{
    $now ??= time();
    if ($method !== 'POST') {
        return [405, 'Use the form on the site.'];
    }
    if (signup_line($post['website'] ?? '', 100) !== '') {
        return [303, '/thanks/'];   // a bot filled the hidden field: look like success, keep nothing
    }
    $email = strtolower(signup_line($post['email'] ?? '', 200));
    if ($email === '' || strlen($email) > 200 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return [400, 'That email address does not look right. Go back and check it.'];
    }
    $place = signup_line($post['place'] ?? '', 80);
    if ($place !== '' && !in_array($place, $cfg['places'], true)) {
        return [400, 'Pick a place from the list, or leave it empty.'];
    }
    // Optional US ZIP code: lets bin/near-show.py find fans within driving distance of a new show.
    $zip = signup_line($post['zip'] ?? '', 10);
    if ($zip !== '' && preg_match('/^\d{5}$/', $zip) !== 1) {
        return [400, 'A ZIP code is 5 numbers. Go back and fix it, or leave it empty.'];
    }
    $dir = rtrim($cfg['data_dir'], '/');
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        return [500, 'The list is not working right now. Please try again later.'];
    }
    $who = hash('sha256', $cfg['salt'] . $ip);
    $rate = "$dir/rate-" . substr($who, 0, 24) . '.json';
    $hits = [];
    if (is_file($rate)) {
        $hits = json_decode((string) file_get_contents($rate), true);
        $hits = is_array($hits) ? array_values(array_filter($hits, static fn ($t) => is_int($t) && $t > $now - 3600)) : [];
    }
    if (count($hits) >= SIGNUP_PER_HOUR) {
        return [429, 'Too many tries from this connection. Please wait an hour.'];
    }
    $hits[] = $now;
    file_put_contents($rate, json_encode($hits), LOCK_EX);

    $file = "$dir/signups.jsonl";
    $seen = is_file($file) && str_contains((string) file_get_contents($file), json_encode($email, JSON_UNESCAPED_SLASHES));
    if (!$seen) {
        $row = json_encode(['email' => $email, 'place' => $place, 'zip' => $zip, 'at' => gmdate('c', $now), 'who' => substr($who, 0, 16), 'confirmed' => false], JSON_UNESCAPED_SLASHES);
        file_put_contents($file, $row . "\n", FILE_APPEND | LOCK_EX);
        @chmod($file, 0600);
    }
    return [303, '/thanks/'];   // the same answer for a new and a repeated address
}

if (!defined('SIGNUP_LIB_ONLY')) {
    $path = getenv('SIGNUP_CONFIG') ?: __DIR__ . '/../private/signup-config.php';
    $cfg = is_file($path) ? require $path : null;
    if (!is_array($cfg)) {
        http_response_code(500);
        exit('The list is not set up yet.');
    }
    [$status, $out] = signup_handle($_SERVER['REQUEST_METHOD'] ?? 'GET', $_POST, $_SERVER['REMOTE_ADDR'] ?? '', $cfg);
    header('Cache-Control: no-store');
    if ($status === 303) {
        header('Location: ' . $out, true, 303);
        exit;
    }
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!DOCTYPE html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>Email list</title></head><body><main><p>'
        . htmlspecialchars($out, ENT_QUOTES) . '</p><p><a href="/">Back to the site</a></p></main></body></html>';
}
