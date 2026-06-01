<?php

declare(strict_types=1);

const SESSION_DAYS = 30;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function json_response(mixed $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

function json_error(string $message, int $status): void
{
    json_response(['error' => $message], $status);
}

function request_body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $payload = json_decode($raw, true);

    return is_array($payload) ? $payload : [];
}

function database(): PDO
{
    $host = getenv('JDR_DB_HOST') ?: '127.0.0.1';
    $port = getenv('JDR_DB_PORT') ?: '3306';
    $name = getenv('JDR_DB_NAME') ?: 'jdr_ambiances';
    $user = getenv('JDR_DB_USER') ?: 'root';
    $password = getenv('JDR_DB_PASSWORD') ?: '';
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

    $pdo = new PDO($dsn, $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS users (
            id CHAR(36) PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS sessions (
            id CHAR(36) PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            created_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            INDEX idx_sessions_user_id (user_id),
            INDEX idx_sessions_expires_at (expires_at),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS user_sync (
            user_id CHAR(36) PRIMARY KEY,
            data LONGTEXT NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    foreach (sync_tables() as $table) {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS {$table} (
                user_id CHAR(36) NOT NULL,
                item_id VARCHAR(190) NOT NULL,
                data LONGTEXT NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (user_id, item_id),
                INDEX idx_{$table}_user_id (user_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
        );
    }

    return $pdo;
}

function sync_tables(): array
{
    return [
        'user_sounds',
        'user_sound_folders',
        'user_custom_sounds',
        'user_campaign_images',
        'user_external_links',
        'user_scenes',
        'user_favorite_categories',
    ];
}

function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches) !== 1) {
        return null;
    }

    return trim($matches[1]);
}

function user_payload(array $user): array
{
    return [
        'id' => $user['id'],
        'email' => $user['email'],
        'createdAt' => $user['created_at'],
    ];
}

function find_user_by_email(PDO $pdo, string $email): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

function require_current_user(PDO $pdo): array
{
    $token = bearer_token();
    if (!$token) {
        json_error('Session manquante.', 401);
    }

    $stmt = $pdo->prepare(
        'SELECT users.*
         FROM sessions
         INNER JOIN users ON users.id = sessions.user_id
         WHERE sessions.token_hash = :token_hash AND sessions.expires_at > :now
         LIMIT 1'
    );
    $stmt->execute([
        'token_hash' => hash('sha256', $token),
        'now' => gmdate('Y-m-d H:i:s'),
    ]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        json_error('Session expiree. Reconnecte-toi.', 401);
    }

    return $user;
}

function create_session(PDO $pdo, string $userId): string
{
    $token = bin2hex(random_bytes(32));
    $now = gmdate('Y-m-d H:i:s');
    $expiresAt = gmdate('Y-m-d H:i:s', time() + SESSION_DAYS * 24 * 60 * 60);
    $stmt = $pdo->prepare(
        'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
         VALUES (:id, :user_id, :token_hash, :created_at, :expires_at)'
    );
    $stmt->execute([
        'id' => uuid(),
        'user_id' => $userId,
        'token_hash' => hash('sha256', $token),
        'created_at' => $now,
        'expires_at' => $expiresAt,
    ]);

    return $token;
}

function validate_credentials(array $payload): array
{
    $email = strtolower(trim((string)($payload['email'] ?? '')));
    $password = (string)($payload['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error('Adresse email invalide.', 422);
    }

    if (strlen($password) < 8) {
        json_error('Le mot de passe doit contenir au moins 8 caracteres.', 422);
    }

    return [$email, $password];
}

function sync_config(): array
{
    return [
        'sounds' => 'user_sounds',
        'soundFolders' => 'user_sound_folders',
        'customSounds' => 'user_custom_sounds',
        'campaignImages' => 'user_campaign_images',
        'externalLinks' => 'user_external_links',
        'scenes' => 'user_scenes',
    ];
}

function default_sync_data(): array
{
    return [
        'sounds' => [],
        'soundFolders' => [],
        'customSounds' => [],
        'campaignImages' => [],
        'externalLinks' => [],
        'scenes' => [],
        'favoriteCategoriesByFolder' => (object)[],
    ];
}

function save_sync_items(PDO $pdo, string $userId, string $table, array $items, string $updatedAt): void
{
    $pdo->prepare("DELETE FROM {$table} WHERE user_id = :user_id")->execute(['user_id' => $userId]);
    $stmt = $pdo->prepare(
        "INSERT INTO {$table} (user_id, item_id, data, updated_at)
         VALUES (:user_id, :item_id, :data, :updated_at)"
    );

    foreach ($items as $index => $item) {
        if (!is_array($item)) {
            continue;
        }

        $itemId = (string)($item['id'] ?? "{$table}-{$index}");
        $stmt->execute([
            'user_id' => $userId,
            'item_id' => $itemId,
            'data' => json_encode($item, JSON_THROW_ON_ERROR),
            'updated_at' => $updatedAt,
        ]);
    }
}

function save_favorites(PDO $pdo, string $userId, array $favoritesByFolder, string $updatedAt): void
{
    $pdo->prepare('DELETE FROM user_favorite_categories WHERE user_id = :user_id')->execute(['user_id' => $userId]);
    $stmt = $pdo->prepare(
        'INSERT INTO user_favorite_categories (user_id, item_id, data, updated_at)
         VALUES (:user_id, :item_id, :data, :updated_at)'
    );

    foreach ($favoritesByFolder as $folderId => $favorites) {
        if (!is_array($favorites)) {
            continue;
        }

        $stmt->execute([
            'user_id' => $userId,
            'item_id' => (string)$folderId,
            'data' => json_encode($favorites, JSON_THROW_ON_ERROR),
            'updated_at' => $updatedAt,
        ]);
    }
}

function read_sync_items(PDO $pdo, string $userId, string $table): array
{
    $stmt = $pdo->prepare("SELECT data FROM {$table} WHERE user_id = :user_id ORDER BY updated_at ASC");
    $stmt->execute(['user_id' => $userId]);
    $items = [];

    foreach ($stmt->fetchAll() as $row) {
        $item = json_decode((string)$row['data'], true);
        if (is_array($item)) {
            $items[] = $item;
        }
    }

    return $items;
}

function read_favorites(PDO $pdo, string $userId): array
{
    $stmt = $pdo->prepare('SELECT item_id, data FROM user_favorite_categories WHERE user_id = :user_id');
    $stmt->execute(['user_id' => $userId]);
    $favorites = [];

    foreach ($stmt->fetchAll() as $row) {
        $items = json_decode((string)$row['data'], true);
        $favorites[(string)$row['item_id']] = is_array($items) ? $items : [];
    }

    return $favorites;
}

function save_user_data(PDO $pdo, string $userId, array $data, string $updatedAt): void
{
    foreach (sync_config() as $key => $table) {
        save_sync_items($pdo, $userId, $table, is_array($data[$key] ?? null) ? $data[$key] : [], $updatedAt);
    }

    save_favorites(
        $pdo,
        $userId,
        is_array($data['favoriteCategoriesByFolder'] ?? null) ? $data['favoriteCategoriesByFolder'] : [],
        $updatedAt
    );
}

function read_user_data(PDO $pdo, string $userId): array
{
    $data = default_sync_data();

    foreach (sync_config() as $key => $table) {
        $data[$key] = read_sync_items($pdo, $userId, $table);
    }

    $data['favoriteCategoriesByFolder'] = read_favorites($pdo, $userId);

    return $data;
}

function user_has_sync_data(PDO $pdo, string $userId): bool
{
    foreach (sync_tables() as $table) {
        $stmt = $pdo->prepare("SELECT 1 FROM {$table} WHERE user_id = :user_id LIMIT 1");
        $stmt->execute(['user_id' => $userId]);
        if ($stmt->fetchColumn()) {
            return true;
        }
    }

    return false;
}

function last_sync_update(PDO $pdo, string $userId): ?string
{
    $latest = null;

    foreach (sync_tables() as $table) {
        $stmt = $pdo->prepare("SELECT MAX(updated_at) FROM {$table} WHERE user_id = :user_id");
        $stmt->execute(['user_id' => $userId]);
        $value = $stmt->fetchColumn();
        if (is_string($value) && ($latest === null || $value > $latest)) {
            $latest = $value;
        }
    }

    return $latest;
}

$pdo = database();
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$basePath = rtrim((string)(getenv('JDR_BASE_PATH') ?: ''), '/');
if ($basePath !== '' && str_starts_with($path, $basePath . '/')) {
    $path = substr($path, strlen($basePath));
}
if (str_starts_with($path, '/api/')) {
    $path = substr($path, 4);
}
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'POST' && $path === '/auth/register') {
        [$email, $password] = validate_credentials(request_body());

        if (find_user_by_email($pdo, $email)) {
            json_error('Un compte existe deja avec cette adresse email.', 409);
        }

        $now = gmdate('Y-m-d H:i:s');
        $user = [
            'id' => uuid(),
            'email' => $email,
            'created_at' => $now,
        ];
        $stmt = $pdo->prepare(
            'INSERT INTO users (id, email, password_hash, created_at)
             VALUES (:id, :email, :password_hash, :created_at)'
        );
        $stmt->execute([
            'id' => $user['id'],
            'email' => $user['email'],
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'created_at' => $user['created_at'],
        ]);

        json_response(['user' => user_payload($user), 'token' => create_session($pdo, $user['id'])], 201);
    }

    if ($method === 'POST' && $path === '/auth/login') {
        [$email, $password] = validate_credentials(request_body());
        $user = find_user_by_email($pdo, $email);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_error('Email ou mot de passe incorrect.', 401);
        }

        json_response(['user' => user_payload($user), 'token' => create_session($pdo, $user['id'])]);
    }

    if ($method === 'GET' && $path === '/auth/me') {
        json_response(user_payload(require_current_user($pdo)));
    }

    if ($method === 'POST' && $path === '/auth/logout') {
        $token = bearer_token();
        if ($token) {
            $stmt = $pdo->prepare('DELETE FROM sessions WHERE token_hash = :token_hash');
            $stmt->execute(['token_hash' => hash('sha256', $token)]);
        }

        json_response(['ok' => true]);
    }

    if ($method === 'GET' && $path === '/sync') {
        $user = require_current_user($pdo);

        if (!user_has_sync_data($pdo, $user['id'])) {
            $stmt = $pdo->prepare('SELECT data, updated_at FROM user_sync WHERE user_id = :user_id LIMIT 1');
            $stmt->execute(['user_id' => $user['id']]);
            $legacySync = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($legacySync) {
                $legacyData = json_decode((string)$legacySync['data'], true);
                if (is_array($legacyData)) {
                    save_user_data($pdo, $user['id'], $legacyData, (string)$legacySync['updated_at']);
                    json_response([
                        'data' => read_user_data($pdo, $user['id']),
                        'updatedAt' => $legacySync['updated_at'],
                    ]);
                }
            }

            json_response(['data' => null, 'updatedAt' => null]);
        }

        json_response([
            'data' => read_user_data($pdo, $user['id']),
            'updatedAt' => last_sync_update($pdo, $user['id']),
        ]);
    }

    if ($method === 'POST' && $path === '/sync') {
        $user = require_current_user($pdo);
        $payload = request_body();
        $data = $payload['data'] ?? null;

        if (!is_array($data)) {
            json_error('Donnees de synchronisation invalides.', 422);
        }

        $updatedAt = gmdate('Y-m-d H:i:s');
        $pdo->beginTransaction();
        save_user_data($pdo, $user['id'], $data, $updatedAt);
        $stmt = $pdo->prepare(
            'INSERT INTO user_sync (user_id, data, updated_at)
             VALUES (:user_id, :data, :updated_at)
             ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)'
        );
        $stmt->execute([
            'user_id' => $user['id'],
            'data' => json_encode($data, JSON_THROW_ON_ERROR),
            'updated_at' => $updatedAt,
        ]);
        $pdo->commit();

        json_response(['ok' => true, 'updatedAt' => $updatedAt]);
    }

    json_error('Route introuvable.', 404);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('Erreur serveur.', 500);
}
