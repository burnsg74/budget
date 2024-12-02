import React, {useState, useEffect} from "react";
import {Account, Budget} from "../types.tsx";

// "Income", "Bill", "Loan", "Credit Card", "Other", "Household"
const AccountManager: React.FC = () => {

    interface Record {
        ID: number;
        Name: string;
        Day: string;
        Amount: number;
    }

    const [accountData] = useState<Account[]>([]);
    // const [budgetData, setBudgetData] = useState<Budget[]>([]);
    const [IncomeData, setIncomeData] = useState<Record[]>([]);
    const [BillData, setBillData] = useState<Record[]>([]);
    const [LoanData, setLoanData] = useState<Record[]>([]);
    const [CreditCardData, setCreditCardData] = useState<Record[]>([]);
    const [houseHoldData, setHouseHoldData] = useState<Account[]>([]);
    const [currentAccount, setCurrentAccount] = useState<Account>({} as Account);

    const getAccountById = (accountId: number): Account | undefined => {
        return accountData.find((account) => account.ID === accountId);
    };

    const handleAccountClick = (accountId: number) => {
        console.log(accountId, getAccountById(accountId));
        setCurrentAccount(getAccountById(accountId) || {ID: 0, Name: "", Type: "", Balance: 0});
    };


    const fetchIncomeAccounts = async () => {
        const query = `SELECT A.Name, strftime('%d', L.Date) AS Day, L.Amount
                       FROM Ledger L
                                LEFT JOIN Accounts A on A.ID = L.FromAccountID
                       WHERE A.Type = 'Income'
                         AND L.Date like '2024-11%' ORDER BY L.Date`;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({query}),
            });

            const data: Record[] = await response.json();
            console.log(data);
            setIncomeData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchBillAccounts = async () => {
        const query = `SELECT A.Name, strftime('%d', L.Date) AS Day, L.Amount
                       FROM Ledger L
                                LEFT JOIN Accounts A on A.ID = L.ToAccountID
                       WHERE A.Type = 'Bill'
                         AND L.Date like '2024-11%'
        ORDER BY L.Date`;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({query}),
            });

            const data: Record[] = await response.json();
            console.log(data);
            setBillData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchLoanAccounts = async () => {
        const query = `SELECT A.Name, strftime('%d', L.Date) AS Day, L.Amount
                       FROM Ledger L
                                LEFT JOIN Accounts A on A.ID = L.ToAccountID
                       WHERE A.Type = 'Loan'
                         AND L.Date like '2024-11%' ORDER BY L.Date;`;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({query}),
            });

            const data: Record[] = await response.json();
            console.log(data);
            setLoanData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchCreditCardAccounts = async () => {
        const query = `SELECT A.Name, strftime('%d', L.Date) AS Day, L.Amount
                       FROM Ledger L
                                LEFT JOIN Accounts A on A.ID = L.ToAccountID
                       WHERE A.Type = 'Credit Card'
                         AND L.Date like '2024-11%' ORDER BY L.Date;`;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({query}),
            });

            const data: Record[] = await response.json();
            console.log(data);
            setCreditCardData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchAccounts = async () => {
        const query = `
            SELECT *
            FROM Accounts;
        `;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({query}),
            });

            const data: Account[] = await response.json();
            setCurrentAccount(data[0]);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchHousehold = async () => {
        const query = `
            SELECT Accounts.Name,
                   Ledger.ToAccountID,
                   ROUND(SUM(Ledger.Amount), 2) AS TotalAmount
            FROM Ledger
                     LEFT JOIN Accounts ON Ledger.ToAccountID = Accounts.ID
            WHERE Accounts.Type = 'Household'
              AND strftime('%Y-%m', Ledger.Date) = strftime('%Y-%m', 'now')
            GROUP BY Accounts.Name
            ORDER BY TotalAmount DESC;
        `;
        try {
            let response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({query}),
            });

            let data: Household[] = await response.json();
            setHouseHoldData(data);
        } catch (error) {
            console.error(error);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    useEffect(() => {
        fetchIncomeAccounts();
        fetchBillAccounts();
        fetchLoanAccounts();
        fetchCreditCardAccounts();
        fetchAccounts();
        fetchHousehold();
        // fetchBudget();
    }, []);

    return (
        <div className="container-fuild mt-3">
            <div className="row">
                <div className="col">
                    <h1>{new Date().toLocaleString("en-US", {month: "long"})}</h1>
                </div>
            </div>
            <div className="row">
                <div className="col-3">
                    <table id="budget-table" className="table">
                        <tbody>
                        <tr>
                            <th colSpan={3}>Bills</th>
                        </tr>
                        {BillData.map((bill: Record) => (
                            <tr
                                key={bill.ID}
                                onClick={() => handleAccountClick(bill.ID)}
                            >
                                <td>{bill.Name}:</td>
                                <td>{bill.Day}</td>
                                <td>{formatCurrency(bill.Amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={2}>Total:</td>
                            <td>{formatCurrency(BillData.reduce((sum, row) => sum + row.Amount, 0))}</td>
                        </tr>
                        <tr>
                            <td colSpan={3}>&nbsp;</td>
                        </tr>
                        <tr>
                            <th colSpan={3}>Loan</th>
                        </tr>
                        {LoanData.map((loan: Record) => (
                            <tr
                                key={loan.ID}
                                onClick={() => handleAccountClick(loan.ID)}
                            >
                                <td>{loan.Name}:</td>
                                <td>{loan.Day}</td>
                                <td>{formatCurrency(loan.Amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={2}>Total:</td>
                            <td>{formatCurrency(LoanData.reduce((sum, row) => sum + row.Amount, 0))}</td>
                        </tr>
                        <tr>
                            <td colSpan={3}>&nbsp;</td>
                        </tr>

                        <tr>
                            <th colSpan={3}>CreditCard</th>
                        </tr>
                        {CreditCardData.map((creditCard: Record) => (
                            <tr
                                key={creditCard.ID}
                                onClick={() => handleAccountClick(creditCard.ID)}
                            >
                                <td>{creditCard.Name}:</td>
                                <td>{creditCard.Day}</td>
                                <td>{formatCurrency(creditCard.Amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={2}>Total:</td>
                            <td>{formatCurrency(CreditCardData.reduce((sum, row) => sum + row.Amount, 0))}</td>
                        </tr>

                        <tr>
                            <td colSpan={3}>&nbsp;</td>
                        </tr>

                        <tr>
                            <th colSpan={3}>Income</th>
                        </tr>
                        {IncomeData.map((income: Record) => (
                            <tr
                                key={income.ID}
                                onClick={() => handleAccountClick(income.ID)}
                            >
                                <td>{income.Name}:</td>
                                <td>{income.Day}</td>
                                <td>{formatCurrency(income.Amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={2}>Total:</td>
                            <td>{formatCurrency(IncomeData.reduce((sum, row) => sum + row.Amount, 0))}</td>
                        </tr>

                        {/*{budgetData.map((budgetRow: Budget) => (*/}
                        {/*    <tr*/}
                        {/*        key={budgetRow.AccountID}*/}
                        {/*        className={`${budgetRow.Type.toLowerCase()} table-primary`}*/}
                        {/*        onClick={() => handleAccountClick(budgetRow.AccountID)}*/}
                        {/*    >*/}
                        {/*        <td style={{fontFamily: "Roboto, sans-serif"}}>{budgetRow.AccountName}:</td>*/}
                        {/*        <td>{budgetRow.DueDay}</td>*/}
                        {/*        <td>{formatCurrency(budgetRow.DueAmount)}</td>*/}
                        {/*        <td>{formatCurrency(budgetRow.Amount)}</td>*/}
                        {/*        <td width="100%"></td>*/}
                        {/*    </tr>*/}
                        {/*))}*/}
                        {/*<tr>*/}
                        {/*    <td colSpan={2} style={{fontFamily: "Roboto, sans-serif"}}>Total:</td>*/}
                        {/*    <td>{formatCurrency(budgetData.reduce((sum, row) => sum + row.DueAmount, 0))}</td>*/}
                        {/*    <td>{formatCurrency(budgetData.reduce((sum, row) => sum + row.Amount, 0))}</td>*/}
                        {/*</tr>*/}
                        {/*<tr>*/}
                        {/*    <th colSpan={5}>*/}
                        {/*        <hr/>*/}
                        {/*    </th>*/}
                        {/*</tr>*/}
                        {/*{["Income", "Bill", "Loan", "Other", "Household"].map((type: string) => (*/}
                        {/*    <tr key={type}>*/}
                        {/*        <td colSpan={3} className="text-end"><strong>Total {type}:</strong></td>*/}
                        {/*        <td>{formatCurrency(budgetData.filter((row) => row.Type === type).reduce((sum, row) => sum + row.DueAmount, 0))}</td>*/}
                        {/*        <td width="100%"></td>*/}
                        {/*    </tr>*/}
                        {/*))}*/}
                        {/*<tr className="total">*/}
                        {/*    <td colSpan={3} className="text-end"><strong>Total:</strong></td>*/}
                        {/*    <td>{formatCurrency(budgetData.reduce((sum, row) => sum + row.DueAmount, 0).toFixed(2))}</td>*/}
                        {/*    <td width="100%"></td>*/}
                        {/*</tr>*/}
                        </tbody>
                    </table>
                </div>
                <div className="col-3">
                    <h4>Household</h4>
                    <table id="household-table" className="table">
                        <thead>
                        <tr>
                            <th>Item</th>
                            <th>Amount</th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {houseHoldData.map((household: Household) => (
                            <tr key={household.ToAccountID} onClick={() => handleAccountClick(household.ToAccountID)}>
                                <td style={{
                                    whiteSpace: "nowrap",
                                    fontFamily: "Roboto, sans-serif"
                                }}>{household.Name}:
                                </td>
                                <td style={{whiteSpace: "nowrap"}}>{formatCurrency(household.TotalAmount)}</td>
                                <td width="100%"></td>
                            </tr>
                        ))}
                        <tr>
                            <td style={{whiteSpace: "nowrap", fontFamily: "Roboto, sans-serif"}}>Total:</td>
                            <td style={{whiteSpace: "nowrap"}}>{formatCurrency(houseHoldData.reduce((sum, row) => sum + row.TotalAmount, 0).toFixed(2))}</td>
                            <td width="100%"></td>
                        </tr>
                        </tbody>
                    </table>
                </div>
                {/*{currentAccount && (*/}
                {/*    <div id="account-div" className="col-6">*/}
                {/*        <h4>Account Details</h4>*/}
                {/*        <table id="account-table" className="table">*/}
                {/*            <tbody>*/}
                {/*            <tr>*/}
                {/*                <th>Name:</th>*/}
                {/*                <td>{(currentAccount as Account).Name}</td>*/}
                {/*                <td>{(currentAccount as Account).Type}</td>*/}
                {/*                <td>{(currentAccount as Account).Classification}</td>*/}
                {/*                <td>{formatCurrency((currentAccount as Account).Balance)}</td>*/}
                {/*                <td>{(currentAccount as Account).MatchString}</td>*/}
                {/*                <td>{(currentAccount as Account).Memo}</td>*/}
                {/*            </tr>*/}
                {/*            </tbody>*/}
                {/*        </table>*/}
                {/*    </div>*/}
                {/*)}*/}
            </div>
        </div>
    );
};

export default AccountManager;