CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) > 0),
  type text NOT NULL CHECK (
    type IN (
      'checking',
      'income',
      'credit_card',
      'loan',
      'bill',
      'household',
      'other'
    )
  ),
  institution text,
  mask text,
  opening_balance_cents bigint NOT NULL DEFAULT 0,
  opening_on date,
  expected_amount_cents bigint,
  due_day smallint CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  schedule_active boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  matched_account_id uuid REFERENCES accounts (id) ON DELETE RESTRICT,
  posted_on date NOT NULL,
  description text NOT NULL,
  amount_cents bigint NOT NULL,
  check_number text,
  status text NOT NULL,
  classification text,
  fingerprint text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (matched_account_id IS NULL OR matched_account_id <> account_id)
);

CREATE INDEX transactions_account_posted_idx
  ON transactions (account_id, posted_on);

CREATE INDEX transactions_matched_posted_idx
  ON transactions (matched_account_id, posted_on);

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  skipped_status_count integer NOT NULL,
  duplicate_count integer NOT NULL,
  inserted_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
