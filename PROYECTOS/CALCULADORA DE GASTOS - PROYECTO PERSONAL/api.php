<?php
declare(strict_types=1);

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $action = $_GET['action'] ?? '';
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true, 512, JSON_THROW_ON_ERROR);

    echo json_encode(handle($action, $payload), JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    error_log($error->getMessage());
    http_response_code($error instanceof InvalidArgumentException ? 422 : 500);
    echo json_encode([
        'ok' => false,
        'message' => $error instanceof InvalidArgumentException
            ? $error->getMessage()
            : 'No se pudo procesar la solicitud.',
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
    $data = validateTransaction($payload);
    $stmt = db()->prepare('CALL sp_transaction_create(?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $data['type'],
        $data['category'],
        $data['name'],
        $data['amount'],
        $data['day'],
        $data['month'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function updateTransaction(array $payload): array
{
    $data = validateTransaction($payload);
    $id = positiveId($payload['id'] ?? 0);
    $stmt = db()->prepare('CALL sp_transaction_update(?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $id,
        $data['type'],
        $data['category'],
        $data['name'],
        $data['amount'],
        $data['day'],
        $data['month'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function createDebt(array $payload): array
{
    $data = validateDebt($payload);
    $stmt = db()->prepare('CALL sp_debt_create(?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $data['name'],
        $data['amount'],
        $data['day'],
        $data['startMonth'],
        $data['endMonth'],
        $data['repeats'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function updateDebt(array $payload): array
{
    $data = validateDebt($payload);
    $id = positiveId($payload['id'] ?? 0);
    $stmt = db()->prepare('CALL sp_debt_update(?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $id,
        $data['name'],
        $data['amount'],
        $data['day'],
        $data['startMonth'],
        $data['endMonth'],
        $data['repeats'],
    ]);
    $record = normalizeRecord($stmt->fetch());
    $stmt->closeCursor();

    return ['ok' => true, 'record' => $record];
}

function deleteByProcedure(string $procedure, int $id): array
{
    $id = positiveId($id);
    $stmt = db()->prepare("CALL {$procedure}(?)");
    $stmt->execute([$id]);
    $stmt->closeCursor();

    return ['ok' => true];
}

function validateTransaction(array $payload): array
{
    $type = (string) ($payload['type'] ?? '');
    if (!in_array($type, ['income', 'expense', 'savings'], true)) {
        throw new InvalidArgumentException('Tipo de movimiento no válido.');
    }

    return [
        'type' => $type,
        'category' => limitedText($payload['category'] ?? 'Otros', 60, 'Categoría'),
        'name' => limitedText($payload['name'] ?? '', 120, 'Descripción'),
        'amount' => positiveAmount($payload['amount'] ?? 0),
        'day' => validDay($payload['day'] ?? 0),
        'month' => validMonth($payload['month'] ?? ''),
    ];
}

function validateDebt(array $payload): array
{
    $startMonth = validMonth($payload['startMonth'] ?? '');
    $endMonth = validMonth($payload['endMonth'] ?? '');
    $repeats = (string) ($payload['repeats'] ?? '');
    if (!in_array($repeats, ['monthly', 'once'], true)) {
        throw new InvalidArgumentException('Repetición no válida.');
    }

    return [
        'name' => limitedText($payload['name'] ?? '', 120, 'Nombre'),
        'amount' => positiveAmount($payload['amount'] ?? 0),
        'day' => validDay($payload['day'] ?? 0),
        'startMonth' => $startMonth,
        'endMonth' => $endMonth < $startMonth ? $startMonth : $endMonth,
        'repeats' => $repeats,
    ];
}

function limitedText(mixed $value, int $maxLength, string $field): string
{
    $text = trim((string) $value);
    if ($text === '' || mb_strlen($text) > $maxLength) {
        throw new InvalidArgumentException("{$field} no es válido.");
    }
    return $text;
}

function positiveAmount(mixed $value): float
{
    $amount = filter_var($value, FILTER_VALIDATE_FLOAT);
    if ($amount === false || $amount <= 0 || $amount > 99999999.99) {
        throw new InvalidArgumentException('Monto no válido.');
    }
    return (float) $amount;
}

function validDay(mixed $value): int
{
    $day = filter_var($value, FILTER_VALIDATE_INT);
    if ($day === false || $day < 1 || $day > 31) {
        throw new InvalidArgumentException('Día no válido.');
    }
    return (int) $day;
}

function validMonth(mixed $value): string
{
    $month = (string) $value;
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) {
        throw new InvalidArgumentException('Mes no válido.');
    }
    return $month;
}

function positiveId(mixed $value): int
{
    $id = filter_var($value, FILTER_VALIDATE_INT);
    if ($id === false || $id < 1) {
        throw new InvalidArgumentException('Identificador no válido.');
    }
    return (int) $id;
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
