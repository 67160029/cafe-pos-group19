CREATE TABLE IF NOT EXISTS employee_auth (
  employee_id INT PRIMARY KEY,
  password_hash VARCHAR(200) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_session (
  session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_employee_session_employee_expiry (employee_id, expires_at),
  FOREIGN KEY (employee_id) REFERENCES employee(employee_id) ON DELETE CASCADE
);
