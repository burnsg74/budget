import React, {useState, useEffect} from "react";
import './Home.css';
import {IAccount, IBudgetBill, ICreditCard, IHousehold, IIncome, ILoan, IOther, IUnknown} from "../../types";
import {fetchData} from "../../utils/db";

// Initial Data and Config
const initialMonthYear = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    reportDate: new Date().toLocaleString("en-US", {month: "long", year: "numeric"})
};

const HomePage: React.FC = () => {

    // States
    const [income, setIncome] = useState<IIncome[]>([]);
    const [bills, setBills] = useState<IBudgetBill[]>([]);
    const [loans, setLoans] = useState<ILoan[]>([]);
    const [creditCards, setCreditCards] = useState<ICreditCard[]>([]);
    const [other, setOther] = useState<IOther[]>([]);
    const [unknown, setUnknown] = useState<IUnknown[]>([]);
    const [household, setHousehold] = useState<IHousehold[]>([]);

    // Effects
    useEffect(() => {
        const date = `${initialMonthYear.year}-${(initialMonthYear.month + 1).toString().padStart(2, '0')}` + '%';
        fetchData<IIncome[]>(`SELECT a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount FROM accounts a LEFT JOIN ledger l ON l.to_account_id = a.id WHERE a.type = "Income" AND a.active = 1 AND l.date LIKE '${date}'  GROUP BY a.id`).then(setIncome);
        fetchData<IBudgetBill[]>(`SELECT a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount FROM accounts a LEFT JOIN ledger l ON l.to_account_id = a.id WHERE a.type = "Bill" AND a.active = 1 AND l.date LIKE '${date}' GROUP BY a.id;`).then(setBills);
        fetchData<ILoan[]>(`SELECT a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount FROM accounts a LEFT JOIN ledger l ON l.to_account_id = a.id WHERE a.type = "Loan" AND a.active = 1 AND l.date LIKE '${date}' GROUP BY a.id;`).then(setLoans);
        fetchData<ICreditCard[]>(`SELECT a.name, a.due_day, a.budget_amount, SUM(l.amount) as cleared_amount FROM accounts a LEFT JOIN ledger l ON l.to_account_id = a.id WHERE a.type = "Credit Card" AND a.active = 1 AND l.date LIKE '${date}' GROUP BY a.id;`).then(setCreditCards);
        fetchData<IOther[]>(`SELECT a.name, SUM(l.amount) as cleared_amount FROM accounts a LEFT JOIN ledger l ON l.to_account_id = a.id WHERE a.type = "Other" AND a.active = 1 AND l.date LIKE '${date}' GROUP BY a.id;`).then(setOther);
        fetchData<IUnknown[]>(`SELECT a.name, SUM(l.amount) as cleared_amount FROM accounts a LEFT JOIN ledger l ON l.to_account_id = a.id WHERE a.type = "Unknown" AND a.active = 1 AND l.date LIKE '${date}' GROUP BY a.id;`).then(setUnknown);
        fetchData<IHousehold[]>(`SELECT a.name, a.budget_amount, SUM(l.amount) as cleared_amount FROM accounts a LEFT JOIN ledger l ON l.to_account_id = a.id WHERE a.type = "Household" AND a.active = 1 AND l.date LIKE '${date}' GROUP BY a.id;`).then(setHousehold);}, []);

    // Functions
    const formatReportDate = (month: number, year: number) => {
        const date = new Date(year, month);
        return date.toLocaleString("en-US", {month: "long", year: "numeric"});
    };

    const getUpdatedMonthYear = (prev: { month: number, year: number }, increment: boolean) => {
        const newMonth = increment ? (prev.month === 11 ? 0 : prev.month + 1) : (prev.month === 0 ? 11 : prev.month - 1);
        const newYear = increment ? (prev.month === 11 ? prev.year + 1 : prev.year) : (prev.month === 0 ? prev.year - 1 : prev.year);
        return {month: newMonth, year: newYear, reportDate: formatReportDate(newMonth, newYear)};
    };

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
                                <td>{bill.name} </td>
                                <td className={`${index === 0 && 'bt'}`}>{bill.due_day}</td>
                                <td className={`${index === 0 && 'bt'}`}>{formatCurrency(bill.budget_amount)}</td>
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
                                <td>{formatCurrency(loan.budget_amount)}</td>
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
                                <td>{formatCurrency(creditCard.budget_amount)}</td>
                                <td>{formatCurrency(creditCard.cleared_amount)}</td>
                            </tr>
                        ))}
                        {other.length > 0 && (
                            <>
                                <tr>
                                    <td className="title other" colSpan={2}>Other</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.budget_amount, 0))}</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                </tr>
                                {other.map((other, index) => (
                                    <tr key={index} className="other">
                                        <td>{other.name}</td>
                                        <td></td>
                                        <td>{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                        <td>{formatCurrency(other.cleared_amount)}</td>
                                    </tr>
                                ))}
                            </>
                        )}
                        {unknown.length > 0 && (
                            <>
                                <tr>
                                    <td className="title unknown" colSpan={2}>Unknown</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.budget_amount, 0))}</td>
                                    <td className="credit-card bb bold">{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                </tr>
                                {unknown.map((unknown, index) => (
                                    <tr key={index} className="unknown">
                                        <td>{unknown.name}</td>
                                        <td colSpan={3}>{formatCurrency(unknown.cleared_amount)}</td>
                                    </tr>
                                ))}
                            </>
                        )}
                        {income.length > 0 && (
                            <>
                                <tr>
                                    <td className="title income" colSpan={2}>Income</td>
                                    <td className="credit-card bb">{formatCurrency(bills.reduce((sum, bill) => sum + bill.budget_amount, 0))}</td>
                                    <td className="credit-card bb">{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                </tr>
                                {income.map((income, index) => (
                                    <tr key={index} className="income">
                                        <td>{income.name}</td>
                                        <td></td>
                                        <td>{formatCurrency(bills.reduce((sum, bill) => sum + bill.cleared_amount, 0))}</td>
                                        <td>{formatCurrency(income.cleared_amount)}</td>
                                    </tr>
                                ))}
                            </>
                        )}
                        {/*<tr>*/}
                        {/*    <td colSpan={2}>Grand Total</td>*/}
                        {/*    <td>*/}
                        {/*        /!*{formatCurrency(data.filter(row => row.Type !== 'Checking').reduce((acc, row) => acc + row.Amount, 0))}*!/*/}
                        {/*    </td>*/}
                        {/*</tr>*/}
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
                        <tr>
                            <td className="income">Income</td>
                            <td className="income">{formatCurrency(income.reduce((sum, income) => sum + income.budget_amount, 0))}</td>
                            <td className="income">{formatCurrency(income.reduce((sum, income) => sum + income.cleared_amount, 0))}</td>
                            <td className="income">{formatCurrency(income.reduce((sum, income) => sum + (income.budget_amount - income.cleared_amount), 0))}</td>
                        </tr>
                        <tr>
                            <td className="household">Household</td>
                            <td className="household">{formatCurrency(household.reduce((sum, household) => sum + household.budget_amount, 0))}</td>
                            <td className="household">{formatCurrency(household.reduce((sum, household) => sum + household.cleared_amount, 0))}</td>
                            <td className="household">{formatCurrency(household.reduce((sum, household) => sum + (household.budget_amount - household.cleared_amount), 0))}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>
                <div className="middleColumn">
                    <table className="left-table">
                        <tbody>
                        <tr>
                            <td className="title household">Household</td>
                            <td>Budget</td>
                            <td>Cleared</td>
                        </tr>
                        {household.map((household, index) => (
                            <tr
                                key={index}
                                className={`household`}
                            >
                                <td>{household.name} </td>
                                <td className={`${index === 0 && 'bt'}`}>{formatCurrency(household.budget_amount)}</td>
                                <td className={`${index === 0 && 'bt'}`}>{formatCurrency(household.cleared_amount)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td></td>
                            <td className="household bb bold">{formatCurrency(household.reduce((sum, household) => sum + household.budget_amount, 0))}</td>
                            <td className="household bb bold">{formatCurrency(household.reduce((sum, household) => sum + household.cleared_amount, 0))}</td>
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