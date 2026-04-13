<?php
/**
 * contact-me.php — Jon Grayson Portfolio
 * Deploy to: /php/contact-me.php on DreamHost
 *
 * Uses DreamHost's local sendmail/mail() with correct headers.
 * Key fix: FROM address must match your DreamHost-hosted domain.
 *
 * Spam defenses: honeypot, time-gate, rate limit,
 * validation, URL blocking, keyword list, referer check.
 */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

// ── CONFIG ─────────────────────────────────────────────
define('TO_EMAIL',    'jsguxd@gmail.com');
// IMPORTANT: FROM must be an address on your DreamHost-hosted domain
// This is what fixes silent delivery failure on shared hosting
define('FROM_EMAIL',  'noreply@jongrayson.com');
define('FROM_NAME',   'jongrayson.com Contact Form');
define('SITE_DOMAIN', 'jongrayson.com');
define('RATE_LIMIT',  10);
define('RATE_WINDOW', 3600);
define('MIN_TIME',    3);
define('RATE_DIR',    sys_get_temp_dir() . '/jg_rl/');
// ───────────────────────────────────────────────────────

function json_error(string $msg): void {
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}
function json_ok(): void {
    echo json_encode(['success' => true]);
    exit;
}

// 1. POST ONLY
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed.');

// 2. REFERER CHECK
$ref = $_SERVER['HTTP_REFERER'] ?? '';
if (!empty($ref) && strpos($ref, SITE_DOMAIN) === false) json_error('Invalid origin.');

// 3. HONEYPOT
if (trim($_POST['website'] ?? '') !== '') json_ok();

// 4. TIME-GATE
$ft      = intval($_POST['_form_time'] ?? 0);
$elapsed = ($ft > 0) ? (time() - intval($ft / 1000)) : 999;
if ($ft > 0 && $elapsed < MIN_TIME) json_error('Submission too fast. Please try again.');

// 5. RATE LIMIT
$ip   = preg_replace('/[^0-9a-fA-F:.]/', '', $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
$rfile = RATE_DIR . md5($ip) . '.json';
if (!is_dir(RATE_DIR)) mkdir(RATE_DIR, 0700, true);
$rate = ['count' => 0, 'window_start' => time()];
if (file_exists($rfile)) {
    $raw = json_decode(file_get_contents($rfile), true);
    if ($raw && (time() - ($raw['window_start'] ?? 0)) < RATE_WINDOW) $rate = $raw;
}
if ($rate['count'] >= RATE_LIMIT) json_error('Too many submissions. Please try again in an hour.');

// 6. SANITIZE
function clean(string $v, int $max = 500): string {
    return htmlspecialchars(substr(trim(strip_tags($v)), 0, $max), ENT_QUOTES, 'UTF-8');
}
$name    = clean($_POST['contact_name']    ?? '', 100);
$org     = clean($_POST['contact_org']     ?? '', 150);
$email   = filter_var(trim($_POST['contact_email'] ?? ''), FILTER_SANITIZE_EMAIL);
$type    = clean($_POST['contact_type']    ?? '', 150);
$message = clean($_POST['contact_message'] ?? '', 2000);

// 7. VALIDATE
if (empty($name))                                              json_error('Name is required.');
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('A valid email is required.');
if (empty($message))                                           json_error('Message is required.');
if (str_word_count($message) < 3)                              json_error('Please add more detail to your message.');

// 8. SPAM CHECKS
if (preg_match('/https?:\/\//i', $message) || preg_match('/\bwww\./i', $message))
    json_error('Message may not contain links.');
$all = strtolower("$name $org $message");
foreach (['casino','poker','viagra','cialis','crypto','bitcoin','nft','make money',
          'earn money','work from home','click here','seo service','buy followers',
          'guaranteed','prize','lottery','free money','adult','escort','xxx',
          'weight loss','fat burner','backlink','buy traffic','passive income'] as $kw) {
    if (strpos($all, $kw) !== false) json_ok();
}
if (substr_count($name, '.') > 1 || preg_match('/[<>{}|\\\\]/', $name . $message)) json_ok();

// 9. BUILD EMAIL
$div  = str_repeat('-', 52);
$subj = '=?UTF-8?B?' . base64_encode('New Contact: ' . $name . (!empty($org) ? ' — ' . $org : '')) . '?=';
$body = "New contact form submission\njongrayson.com\n$div\n\n"
      . "NAME:          $name\n"
      . (!empty($org)  ? "ORGANIZATION:  $org\n"  : '')
      . "EMAIL:         $email\n"
      . (!empty($type) ? "ENGAGEMENT:    $type\n" : '')
      . "\nMESSAGE:\n$div\n$message\n\n$div\n"
      . "Submitted:     " . date('Y-m-d H:i:s T') . "\n"
      . "Elapsed:       {$elapsed}s after page load\n";

// 10. SEND — correct headers for DreamHost shared hosting
// Reply-To lets you hit Reply in Gmail and it goes to the visitor
$headers  = 'From: ' . FROM_NAME . ' <' . FROM_EMAIL . ">\r\n";
$headers .= 'Reply-To: ' . $name . ' <' . $email . ">\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "X-Priority: 3\r\n";

// Use sendmail_from param to set envelope sender — critical for deliverability
$params = '-f' . FROM_EMAIL;

$sent = mail(TO_EMAIL, $subj, $body, $headers, $params);

if (!$sent) {
    error_log('[contact-me.php] mail() returned false for submission from: ' . $email);
    json_error('Delivery failed. Please connect via LinkedIn while this is resolved.');
}

// 11. RATE LIMIT INCREMENT
$rate['count']++;
file_put_contents($rfile, json_encode($rate), LOCK_EX);

json_ok();
