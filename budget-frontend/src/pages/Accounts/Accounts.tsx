import React, { useState, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from 'ag-grid-community';
import { fetchData } from "../../utils/db";
import { IAccount } from "../../types";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import styles from "./Accounts.module.css";

const Accounts: React.FC = () => {
    const [accounts, setAccounts] = useState<IAccount[]>([]);
    const columnDefs: ColDef[] = [
        { field: "id", headerName: "ID", flex: 1, sortable: true, filter: "agTextColumnFilter" },
        { field: "name", headerName: "Name", flex: 2, sortable: true, editable: true, filter: "agTextColumnFilter" },
        {
            field: "type",
            headerName: "Type",
            flex: 1,
            sortable: true,
            editable: true,
            filter: "agTextColumnFilter",
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: ['Bank', 'Bill', 'Household', 'Income', 'Credit Card', 'Loan', 'Other', 'Unknown']
            }
        },
        { 
            field: "match_string", 
            headerName: "Match String", 
            flex: 1, 
            sortable: true, 
            editable: true, 
            filter: "agTextColumnFilter"
        },
        { 
            field: "created_at", 
            headerName: "Created At", 
            flex: 1, 
            sortable: true, 
            filter: "agDateColumnFilter",
            valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : ''
        },
        { 
            field: "updated_at", 
            headerName: "Updated At", 
            flex: 1, 
            sortable: true, 
            filter: "agDateColumnFilter",
            valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : ''
        },
        { 
            field: "last_transaction_at", 
            headerName: "Last Transaction", 
            flex: 1, 
            sortable: true, 
            filter: "agDateColumnFilter",
            valueFormatter: (params) => params.value ? new Date(params.value).toLocaleString() : ''
        },
        {
            field: "active",
            headerName: "Active",
            flex: 1,
            sortable: true,
            editable: true,
            filter: "agSetColumnFilter",
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: [0, 1]
            },
            valueFormatter: (params) => params.value === 1 ? 'Yes' : 'No'
        }
    ];

    useEffect(() => {
        fetchData<IAccount[]>('SELECT * FROM accounts').then(setAccounts);
    }, []);

    const onCellValueChanged = (params: { data: any; colDef: any; newValue: any; }) => {
        const { data, colDef, newValue } = params;
        const field = colDef.field;
        
        // Update the updated_at timestamp
        const now = new Date().toISOString();
        const query = `UPDATE Accounts SET ${field} = '${newValue}', updated_at = '${now}' WHERE id = ${data.id};`;
        
        try {
            fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
            }).then(() => {
                // Refresh the data after update
                fetchData<IAccount[]>('SELECT * FROM accounts').then(setAccounts);
            });
        } catch (error) {
            console.error(error);
        }

        console.log('Field: ',field)
        if (field === 'match_string') {
            console.log('Match string changed', newValue);
            for (const account of accounts) {
                console.log('Checking account', account.id, account.name);
                if ((account.id !== data.id) && account.name.toLowerCase().includes(newValue.toLowerCase())) {
                    console.log('Matched account', account.id, account.name);
                    const deleteQuery = `DELETE FROM Accounts WHERE id = ${account.id};`;
                    console.log('Delete query', deleteQuery);

                    setAccounts(prevAccounts => prevAccounts.filter(acc => acc.id !== account.id));

                    fetch("/api/db", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ query: deleteQuery }),
                    });
                }
            }
        }
    };

    return (
        <div style={{padding: "10px"}}>
            <h1>Accounts</h1>
            <div className="ag-theme-quartz" style={{ height: "90vh" }}>
                <AgGridReact 
                    rowData={accounts}
                    columnDefs={columnDefs}
                    onCellValueChanged={onCellValueChanged}
                />
            </div>
        </div>
    );
};

export default Accounts;