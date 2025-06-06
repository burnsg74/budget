import React, {useEffect, useState} from 'react';
import {fetchData} from '../../utils/db';
import styles from "./styles.module.css";
import {format, addMonths, startOfMonth} from 'date-fns';
import {formatUSD} from '../../utils/formatters';

type AccountType = "Income" | "Bill" | "Household" | "Credit Card" | "Mortgage" | "Loan" | "Other" | "Unknown";

interface LedgerEntry {
    date: string;
    name: string;
    amount: number;
    type: AccountType;
}

const Home: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(startOfMonth(new Date()));
    const [ledgerData, setLedgerData] = useState<Record<AccountType, LedgerEntry[]>>({
        "Income": [],
        "Mortgage": [],
        "Loan": [],
        "Bill": [],
        "Credit Card": [],
        "Household": [],
        "Other": [],
        "Unknown": []
    });

    useEffect(() => {
        const fetchLedgerData = async () => {
            const formattedDate = format(selectedDate, 'yyyy-MM');
            const query = `
                SELECT a.name,
                       SUM(l.amount) as amount,
                       a.type
                FROM ledger l
                         JOIN accounts a ON l.account_id = a.id
                WHERE strftime('%Y-%m', l.date) = '${formattedDate}'
                GROUP BY a.id
                ORDER BY amount DESC
            `;

            const data: LedgerEntry[] = await fetchData(query);

            // Initialize with empty arrays for all types
            const groupedData: Record<AccountType, LedgerEntry[]> = {
                "Income": [],
                "Mortgage": [],
                "Loan": [],
                "Bill": [],
                "Credit Card": [],
                "Household": [],
                "Other": [],
                "Unknown": []
            };

            // Group data by account type
            data.forEach(entry => {
                const type = entry.type as AccountType;
                groupedData[type].push(entry);
            });

            setLedgerData(groupedData);
        };

        fetchLedgerData();
    }, [selectedDate]);

    const handlePreviousMonth = () => {
        setSelectedDate(prevDate => addMonths(prevDate, -1));
    };

    const handleNextMonth = () => {
        setSelectedDate(prevDate => addMonths(prevDate, 1));
    };

    const calculateTotal = (entries: LedgerEntry[] | undefined) => {
        return entries?.reduce((sum, entry) => sum + entry.amount, 0) ?? 0;
    };

    const types: AccountType[] = ["Income", "Mortgage", "Loan", "Bill", "Credit Card", "Household", "Other", "Unknown"];

    // Calculate summary values
    const totalIncome = calculateTotal(ledgerData["Income"]);
    const totalExpenses = types
        .filter(type => type !== "Income")
        .reduce((sum, type) => sum + calculateTotal(ledgerData[type]), 0);
    const difference = totalIncome - totalExpenses;

    const maxRows = Math.max(
        0,  // Default to 0 if all arrays are empty
        ...Object.values(ledgerData).map(entries => entries?.length ?? 0)
    );

    return (
        <>
            <div className={styles["summary-container"]}>
                <div className={styles["month-navigation"]}>
                    <button onClick={handlePreviousMonth}>&lt;</button>
                    <span className={styles["month-display"]}>
                        {format(selectedDate, 'MMM yyyy')}
                    </span>
                    <button onClick={handleNextMonth}>&gt;</button>
                </div>
                <div>
                    ||
                </div>

                <div className={styles["financial-summary"]}>
                    <div className={styles["summary-content"]}>
                        <span className={styles["income-value"]}>
                            Income: {formatUSD(totalIncome)}
                        </span>
                        <span className={styles["math-operator"]}>-</span>
                        <span className={styles["expenses-value"]}>
                            Expenses: {formatUSD(totalExpenses)}
                        </span>
                        <span className={styles["math-operator"]}>=</span>
                        <span className={`${styles["difference-value"]} ${difference >= 0 ? styles.positive : styles.negative}`}>
                            {formatUSD(difference)}
                        </span>
                    </div>
                </div>
            </div>
            <div className={styles["ledger-table"]}>
                <table>
                    <thead>
                    <tr>
                        {types.map(type => (
                            ledgerData[type]?.length ? (
                                <th key={type} colSpan={2}>
                                    <div className={styles["type-header"]}>
                                        <span className={styles["type-name"]}>
                                            {type} ({ledgerData[type].length})
                                        </span>
                                        <span className={styles["type-total"]}>
                                            {formatUSD(calculateTotal(ledgerData[type]))}
                                        </span>
                                    </div>
                                </th>
                            ) : null
                        ))}
                    </tr>
                    <tr>
                        {types.map(type => (
                            ledgerData[type]?.length ? (
                                <React.Fragment key={type}>
                                    <th>Name</th>
                                    <th>Amount</th>
                                </React.Fragment>
                            ) : null
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                        {[...Array(maxRows)].map((_, rowIndex) => (
                        <tr key={rowIndex}>
                            {types.map(type => (
                                ledgerData[type]?.length ? (
                                    <React.Fragment key={type}>
                                        {ledgerData[type]?.[rowIndex] ? (
                                            <>
                                                <td>{ledgerData[type][rowIndex].name}</td>
                                                <td className={styles.amount}>
                                                    {formatUSD(ledgerData[type][rowIndex].amount)}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td></td>
                                                <td></td>
                                            </>
                                        )}
                                    </React.Fragment>
                                ) : null
                            ))}
                        </tr>
                    ))}
                    <tr className={styles.total}>
                        {types.map(type => (
                            ledgerData[type]?.length ? (
                                <React.Fragment key={type}>
                                    <td>Total</td>
                                    <td className={styles.amount}>
                                        {formatUSD(calculateTotal(ledgerData[type]))}
                                    </td>
                                </React.Fragment>
                            ) : null
                        ))}
                    </tr>
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default Home;