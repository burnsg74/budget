export interface Account {
    ID: number;
    Name: string;
    Type: string;
    Classification?: string;  // Optional field
    Balance: number;
    MatchString?: string;     // Optional field
    Memo?: string;            // Optional field
}

export interface Budget {
    ID: number;
    BudgetID: number;
    AccountID: number;  // Foreign key referencing Accounts
    AccountName: string;
    Type: string;
    DueDay: number;
    DueAmount: number;
}


export interface Ledger {
    ID: number;
    Date: string;
    FromAccountID: number;    // Foreign key referencing Accounts
    FromAccountName: string;
    ToAccountID: number;      // Foreign key referencing Accounts
    ToAccountName: string;
    Amount: number;
    Classifications?: string; // Optional field
    Memo?: string;            // Optional field
    Hash: string;             // Unique constraint
}