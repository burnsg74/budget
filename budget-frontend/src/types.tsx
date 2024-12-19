export interface IAccount {
    id: number;
    name: string;
    type: string;
    classification?: string | null;
    balance: number;
    match_string?: string | null;
    memo?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_transaction_at?: string | null;
}
export type IAccounts = IAccount[];

export interface IBudget {
    id: number;
    account_id: number;
    account_name: string;
    type: string;
    due_day: number;
    due_amount: number;
}
export type IBudgets = IBudget[];

export interface ILedger {
    id: number;
    date: string;
    from_account_id: number;
    from_account_name: string;
    to_account_id: number;
    to_account_name: string;
    amount: number;
    classifications?: string | null;
    memo?: string | null;
    hash: string;
}
export type Ledgers = ILedger[];

export interface IBudgetBill {
    name: string;
    due_day: number;
    budget_amount: number;
    cleared_amount: number;
}

export interface ICreditCard {
    name: string;
    balance: number;
    due_day: number;
    budget_amount: number;
    cleared_amount: number;
}

export interface ILoan {
    name: string;
    balance: number;
    due_day: number;
    budget_amount: number;
    cleared_amount: number;
}

export interface IHousehold {
    name: string;
    budget_amount: number;
    cleared_amount: number;
}

export interface IOther {
    name: string;
    cleared_amount: number;
}

export interface IUnknown {
    name: string;
    cleared_amount: number;
}

export interface IIncome {
    name: string;
    cleared_amount: number;
}