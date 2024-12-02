import React, {useState, useEffect} from "react";
import './Home.css';

// Initial Data and Config
const initialMonthYear = {
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    reportDate: new Date().toLocaleString("en-US", {month: "long", year: "numeric"})
};

interface Record {
    ID: number;
    Type: string;
    Name: string;
    Day: string;
    Amount: number;
}

const HomePage: React.FC = () => {

    // States
    const [data, setData] = useState<Record[]>([]);
    const [dateInfo, setDateInfo] = useState(initialMonthYear);
    const [recordTypes] = useState<string[]>(['Bill', 'Loan', 'Credit Card', 'Income', 'Other', 'Unknown']);

    // Effects
    useEffect(() => {
        fetchData(dateInfo.month, dateInfo.year).catch(console.error);
        setDateInfo(prev => ({
            ...prev,
            reportDate: formatReportDate(prev.month, prev.year)
        }));
    }, [dateInfo.month, dateInfo.year]);

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

    async function fetchData(month: number, year: number) {
        try {
            const query = `SELECT A.Type, A.Name, strftime('%d', L.Date) AS Day, L.Amount
                           FROM Ledger L
                                    LEFT JOIN Accounts A on A.ID = L.ToAccountID
                           WHERE L.Date LIKE '${year}-${(month + 1).toString().padStart(2, '0')}%'
                           ORDER BY L.Date`;
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({query}),
            });
            const data: Record[] = await response.json();


            setData(data);
            console.log(data);
        } catch (error) {
            console.error(error);
        }
    }

    const combineHouseholdRecords = (records: Record[]) => {
        const combinedRecords = records.reduce((acc, record) => {
            const existingRecord = acc.find(item => item.Name === record.Name);
            if (existingRecord) {
                existingRecord.Amount += record.Amount;
            } else {
                acc.push({...record});
            }
            return acc;
        }, [] as Record[]);

        combinedRecords.sort((a, b) => b.Amount - a.Amount);

        return combinedRecords;
    };

    // Event Handlers
    const handleBackClick = () => {
        setDateInfo(prev => getUpdatedMonthYear(prev, false));
    };

    const handleNextClick = () => {
        setDateInfo(prev => getUpdatedMonthYear(prev, true));
    };

    // Render
    return (
        <div>
            <nav className="nav-bar">
                <button className="nav-button" onClick={handleBackClick}>Back</button>
                <h1 className="nav-title">{dateInfo.reportDate}</h1>
                <button className="nav-button" onClick={handleNextClick}>Next</button>
            </nav>
            <div className="columns">
                <div className="leftColumn">
                    <table className="table">
                        <tbody>
                        {recordTypes.map((recordType) => (
                            <React.Fragment key={recordType}>
                                <tr>
                                    <th colSpan={3}>{recordType.charAt(0).toUpperCase() + recordType.slice(1)}</th>
                                </tr>
                                {data.filter(row => row.Type === recordType).map((row, index) => (
                                    <tr className={recordType.toLowerCase().replace(/\s+/g, '-')} key={index}>
                                        <td>{row.Name}</td>
                                        <td>{row.Day}</td>
                                        <td>{formatCurrency(row.Amount)}</td>
                                    </tr>
                                ))}
                                <tr className="footer">
                                    <td colSpan={2}>Total</td>
                                    <td>
                                        {formatCurrency(data
                                            .filter(row => row.Type === recordType)
                                            .reduce((acc, row) => acc + row.Amount, 0))}
                                    </td>
                                </tr>
                                <tr className="spacer">
                                    <td colSpan={3}>&nbsp;</td>
                                </tr>
                            </React.Fragment>
                        ))}
                        <tr>
                            <td colSpan={2}>Grand Total</td>
                            <td>
                                {formatCurrency(data.filter(row => row.Type !== 'Checking').reduce((acc, row) => acc + row.Amount, 0))}
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
                <div className="middleColumn">
                    <table className="table">
                        <tbody>
                        <tr>
                            <th colSpan={2}>HouseHold</th>
                        </tr>
                        {combineHouseholdRecords(data.filter(row => row.Type === 'Household')).map((row, index) => (
                            <tr key={index} className="household">
                                <td>{row.Name}</td>
                                <td>{formatCurrency(row.Amount)}</td>
                            </tr>
                        ))}
                        <tr className="footer">
                            <td>Total</td>
                            <td>
                                {formatCurrency(data
                                    .filter(row => row.Type === 'Household')
                                    .reduce((acc, row) => acc + row.Amount, 0))}
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
                <div className="rightColumn">
                    <table className="table">
                        <tbody>
                        <tr>
                            <td colSpan={2}>Grand Total</td>
                            <td>
                                {formatCurrency(data.filter(row => row.Type !== 'Checking').reduce((acc, row) => acc + row.Amount, 0))}
                            </td>
                        </tr>
                        </tbody>
                    </table>
                    {/*Account*/}
                </div>
            </div>
        </div>
    )
        ;
};

export default HomePage;