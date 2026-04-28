// ========== API Response Types ==========
export interface ApiResponse<T> {
  items: T[];
  total: number;
}

export interface ApiError {
  detail?: string;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

// ========== Auth Types ==========
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  preferred_language: string;
  is_active: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  preferred_language?: string;
}

// ========== Card Types ==========
export type CardType = 'credit' | 'debit' | 'prepaid';
export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'discover';

export interface Card {
  id: string;
  card_name: string;
  bank_name: string;
  card_type: CardType;
  card_network?: CardNetwork | string;
  card_category?: string;
  card_ownership?: string;
  card_last_four: string;
  expiry_month?: number;
  expiry_year?: number;
  notes?: string;
  color_hex?: string;
  is_favorite: boolean;
  available_balance?: number;
  balance_currency: string;
  statement_date?: number;
  payment_due_date?: number;
  minimum_payment?: number;
  minimum_payment_percentage?: number | null;
  credit_limit?: number;
  current_balance?: number;
  last_payment_date?: string;
  last_payment_amount?: number;
  late_payment_fee?: number;
  over_limit_fee?: number;
  supplementary_card_fee?: number;
  annual_fee?: number;
  fee_due_date?: string;
  renewal_type?: string;
  has_waiver_condition?: boolean;
  waiver_condition?: string;
  card_replacement_fee?: number;
  account_manager_name?: string;
  account_manager_phone?: string;
  bank_emails?: string;
  card_benefits?: string;
  created_at: string;
  updated_at: string;
  // Revealed fields (only when reveal=true)
  card_number?: string;
  cardholder_name?: string;
  cvv?: string;
  iban?: string;
}

export interface CardCreateRequest {
  card_name: string;
  bank_name: string;
  card_type: CardType;
  card_network?: string;
  card_number: string;
  cardholder_name?: string;
  expiry_month?: number | null;
  expiry_year?: number | null;
  cvv?: string;
  iban?: string;
  notes?: string;
  color_hex?: string;
  available_balance?: number | null;
  balance_currency?: string;
  statement_date?: number | null;
  payment_due_date?: number | null;
  minimum_payment?: number | null;
  minimum_payment_percentage?: number | null;
  credit_limit?: number | null;
  current_balance?: number | null;
  card_benefits?: string;
}

export interface CardUpdateRequest {
  card_name?: string;
  bank_name?: string;
  card_type?: CardType;
  card_network?: string;
  expiry_month?: number;
  expiry_year?: number;
  notes?: string;
  color_hex?: string;
  is_favorite?: boolean;
  available_balance?: number;
  balance_currency?: string;
  cardholder_name?: string;
}

// ========== Transaction Types ==========
export type TransactionType = 'purchase' | 'withdrawal' | 'payment' | 'refund' | 'transfer';

export interface Transaction {
  id: string;
  card_id?: string;
  card_name?: string;
  card_last_four?: string;
  transaction_type: TransactionType;
  amount: number;
  currency: string;
  merchant_name?: string;
  description?: string;
  category?: string;
  transaction_date: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionCreateRequest {
  card_id?: string;
  transaction_type: TransactionType;
  amount: number;
  currency: string;
  merchant_name?: string | null;
  description?: string | null;
  category?: string | null;
  transaction_date: string;
}

// ========== Cash Entry Types ==========
export type CashEntryType = 'income' | 'expense';

export interface CashEntry {
  id: string;
  entry_type: CashEntryType;
  amount: number;
  currency: string;
  description?: string;
  category?: string;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface CashEntryCreateRequest {
  entry_type: CashEntryType;
  amount: number;
  currency: string;
  description?: string;
  category?: string;
  entry_date: string;
}

// ========== Dashboard Types ==========
export interface MonthlySummary {
  year: number;
  month: number;
  total_spent: number;
  total_income: number;
  net: number;
  currency: string;
}

export interface MonthlyChartData {
  month: string;
  spent: number;
  income: number;
}

export interface CategoryChartData {
  name: string;
  value: number;
}

// ========== SMS Parser Types ==========
export interface ParsedSMSResult {
  bank_name: string;
  currency: string;
  amount: number;
  card_last_four?: string;
  merchant_name?: string;
  transaction_date: string;
  transaction_type: TransactionType;
  raw_message: string;
  matched_card_id?: string;
  matched_card_name?: string;
  suggested_card_id?: string;
  suggested_card_name?: string;
  transaction_id?: string;
  created?: boolean;
  duplicate?: boolean;
  auto_created?: boolean;
  card_used?: string;
  error?: string;
  message?: string;
}
