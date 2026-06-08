CREATE DATABASE IF NOT EXISTS control_financiero
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE control_financiero;

DROP PROCEDURE IF EXISTS sp_transaction_list;
DROP PROCEDURE IF EXISTS sp_transaction_create;
DROP PROCEDURE IF EXISTS sp_transaction_update;
DROP PROCEDURE IF EXISTS sp_transaction_delete;
DROP PROCEDURE IF EXISTS sp_debt_list;
DROP PROCEDURE IF EXISTS sp_debt_create;
DROP PROCEDURE IF EXISTS sp_debt_update;
DROP PROCEDURE IF EXISTS sp_debt_delete;
DROP PROCEDURE IF EXISTS sp_seed_reset;

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS debts;

CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('income', 'expense', 'savings') NOT NULL,
  name VARCHAR(120) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  day TINYINT UNSIGNED NOT NULL,
  month CHAR(7) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE debts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  day TINYINT UNSIGNED NOT NULL,
  start_month CHAR(7) NOT NULL,
  end_month CHAR(7) NOT NULL,
  repeats ENUM('monthly', 'once') NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

DELIMITER //

CREATE PROCEDURE sp_transaction_list()
BEGIN
  SELECT id, type, name, amount, day, month FROM transactions ORDER BY month, day, id;
END//

CREATE PROCEDURE sp_transaction_create(
  IN p_type ENUM('income', 'expense', 'savings'),
  IN p_name VARCHAR(120),
  IN p_amount DECIMAL(10, 2),
  IN p_day TINYINT UNSIGNED,
  IN p_month CHAR(7)
)
BEGIN
  INSERT INTO transactions (type, name, amount, day, month)
  VALUES (p_type, p_name, p_amount, p_day, p_month);
  SELECT id, type, name, amount, day, month FROM transactions WHERE id = LAST_INSERT_ID();
END//

CREATE PROCEDURE sp_transaction_update(
  IN p_id INT,
  IN p_type ENUM('income', 'expense', 'savings'),
  IN p_name VARCHAR(120),
  IN p_amount DECIMAL(10, 2),
  IN p_day TINYINT UNSIGNED,
  IN p_month CHAR(7)
)
BEGIN
  UPDATE transactions
  SET type = p_type, name = p_name, amount = p_amount, day = p_day, month = p_month
  WHERE id = p_id;
  SELECT id, type, name, amount, day, month FROM transactions WHERE id = p_id;
END//

CREATE PROCEDURE sp_transaction_delete(IN p_id INT)
BEGIN
  DELETE FROM transactions WHERE id = p_id;
END//

CREATE PROCEDURE sp_debt_list()
BEGIN
  SELECT id, name, amount, day, start_month AS startMonth, end_month AS endMonth, repeats
  FROM debts
  ORDER BY start_month, day, id;
END//

CREATE PROCEDURE sp_debt_create(
  IN p_name VARCHAR(120),
  IN p_amount DECIMAL(10, 2),
  IN p_day TINYINT UNSIGNED,
  IN p_start_month CHAR(7),
  IN p_end_month CHAR(7),
  IN p_repeats ENUM('monthly', 'once')
)
BEGIN
  INSERT INTO debts (name, amount, day, start_month, end_month, repeats)
  VALUES (p_name, p_amount, p_day, p_start_month, p_end_month, p_repeats);
  SELECT id, name, amount, day, start_month AS startMonth, end_month AS endMonth, repeats
  FROM debts WHERE id = LAST_INSERT_ID();
END//

CREATE PROCEDURE sp_debt_update(
  IN p_id INT,
  IN p_name VARCHAR(120),
  IN p_amount DECIMAL(10, 2),
  IN p_day TINYINT UNSIGNED,
  IN p_start_month CHAR(7),
  IN p_end_month CHAR(7),
  IN p_repeats ENUM('monthly', 'once')
)
BEGIN
  UPDATE debts
  SET name = p_name, amount = p_amount, day = p_day, start_month = p_start_month,
      end_month = p_end_month, repeats = p_repeats
  WHERE id = p_id;
  SELECT id, name, amount, day, start_month AS startMonth, end_month AS endMonth, repeats
  FROM debts WHERE id = p_id;
END//

CREATE PROCEDURE sp_debt_delete(IN p_id INT)
BEGIN
  DELETE FROM debts WHERE id = p_id;
END//

CREATE PROCEDURE sp_seed_reset()
BEGIN
  TRUNCATE TABLE transactions;
  TRUNCATE TABLE debts;

  INSERT INTO debts (name, amount, day, start_month, end_month, repeats) VALUES
    ('Yape', 92.00, 2, '2026-06', '2026-08', 'monthly'),
    ('Caja Huancayo', 130.00, 2, '2026-06', '2026-08', 'monthly'),
    ('Angeles', 60.00, 2, '2026-07', '2026-07', 'once'),
    ('Mama', 57.00, 2, '2026-07', '2026-07', 'once');

  INSERT INTO transactions (type, name, amount, day, month) VALUES
    ('income', 'SUELDO', 750.00, 15, '2026-05'),
    ('savings', 'AHORRO PERSONAL', 113.30, 15, '2026-05'),
    ('expense', 'SERVICIOS HOGAR', 125.00, 15, '2026-05'),
    ('expense', 'ANGELES TC', 40.00, 15, '2026-05'),
    ('expense', 'CELULAR', 32.00, 15, '2026-05'),
    ('income', 'SUELDO', 560.00, 31, '2026-05'),
    ('savings', 'AHORRO PERSONAL', 84.00, 31, '2026-05'),
    ('expense', 'GASTOS HORMIGA', 209.70, 15, '2026-05'),
    ('expense', 'PASAJES TREN + COMBIS', 85.00, 15, '2026-05'),
    ('expense', 'SERVICIOS HOGAR', 33.00, 31, '2026-05'),
    ('expense', 'YAPE', 92.00, 31, '2026-05'),
    ('expense', 'PASAJES COMBIS + TREN', 85.00, 31, '2026-05'),
    ('expense', 'CAJA HUANCAYO', 86.00, 31, '2026-05'),
    ('income', 'SUELDO', 750.00, 15, '2026-06'),
    ('savings', 'AHORROS GENERALES', 113.30, 15, '2026-06'),
    ('expense', 'PASAJES TREN + COMBIS', 85.00, 15, '2026-06'),
    ('expense', 'CAJA HUANCAYO', 86.00, 15, '2026-06'),
    ('expense', 'GASTOS HOGAR', 125.00, 15, '2026-06'),
    ('expense', 'CELULAR', 32.00, 15, '2026-06');
END//

DELIMITER ;

CALL sp_seed_reset();
