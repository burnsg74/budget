import React, {useEffect, useState} from "react";
import './Home.css';
import {fetchData} from "../../utils/db";
import {AgCharts} from "ag-charts-react";
import {AgChartOptions} from 'ag-charts-community';
import EditableField from "../../components/EditableCell/EditableCell";

/*
@TODO
- Double Click edit
- Combine Budget and Cleared Bidget will be gray Cleared Black
 */

// ==== Typescript ==== //
type AccountType = "Income" | "Bill" | "Household" | "Credit Card" | "Loan" | "Other" | "Unknown";

interface Account {
    type: AccountType;
    column: string;
}

interface MonthLedger {
    id: number;
    type: string;
    name: string;
    due_day: number;
    budget_amount: number;
    cleared_amount: number;
}

interface AccountDetails {
    id: number;
    name: string;
    type: AccountType;
    classification?: string;
    balance: number;
    due_day?: number;
    min_amount: number;
    budget_amount: number;
    match_string?: string;
    memo?: string;
    created_at: Date;
    updated_at: Date;
    last_transaction_at?: Date;
    active: boolean;
}

const HomePage: React.FC = () => {

    // ==== States ==== //
    const [reportDate, setReportDate] = useState<Date>(new Date());
    const accounts: Account[] = [
        {type: "Income", column: "Left"},
        {type: "Bill", column: "Left"},
        {type: "Loan", column: "Left"},
        {type: "Credit Card", column: "Left"},
        {type: "Other", column: "Left"},
        {type: "Unknown", column: "Left"},
        {type: "Household", column: "Middle"}
    ];
    const [selectedAccount, setSelectedAccount] = useState<AccountDetails | null>(null);
    const [monthLedger, setMonthLedger] = useState<MonthLedger[]>([]);
    const [accountHistory, setAccountHistory] = useState<{ date: string, amount: number }[] | null>(null);
    const [chartOptions, setChartOptions] = useState<AgChartOptions>({
        data: [],
        series: [
            {
                type: 'line',
                xKey: 'date',
                yKey: 'amount',
                marker: {
                    enabled: true,
                },
            },
        ],
        axes: [
            {
                type: 'time',
                position: 'bottom',
                title: {
                    text: 'Date',
                },
            },
            {
                type: 'number',
                position: 'left',
                title: {
                    text: 'Amount',
                },
            },
        ],
        legend: {
            position: 'bottom',
        },
    });

    // ==== useEffect ==== //
    useEffect(() => {
        const date = `${reportDate.getFullYear()}-${(reportDate.getMonth() + 1).toString().padStart(2, '0')}` + '%';
        const pdate = `${reportDate.getFullYear()}-${(reportDate.getMonth()).toString().padStart(2, '0')}` + '%';
        console.log(pdate,date);
        Promise.all([
            fetchData<MonthLedger[]>(`SELECT a.*, SUM(l.amount) as cleared_amount
                                      FROM accounts a
                                               INNER JOIN ledger l
                                                         ON l.from_account_id = a.id 
                                                             AND (l.date LIKE '${date}' )
                                      WHERE a.active = 1
                                        AND a.type = 'Income'
                                      GROUP BY a.id
                                      ORDER BY due_day`),
            fetchData<MonthLedger[]>(`SELECT a.*, SUM(l.amount) as cleared_amount
                                      FROM accounts a
                                               INNER JOIN ledger l
                                                         ON l.to_account_id = a.id AND (l.date LIKE '${date}')
                                      WHERE a.active = 1
                                        AND a.type != 'Income'
                                      GROUP BY a.id
                                      ORDER BY due_day`),
            fetchData<MonthLedger[]>(`SELECT *
                                      FROM accounts a
                                               INNER JOIN ledger l
                                                         ON l.from_account_id = a.id 
                                                             AND (l.date LIKE '${pdate}' )
                                      WHERE a.active = 1
                                        AND a.type = 'Income'
                                      GROUP BY a.id
                                      ORDER BY due_day`),
            fetchData<MonthLedger[]>(`SELECT a.*
                                      FROM accounts a
                                               INNER JOIN ledger l
                                                         ON l.to_account_id = a.id AND (l.date LIKE '${pdate}')
                                      WHERE a.active = 1
                                        AND (a.type != 'Income' AND a.type != 'Household')
                                      GROUP BY a.id
                                      ORDER BY due_day`),
        ])
            .then(([incomeData, otherData,pincomeData, potherData]) => {
                console.log('isCurrentMonth()',isCurrentMonth())
                console.log('incomeData',incomeData);
                console.log('otherData',otherData);
                const mergedData = [
                    ...incomeData,
                    ...otherData,
                    ...pincomeData.filter(
                        (pItem) => !incomeData.some((item) => item.id === pItem.id)
                    ),
                    ...potherData.filter(
                        (pItem) => !otherData.some((item) => item.id === pItem.id)
                    )]
                setMonthLedger(mergedData);
            })
            .catch((error) => {
                console.error('Error fetching month ledger data:', error);
            });
    }, [reportDate]);

    // ==== Event Handlers ==== //
    const handleBackClick = () => {
        setReportDate(prevDate => {
            const newDate = new Date(prevDate);
            console.log(newDate.toISOString())
            newDate.setMonth(prevDate.getMonth() - 1);
            console.log(newDate.toISOString())
            return newDate;
        });
    };

    const handleNextClick = () => {
        setReportDate(prevDate => {
            const newDate = new Date(prevDate);
            newDate.setMonth(prevDate.getMonth() + 1);
            console.log(newDate.toISOString())
            return newDate;
        });
    };

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const fetchAccount = async (accountId: number): Promise<AccountDetails | null> => {
        const sql = `SELECT *
                     FROM main.accounts
                     WHERE id = ${accountId}`;
        const accounts = await fetchData<AccountDetails[]>(sql);
        if (accounts.length > 0) {
            return {...accounts[0]};
        }
        return null;
    };

    const fetchAccountHistory = async (accountId: number) => {
        const sql = `SELECT date, amount
                     FROM ledger
                     WHERE to_account_id = ${accountId}
                     ORDER BY date ASC`;
        const historyData = await fetchData<{ date: string, amount: number }[]>(sql);

        if (historyData) {
            setChartOptions({
                data: historyData, series: [{type: 'line', xKey: 'date', yKey: 'amount'}],
            });
        }

        return historyData;
    };

    function handleAccountClick(id: number) {
        console.log('Account ID: ' + id + ' clicked');
        fetchAccount(id).then(account => {
            if (account) {
                setSelectedAccount(account);
            }
        });
        fetchAccountHistory(id).then(setAccountHistory);
    }

    const handleFieldSave = (field: keyof AccountDetails, value: string | number) => {
        if (selectedAccount) {
            // Update the database or server
            fetchData(
                `UPDATE accounts SET ${field} = ${typeof value === "number" ? value : `'${value}'`} WHERE id = ${
                    selectedAccount.id
                }`
            ).then(() => {
                // Update the local state with the new value
                setSelectedAccount({ ...selectedAccount, [field]: value });
            });
        }
    };


    function isCurrentMonth() {
        return reportDate.getMonth() === new Date().getMonth() && reportDate.getFullYear() === new Date().getFullYear();
    }

// ==== Render ==== //
    return (<div>
        <div className="month-navigation">
            <button onClick={handleBackClick}> ⬅️</button>
            {/*<h1>{reportDate.toLocaleString("en-US", {month: "long", year: "numeric"})}</h1>*/}
            <h1>
                {reportDate.toLocaleString("en-US",
                    isCurrentMonth()
                        ? { day: "numeric", month: "long", year: "numeric" } // Show day too
                        : { month: "long", year: "numeric" } // Show only month and year
                )}
            </h1>
            <button onClick={handleNextClick}> ➡️</button>
        </div>
        <div className="columns">
            <div className="leftColumn">
                {/*Summary Box*/}
                <table className="summery-table">
                    <thead>
                    <tr>
                        <th>Category</th>
                        <th>Budget</th>
                        <th>Cleared</th>
                        <th>Delta</th>
                    </tr>
                    </thead>
                    <tbody>
                    {(() => {
                        const accountTotals: { [type: string]: { budget: number; cleared: number } } = {};
                        monthLedger.forEach((entry) => {
                            if (entry.type === "Income") return;
                            if (entry.type === "Household") {
                                entry.budget_amount = entry.cleared_amount;
                            }
                            if (!accountTotals[entry.type]) {
                                accountTotals[entry.type] = {budget: 0, cleared: 0};
                            }
                            accountTotals[entry.type].budget += entry.budget_amount || 0;
                            accountTotals[entry.type].cleared += entry.cleared_amount || 0;
                        });

                        let totalIncome = 0;
                        let totalExpenses = 0;
                        let totalBudget = 0;
                        let totals = {
                            budget: 0,
                            cleared: 0,
                            delta: 0,
                        };

                        const rows = Object.entries(accountTotals).map(([type, totals]) => {
                            if (type === "Bank") return null;
                            if (type === "Other") return null;
                            if (type === "Unknown") return null;
                            if (type === "Income") {
                                totalIncome += totals.cleared;
                            } else {
                                totalBudget += totals.budget;
                                totalExpenses += totals.cleared;
                            }

                            return (
                                <tr key={type} className={`${type.toLowerCase().replace(/\s+/g, '-')}`}>
                                    <td>{type}</td>
                                    <td>{formatCurrency(totals.budget)}</td>
                                    <td>{formatCurrency(totals.cleared)}</td>
                                    <td>{formatCurrency(totals.cleared - totals.budget)}</td>
                                </tr>
                            );
                        });

                        rows.push(
                            <tr key="summary-total" className="bold">
                                <td className="total-label">Totals</td>
                                <td>{formatCurrency(totalBudget)}</td>
                                <td>{formatCurrency(totalExpenses)}</td>
                                <td>
                                    {formatCurrency(totalBudget - totalExpenses)}
                                </td>
                            </tr>
                        );

                        return rows;
                    })()}
                    </tbody>
                </table>
                <table className="left-table">
                    <tbody>
                    {accounts
                        .filter((account) => account.column === "Left")
                        .map((account, index) => {
                            const relevantEntries = monthLedger.filter((entry) =>
                                entry.type === account.type
                            );
                            if (relevantEntries.length === 0) {
                                return null;
                            }
                            const totalAmount = relevantEntries.reduce(
                                (sum, entry) => sum + entry.budget_amount,
                                0
                            );
                            const totalCleared = relevantEntries.reduce(
                                (sum, entry) => sum + entry.cleared_amount,
                                0
                            );

                            return (
                                <React.Fragment key={index}>
                                    <tr>
                                        <td className={`title ${account.type.toLowerCase().replace(/\s+/g, '-')}`}
                                            colSpan={3}>
                                            {account.type}
                                        </td>
                                    </tr>
                                    {/*onClick={() => handleAccountClick(bill)}*/}
                                    {relevantEntries.map((entry) => (
                                        <tr
                                            key={entry.id}
                                            onClick={() => handleAccountClick(entry.id)}
                                            className={`entry-row ${entry.cleared_amount > 0 ? 'posted' : 'estimated'} ${account.type.toLowerCase().replace(/\s+/g, '-')}`}>
                                            <td>
                                                {entry.name}
                                                {(account.type === 'Loan' || account.type === 'Credit Card') && (
                                                    <span> ({formatCurrency(entry.balance)}) </span>
                                                )}
                                            </td>
                                            <td>
                                                {entry.due_day}
                                            </td>
                                            <td>
                                                {entry.cleared_amount > 0
                                                    ? formatCurrency(entry.cleared_amount)
                                                    : formatCurrency(entry.budget_amount)}
                                            </td>
                                        </tr>
                                    ))}

                                    {/*{relevantEntries.length > 0 && (*/}
                                    {/*    <tr className={`${account.type.toLowerCase().replace(/\s+/g, '-')}`}>*/}
                                    {/*        <td className="bold bt total-label" colSpan={2}>TOTAL</td>*/}
                                    {/*        <td className="bold bt">{formatCurrency(totalAmount)}</td>*/}
                                    {/*        <td className="bold bt">{formatCurrency(totalCleared)}</td>*/}
                                    {/*    </tr>*/}
                                    {/*)}*/}

                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="middleColumn">
                <table className="left-table">
                    <tbody>
                    {accounts
                        .filter((account) => account.column === "Middle")
                        .map((account, index) => {
                            const relevantEntries = monthLedger
                                .filter((entry) => entry.type === account.type && entry.cleared_amount > 0)
                                .sort((a, b) => b.cleared_amount - a.cleared_amount);

                            const totalCleared = relevantEntries.reduce(
                                (sum, entry) => sum + entry.cleared_amount,
                                0
                            );

                            return (
                                <React.Fragment key={index}>
                                    <tr>
                                        <td className={`title ${account.type.toLowerCase().replace(/\s+/g, '-')}`}
                                            colSpan={2}>
                                            {account.type}
                                        </td>
                                    </tr>

                                    {relevantEntries.map((entry) => (
                                        <tr key={entry.id}
                                            className={`${account.type.toLowerCase().replace(/\s+/g, '-')}`}>
                                            <td>{entry.name}</td>
                                            <td>{formatCurrency(entry.cleared_amount)}</td>
                                        </tr>
                                    ))}

                                    {relevantEntries.length > 0 && (
                                        <tr className="totals-row bt">
                                            <td className="total-label">Total</td>
                                            <td className="bold">{formatCurrency(totalCleared)}</td>
                                        </tr>
                                    )}

                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="rightColumn">
                {selectedAccount ? (
                    <div className="account-details">
                        <h1>Account Details: {selectedAccount.name}</h1>
                        <div style={{display: "flex", justifyContent: "space-between", gap: "1rem"}}>
                            <div>ID: {selectedAccount.id}</div>
                            <div>
                                <EditableField
                                    label="Name:"
                                    value={selectedAccount.name || ''}
                                    type="text"
                                    onSave={(newValue) => handleFieldSave("name", newValue)}
                                />
                            </div>
                            <div>
                                <EditableField
                                    label="Type:"
                                    value={selectedAccount.type || ''}
                                    type="select"
                                    options={["Bill", "Household", "Income", "Credit Card", "Loan", "Other"].sort()}
                                    onSave={(newValue) => handleFieldSave("type", newValue)}
                                />
                            </div>
                            <EditableField
                                label="Classification:"
                                value={selectedAccount.classification || ''}
                                type="text"
                                onSave={(newValue) => handleFieldSave("classification", newValue)}
                            />
                            <div>
                                <EditableField
                                    label="Due Day:"
                                    value={selectedAccount.due_day || 0}
                                    type="number"
                                    onSave={(newValue) => handleFieldSave("due_day", newValue)}
                                />
                            </div>
                            <div>
                                <EditableField
                                    label="Budgeted:"
                                    value={selectedAccount.budget_amount || 0}
                                    type="number"
                                    formatter={formatCurrency}
                                    onSave={(newValue) => handleFieldSave("budget_amount", newValue)}
                                />
                            </div>
                            <div>
                                <EditableField
                                    label="Balance:"
                                    value={selectedAccount.balance || 0}
                                    type="number"
                                    formatter={formatCurrency}
                                    onSave={(newValue) => handleFieldSave("balance", newValue)}
                                />
                            </div>
                        </div>
                        <div>
                            <AgCharts options={chartOptions}/>
                            {accountHistory ? (
                                <table style={{ margin: 10 }}>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Amount</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {accountHistory
                                        ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((entry, index) => (
                                            <tr key={index}>
                                                <td>{new Date(entry.date).toLocaleDateString()}</td>
                                                <td>{formatCurrency(entry.amount)}</td>
                                            </tr>
                                        ))}

                                    {/*{accountHistory.map((entry, index) => (*/}
                                    {/*    <tr key={index}>*/}
                                    {/*        <td>{new Date(entry.date).toLocaleDateString()}</td>*/}
                                    {/*        <td>{formatCurrency(entry.amount)}</td>*/}
                                    {/*    </tr>*/}
                                    {/*))}*/}
                                    </tbody>
                                </table>
                            ) : (
                                <p>Loading history...</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <p>Select an account to view details</p>
                )}
            </div>
        </div>
    </div>);
};

export default HomePage;