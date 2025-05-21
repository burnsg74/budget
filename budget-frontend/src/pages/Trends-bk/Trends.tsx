import React, { useEffect, useState } from "react";
import { fetchData } from "../../utils/db";
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

const MonthlyComparison: React.FC = () => {
    const [monthlyData, setMonthlyData] = useState<{
        month: string,
        income: number,
        expenses: { [key: string]: number }
    }[]>([]);
    
    useEffect(() => {
        // Fetch income data
        const incomeQuery = `
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(ABS(amount)) as total
            FROM ledger l
            INNER JOIN accounts a ON l.from_account_id = a.id
            WHERE 
                a.type = 'Income'
                AND date >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', date)
            ORDER BY month ASC`;
            
        // Fetch expenses data by type
        const expensesQuery = `
            SELECT 
                strftime('%Y-%m', date) as month,
                a.type,
                SUM(amount) as total
            FROM ledger l
            INNER JOIN accounts a ON l.to_account_id = a.id
            WHERE 
                a.type != 'Income'
                AND a.type != 'Bank'
                AND date >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', date), a.type
            ORDER BY month ASC`;
            
        Promise.all([
            fetchData<{month: string, total: number}[]>(incomeQuery),
            fetchData<{month: string, type: string, total: number}[]>(expensesQuery)
        ]).then(([incomeData, expensesData]) => {
            // Process and combine the data
            const processedData = incomeData.map(income => {
                const monthExpenses = expensesData
                    .filter(expense => expense.month === income.month)
                    .reduce((acc, curr) => {
                        acc[curr.type] = Math.abs(curr.total);
                        return acc;
                    }, {} as {[key: string]: number});
                
                return {
                    month: income.month,
                    income: income.total,
                    expenses: monthExpenses
                };
            });
            
            setMonthlyData(processedData);
        });
    }, []);

    // Get unique expense types
    const expenseTypes = Array.from(new Set(
        monthlyData.flatMap(data => Object.keys(data.expenses))
    )).sort();

    const chartOptions: Highcharts.Options = {
        chart: {
            type: 'column'
        },
        title: {
            text: 'Monthly Income vs Expenses'
        },
        xAxis: {
            categories: monthlyData.map(data => data.month),
            title: {
                text: 'Month'
            }
        },
        yAxis: {
            title: {
                text: 'Amount (USD)'
            },
            labels: {
                formatter: function() {
                    return new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0
                    }).format(this.value as number);
                }
            }
        },
        plotOptions: {
            column: {
                stacking: 'normal'
            }
        },
        series: [
            {
                type: 'column',
                name: 'Income',
                data: monthlyData.map(data => data.income),
                color: '#2ecc71'
            },
            ...expenseTypes.map(type => ({
                type: 'column',
                name: type,
                stack: 'expenses',
                data: monthlyData.map(data => data.expenses[type] || 0)
            }))
        ],
        tooltip: {
            formatter: function() {
                return `${this.x}<br/>${this.series.name}: <b>${
                    new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                    }).format(this.y as number)
                }</b>`;
            }
        }
    };

    return (
        <div>
            <h2>Income vs Expenses Comparison</h2>
            {monthlyData.length > 0 ? (
                <HighchartsReact
                    highcharts={Highcharts}
                    options={chartOptions}
                />
            ) : (
                <p>Loading data...</p>
            )}
        </div>
    );
};

export default MonthlyComparison;