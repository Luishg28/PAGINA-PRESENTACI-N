<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $action = $_GET['action'] ?? '';
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true, 512, JSON_THROW_ON_ERROR);

    echo json_encode(handle($action, $payload), JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => $error->getMessage(),
    ]);
}

function handle(string $action, array $payload): array
{
    return match ($action) {
        'load' => loadState(),
        'createTransaction' => createTransaction($payload),
        'updateTransaction' => updateTransaction($payload),
        'deleteTransaction' => deleteByProcedure('sp_transaction_delete', (int) ($payload['id'] ?? 0)),
        'createDebt' => createDebt($payload),
        'updateDebt' => updateDebt($payload),
        'deleteDebt' => deleteByProcedure('sp_debt_delete', (int) ($payload['id'] ?? 0)),
        'reset' => resetSeeds(),
        default => ['ok' => false, 'message' => 'Accion no valida'],
    };
}

function loadState(): array
{
    return [
        'ok' => true,
        'transactions' => callList('sp_transaction_list'),
        'debts' => callList('sp_debt_list'),
    ];
}

function createTransaction(array $payload): array
{
    $stmt = db()->prepare('CALL sp_transaction_create(?, ?, ?, ?, ?)');
    $stmt->execute([
        $payload['type'],
        trim((string) $payload['name']),
        (float) $payload['amount'],
        (int) $payload['day'],
        $payload['month'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function updateTransaction(array $payload): array
{
    $stmt = db()->prepare('CALL sp_transaction_update(?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        (int) $payload['id'],
        $payload['type'],
        trim((string) $payload['name']),
        (float) $payload['amount'],
        (int) $payload['day'],
        $payload['month'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function createDebt(array $payload): array
{
    $stmt = db()->prepare('CALL sp_debt_create(?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        trim((string) $payload['name']),
        (float) $payload['amount'],
        (int) $payload['day'],
        $payload['startMonth'],
        $payload['endMonth'],
        $payload['repeats'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function updateDebt(array $payload): array
{
    $stmt = db()->prepare('CALL sp_debt_update(?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        (int) $payload['id'],
        trim((string) $payload['name']),
        (float) $payload['amount'],
        (int) $payload['day'],
        $payload['startMonth'],
        $payload['endMonth'],
        $payload['repeats'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function deleteByProcedure(string $procedure, int $id): array
{
    $stmt = db()->prepare("CALL {$procedure}(?)");
    $stmt->execute([$id]);
    $stmt->closeCursor();

    return ['ok' => true];
}

function resetSeeds(): array
{
    $stmt = db()->query('CALL sp_seed_reset()');
    $stmt->closeCursor();
    return loadState();
}

function callList(string $procedure): array
{
    $stmt = db()->query("CALL {$procedure}()");
    $records = array_map('normalizeRecord', $stmt->fetchAll());
    $stmt->closeCursor();

    return $records;
}

function normalizeRecord(array $record): array
{
    foreach (['amount'] as $field) {
        if (isset($record[$field])) {
            $record[$field] = (float) $record[$field];
        }
    }

    foreach (['id', 'day'] as $field) {
        if (isset($record[$field])) {
            $record[$field] = (int) $record[$field];
        }
    }

    return $record;
}
