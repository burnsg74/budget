import React, {useState, useEffect} from "react";
import './Home.css';
import {IBudgetBill, ICreditCard, IHousehold, IIncome, ILoan, IOther, IUnknown} from "../../types";
import {fetchData} from "../../utils/db";

// Initial Data and Config
const initialMonthYear = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    reportDate: new Date().toLocaleString("en-US", {month: "long", year: "numeric"})
};

const HomePage: React.FC = () => {

    // States
    const [incomes, setIncomes] = useState<IIncome[]>([]);
    const [bills, setBills] = useState<IBudgetBill[]>([]);
    const [loans, setLoans] = useState<ILoan[]>([]);
    const [creditCards, setCreditCards] = useState<ICreditCard[]>([]);
    const [others, setOthers] = useState<IOther[]>([]);
    const [unknowns, setUnknowns] = useState<IUnknown[]>([]);
    const [households, setHouseholds] = useState<IHousehold[]>([]);
    const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
    const [editableBudget, setEditableBudget] = useState<number | null>(null);
    const [editingAccountType, setEditingAccountType] = useState<'Bill' | 'Loan' | 'Credit Card' | 'Income' | null>(null);

    // Effects
    useEffect(() => {
        // SELECT a.id, a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount, l.date
        // FROM accounts a
        //          LEFT JOIN ledger l ON l.to_account_id = a.id AND (l.date LIKE '2024-12%' OR l.date IS NULL)
        // WHERE a.type = 'Loan'
        //   AND a.active = 1
        //
        // GROUP BY a.id
        // ORDER BY due_day
        const date = `${initialMonthYear.year}-${(initialMonthYear.month + 1).toString().padStart(2, '0')}` + '%';
        fetchData<IIncome[]>(`SELECT a.id, a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount
                              FROM accounts a
                                       LEFT JOIN ledger l
                                                 ON l.from_account_id = a.id AND (l.date LIKE '${date}' OR l.date IS NULL)
                              WHERE a.type = 'Income'
                                AND a.active = 1
                              GROUP BY a.id
                              ORDER BY due_day`).then(setIncomes);
        fetchData<IBudgetBill[]>(`SELECT a.id, a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount
                                  FROM accounts a
                                           LEFT JOIN ledger l ON l.to_account_id = a.id AND (l.date LIKE '${date}' OR l.date IS NULL)
                                  WHERE a.type = 'Bill'
                                    AND a.active = 1
                                  GROUP BY a.id
                                  ORDER BY due_day`).then(setBills);
        fetchData<ILoan[]>(`SELECT a.id, a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount
                            FROM accounts a
                                     LEFT JOIN ledger l ON l.to_account_id = a.id AND (l.date LIKE '${date}' OR l.date IS NULL)
                            WHERE a.type = 'Loan'
                              AND a.active = 1
                            GROUP BY a.id
                            ORDER BY due_day`).then(setLoans);
        fetchData<ICreditCard[]>(`SELECT a.id, a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount
                                  FROM accounts a
                                           LEFT JOIN ledger l ON l.to_account_id = a.id
                                  WHERE a.type = 'Credit Card'
                                    AND a.active = 1
                                  GROUP BY a.id
                                  ORDER BY due_day`).then(setCreditCards);
        fetchData<IOther[]>(`SELECT a.id, a.name, SUM(l.amount) as cleared_amount
                             FROM accounts a
                                      LEFT JOIN ledger l ON l.to_account_id = a.id AND (l.date LIKE '${date}' OR l.date IS NULL)
                             WHERE a.type = 'Other'
                               AND a.active = 1
                             GROUP BY a.id
                             ORDER BY due_day`).then(setOthers);
        fetchData<IUnknown[]>(`SELECT a.id, a.name, SUM(l.amount) as cleared_amount
                               FROM accounts a
                                        LEFT JOIN ledger l ON l.to_account_id = a.id AND (l.date LIKE '${date}' OR l.date IS NULL)
                               WHERE a.type = 'Unknown'
                                 AND a.active = 1
                               GROUP BY a.id
                               ORDER BY due_day`).then(setUnknowns);
        fetchData<IHousehold[]>(`SELECT a.id, a.name, a.budget_amount, SUM(l.amount) as cleared_amount
                                 FROM accounts a
                                          LEFT JOIN ledger l ON l.to_account_id = a.id AND (l.date LIKE '${date}' OR l.date IS NULL)
                                 WHERE a.type = 'Household'
                                   AND a.active = 1
                                 GROUP BY a.id
                                 ORDER BY due_day`).then(setHouseholds);
    }, []);

    // Functions
    const handleInputKeyDown = async (accountId: number, accountType: 'Bill' | 'Loan' | 'Credit Card' | 'Income', event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter" && editableBudget !== null) {
            // Save the new value to the database
            await saveBudgetToDatabase(accountId, editableBudget);

            // Update the corresponding list with the new budget
            switch (accountType) {
                case 'Bill':
                    setBills((prevBills) =>
                        prevBills.map((bill) =>
                            bill.id === accountId ? {...bill, budget_amount: editableBudget} : bill
                        )
                    );
                    break;
                case 'Loan':
                    setLoans((prevLoans) =>
                        prevLoans.map((loan) =>
                            loan.id === accountId ? {...loan, budget_amount: editableBudget} : loan
                        )
                    );
                    break;
                case 'Credit Card':
                    setCreditCards((prevCreditCards) =>
                        prevCreditCards.map((creditCard) =>
                            creditCard.id === accountId ? {...creditCard, budget_amount: editableBudget} : creditCard
                        )
                    );
                    break;
                case 'Income':
                    setIncomes((prevIncomes) =>
                        prevIncomes.map((income) =>
                            income.id === accountId ? {...income, budget_amount: editableBudget} : income
                        )
                    );
                    break;
            }

            // Exit editing mode
            setEditingAccountId(null);
            setEditingAccountType(null);
        } else if (event.key === "Escape") {
            // Exit editing without saving when "Escape" is pressed
            setEditingAccountId(null);
            setEditingAccountType(null);
        }
    };

    const saveBudgetToDatabase = async (billId: number, newBudget: number) => {
        fetchData(`UPDATE accounts
                   SET budget_amount = ${newBudget}
                   WHERE id = ${billId}`).then(() => {
            console.log(`Updated budget for bill ID ${billId} to ${newBudget}`);
        });
    };

    // const formatReportDate = (month: number, year: number) => {
    //     const date = new Date(year, month);
    //     return date.toLocaleString("en-US", {month: "long", year: "numeric"});
    // };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    // Event Handlers
    // const handleBackClick = () => {
    //     setDateInfo(prev => getUpdatedMonthYear(prev, false));
    // };
    //
    // const handleNextClick = () => {
    //     setDateInfo(prev => getUpdatedMonthYear(prev, true));
    // };

    // Render
    return (
        <div>
            <div className="columns">
                <div className="leftColumn">
                    <table className="left-table">
                        <tbody>
                        <tr>
                            <td className="title bill">Bills</td>
                            <td>Day</td>
                            <td>Budget</td>
                            <td>Cleared</td>
                        </tr>
                        {bills.map((bill, index) => (
                            <tr
                                key={index}
                                className={`bill`}
                            >
                                <td>{bill.name}</td>
                                <td className={`${index === 0 && 'bt'}`}>{bill.due_day}</td>
                                <td className={`${index === 0 && 'bt'}`}
                                    onDoubleClick={() => {
                                        setEditingAccountId(bill.id);
                                        setEditableBudget(bill.budget_amount);
                                        setEditingAccountType('Bill');
                                    }}
                                >
                                    {editingAccountId === bill.id ? (
                                        <input
                                            type="number"
                                            value={editableBudget ?? ""}
                                            onChange={(e) => setEditableBudget(parseFloat(e.target.value || "0"))}
                                            onKeyDown={(e) => handleInputKeyDown(bill.id, 'Loan', e)}
                                            onBlur={() => setEditingAccountId(null)}
                                            autoFocus
                                        />
                                    ) : (
                                        formatCurrency(bill.budget_amount)
                                    )}
                                </td>
                                <td className={`${index === 0 && 'bt'}`}>{formatCurrency(bill.cleared_amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className="title loan" colSpan={2}>Loans</td>
                            <td className="bill bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.budget_amount, 0))}</td>
                            <td className="bill bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                        </tr>
                        {loans.map((loan, index) => (
                            <tr key={index} className="loan">
                                <td>{loan.name}</td>
                                <td>{loan.due_day}</td>
                                <td
                                    onDoubleClick={() => {
                                        setEditingAccountId(loan.id);
                                        setEditableBudget(loan.budget_amount);
                                        setEditingAccountType('Loan');
                                    }}
                                >
                                    {editingAccountId === loan.id && editingAccountType === 'Loan' ? (
                                        <input
                                            type="number"
                                            value={editableBudget ?? ""}
                                            onChange={(e) => setEditableBudget(parseFloat(e.target.value || "0"))}
                                            onKeyDown={(e) => handleInputKeyDown(loan.id, 'Loan', e)}
                                            onBlur={() => {
                                                setEditingAccountId(null);
                                                setEditingAccountType(null);
                                            }}
                                            autoFocus
                                        />
                                    ) : (
                                        formatCurrency(loan.budget_amount)
                                    )}
                                </td>
                                <td>{formatCurrency(loan.cleared_amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className="title credit-card" colSpan={2}>Credit Cards</td>
                            <td className="loan bb bold">{formatCurrency(loans.reduce((sum, loan) => sum + loan.budget_amount, 0))}</td>
                            <td className="loan bb bold">{formatCurrency(loans.reduce((sum, loan) => sum + loan.cleared_amount, 0))}</td>
                        </tr>
                        {creditCards.map((creditCard, index) => (
                            <tr key={index} className="credit-card">
                                <td>{creditCard.name}</td>
                                <td>{creditCard.due_day}</td>
                                <td
                                    onDoubleClick={() => {
                                        setEditingAccountId(creditCard.id);
                                        setEditableBudget(creditCard.budget_amount);
                                        setEditingAccountType('Credit Card');
                                    }}
                                >
                                    {editingAccountId === creditCard.id && editingAccountType === 'Credit Card' ? (
                                        <input
                                            type="number"
                                            value={editableBudget ?? ""}
                                            onChange={(e) => setEditableBudget(parseFloat(e.target.value || "0"))}
                                            onKeyDown={(e) => handleInputKeyDown(creditCard.id, 'Credit Card', e)}
                                            onBlur={() => {
                                                setEditingAccountId(null);
                                                setEditingAccountType(null);
                                            }}
                                            autoFocus
                                        />
                                    ) : (
                                        formatCurrency(creditCard.budget_amount)
                                    )}
                                </td>
                                <td>{formatCurrency(creditCard.cleared_amount)}</td>
                            </tr>
                        ))}
                        {incomes.length > 0 && (
                            <>
                                <tr>
                                    <td className="title income" colSpan={2}>Income</td>
                                    <td className="credit-card bold bb">{formatCurrency(creditCards.reduce((sum, creditCard) => sum + creditCard.budget_amount, 0))}</td>
                                    <td className="credit-card bold bb">{formatCurrency(creditCards.reduce((sum, creditCard) => sum + creditCard.cleared_amount, 0))}</td>
                                </tr>
                                {incomes.map((income, index) => (
                                    <tr key={index} className="income">
                                        <td>{income.name}</td>
                                        <td></td>
                                        <td
                                            onDoubleClick={() => {
                                                setEditingAccountId(income.id);
                                                setEditableBudget(income.budget_amount);
                                                setEditingAccountType('Income');
                                            }}
                                        >
                                            {editingAccountId === income.id && editingAccountType === 'Income' ? (
                                                <input
                                                    type="number"
                                                    value={editableBudget ?? ""}
                                                    onChange={(e) => setEditableBudget(parseFloat(e.target.value || "0"))}
                                                    onKeyDown={(e) => handleInputKeyDown(income.id, 'Income', e)}
                                                    onBlur={() => {
                                                        setEditingAccountId(null);
                                                        setEditingAccountType(null);
                                                    }}
                                                    autoFocus
                                                />
                                            ) : (
                                                formatCurrency(income.budget_amount)
                                            )}
                                        </td>
                                        <td>{formatCurrency(income.cleared_amount)}</td>
                                    </tr>
                                ))}
                            </>
                        )}
                        <tr>
                            <td className="income" colSpan={2}></td>
                            <td className="income bold bb">{formatCurrency(incomes.reduce((sum, income) => sum + income.budget_amount, 0))}</td>
                            <td className="income bold bb">{formatCurrency(incomes.reduce((sum, income) => sum + income.cleared_amount, 0))}</td>
                        </tr>
                        {others.length > 0 && (
                            <>
                                <tr>
                                    <td className="title other" colSpan={2}>Other</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.budget_amount, 0))}</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                </tr>
                                {others.map((other, index) => (
                                    <tr key={index} className="other">
                                        <td>{other.name}</td>
                                        <td></td>
                                        <td>{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                        <td>{formatCurrency(other.cleared_amount)}</td>
                                    </tr>
                                ))}
                            </>
                        )}
                        {unknowns.length > 0 && (
                            <>
                                <tr>
                                    <td className="title unknown" colSpan={2}>Unknown</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.budget_amount, 0))}</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                </tr>
                                {unknowns.map((unknown, index) => (
                                    <tr key={index} className="unknown">
                                        <td>{unknown.name}</td>
                                        <td colSpan={3}>{formatCurrency(unknown.cleared_amount)}</td>
                                    </tr>
                                ))}
                            </>
                        )}

                        </tbody>
                    </table>
                    <br/>
                    <br/>
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
                        <tr>
                            <td className="bill">Bills</td>
                            <td className="bill">{formatCurrency(bills.reduce((sum, bill) => sum + bill.budget_amount, 0))}</td>
                            <td className="bill">{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                            <td className="bill">{formatCurrency(bills.reduce((sum, bill) => sum + (bill.budget_amount - bill.cleared_amount), 0))}</td>
                        </tr>
                        <tr>
                            <td className="loan">Loans</td>
                            <td className="loan">{formatCurrency(loans.reduce((sum, loan) => sum + loan.budget_amount, 0))}</td>
                            <td className="loan">{formatCurrency(loans.reduce((sum, loan) => sum + loan.cleared_amount, 0))}</td>
                            <td className="loan">{formatCurrency(loans.reduce((sum, loan) => sum + (loan.budget_amount - loan.cleared_amount), 0))}</td>
                        </tr>
                        <tr>
                            <td className="credit-card">Credit Cards</td>
                            <td className="credit-card">{formatCurrency(creditCards.reduce((sum, creditCard) => sum + creditCard.budget_amount, 0))}</td>
                            <td className="credit-card">{formatCurrency(creditCards.reduce((sum, creditCard) => sum + creditCard.cleared_amount, 0))}</td>
                            <td className="credit-card">{formatCurrency(creditCards.reduce((sum, creditCard) => sum + (creditCard.budget_amount - creditCard.cleared_amount), 0))}</td>
                        </tr>
                        {/*<tr>*/}
                        {/*    <td className="income">Income</td>*/}
                        {/*    <td className="income">{formatCurrency(incomes.reduce((sum, income) => sum + income.budget_amount, 0))}</td>*/}
                        {/*    <td className="income">{formatCurrency(incomes.reduce((sum, income) => sum + income.cleared_amount, 0))}</td>*/}
                        {/*    <td className="income">{formatCurrency(incomes.reduce((sum, income) => sum + (income.budget_amount - income.cleared_amount), 0))}</td>*/}
                        {/*</tr>*/}
                        <tr>
                            <td className="household">Household</td>
                            <td className="household">{formatCurrency(households.reduce((sum, household) => sum + household.budget_amount, 0))}</td>
                            <td className="household">{formatCurrency(households.reduce((sum, household) => sum + household.cleared_amount, 0))}</td>
                            <td className="household">{formatCurrency(households.reduce((sum, household) => sum + (household.budget_amount - household.cleared_amount), 0))}</td>
                        </tr>
                        {others.length > 0 && (
                            <>
                                <tr>
                                    <td className="other">Other</td>
                                    <td className="other">{formatCurrency(others.reduce((sum, other) => sum + other.cleared_amount, 0))}</td>
                                    <td className="other">{formatCurrency(others.reduce((sum, other) => sum + other.cleared_amount, 0))}</td>
                                    <td className="other"></td>
                                </tr>
                            </>
                        )}
                        {/*Totals*/}
                        <tr>
                            <td></td>
                            <td className="bold">
                                {formatCurrency(
                                    bills.reduce((sum, bill) => sum + bill.budget_amount, 0) +
                                    loans.reduce((sum, loan) => sum + loan.budget_amount, 0) +
                                    creditCards.reduce((sum, creditCard) => sum + creditCard.budget_amount, 0) +
                                    households.reduce((sum, household) => sum + household.budget_amount, 0)
                                )}
                            </td>
                            <td className="bold">
                                {formatCurrency(
                                    bills.reduce((sum, bill) => sum + bill.cleared_amount, 0) +
                                    loans.reduce((sum, loan) => sum + loan.cleared_amount, 0) +
                                    creditCards.reduce((sum, creditCard) => sum + creditCard.cleared_amount, 0) +
                                    households.reduce((sum, household) => sum + household.cleared_amount, 0)
                                )}
                            </td>
                            <td className="bold">
                                {formatCurrency(
                                    bills.reduce((sum, bill) => sum + (bill.budget_amount - bill.cleared_amount), 0) +
                                    loans.reduce((sum, loan) => sum + (loan.budget_amount - loan.cleared_amount), 0) +
                                    creditCards.reduce((sum, creditCard) => sum + (creditCard.budget_amount - creditCard.cleared_amount), 0) +
                                    households.reduce((sum, household) => sum + (household.budget_amount - household.cleared_amount), 0)
                                )}
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
                <div className="middleColumn">
                    <table className="left-table">
                        <tbody>
                        <tr>
                            <td className="title household">Household</td>
                        </tr>
                        {households.map((household, index) => (
                            <tr
                                key={index}
                                className={`household`}
                            >
                                <td>{household.name} </td>
                                <td className={`${index === 0 && 'bt'}`}>{formatCurrency(household.cleared_amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td></td>
                            <td className="household bb bold">{formatCurrency(households.reduce((sum, household) => sum + household.cleared_amount, 0))}</td>
                        </tr>
                        </tbody>
                    </table>
                    {/*<table className="table">*/}
                    {/*    <tbody>*/}
                    {/*    <tr>*/}
                    {/*        <th colSpan={2}>HouseHold</th>*/}
                    {/*    </tr>*/}
                    {/*    /!*{combineHouseholdRecords(data.filter(row => row.Type === 'Household')).map((row, index) => (*!/*/}
                    {/*    /!*    <tr key={index} className="household">*!/*/}
                    {/*    /!*        <td>{row.Name}</td>*!/*/}
                    {/*    /!*        <td>{formatCurrency(row.Amount)}</td>*!/*/}
                    {/*    /!*    </tr>*!/*/}
                    {/*    /!*))}*!/*/}
                    {/*    <tr className="footer">*/}
                    {/*        <td>Total</td>*/}
                    {/*        <td>*/}
                    {/*            /!*{formatCurrency(data*!/*/}
                    {/*            /!*    .filter(row => row.Type === 'Household')*!/*/}
                    {/*            /!*    .reduce((acc, row) => acc + row.Amount, 0))}*!/*/}
                    {/*        </td>*/}
                    {/*    </tr>*/}
                    {/*    </tbody>*/}
                    {/*</table>*/}
                </div>
                <div className="rightColumn">
                    {/*<table className="table">*/}
                    {/*    <tbody>*/}
                    {/*    <tr>*/}
                    {/*        <td colSpan={2}>Grand Total</td>*/}
                    {/*        <td>*/}
                    {/*            /!*{formatCurrency(data.filter(row => row.Type !== 'Checking').reduce((acc, row) => acc + row.Amount, 0))}*!/*/}
                    {/*        </td>*/}
                    {/*    </tr>*/}
                    {/*    </tbody>*/}
                    {/*</table>*/}
                    {/*Account*/}
                </div>
            </div>
        </div>
    )
        ;
};

export default HomePage;