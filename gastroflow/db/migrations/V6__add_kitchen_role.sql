-- Agrega el rol 'kitchen' al CHECK constraint de usuarios
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'manager', 'staff', 'kitchen'));
