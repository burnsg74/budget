import React, { useState, useEffect } from "react";
import { Account } from "../types.tsx";
import { AgGridReact } from "ag-grid-react";
import { ColDef } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

const AccountsPage: React.FC = () => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [rowData, setRowData] = useState([]);

    // Column definitions for the AgGrid
    const columnDefs: ColDef[] = [
        { field: "Name", headerName: "Name", flex: 2, sortable: true, editable: true, filter: "agTextColumnFilter" },
        { field: "Type", headerName: "Type", flex: 1, sortable: true, editable: true, filter: "agTextColumnFilter" },
        { field: "Classification", headerName: "Classification", flex: 1, sortable: true, editable: true, filter: "agTextColumnFilter" },
        { field: "Balance", headerName: "Balance", flex: 1, sortable: true, editable: true, filter: "agTextColumnFilter" },
        { field: "MatchString", headerName: "Match String", flex: 1 , sortable: true, editable: true, filter: "agTextColumnFilter"},
        { field: "Memo", headerName: "Memo",flex: 1 , sortable: true, editable: true, filter: "agTextColumnFilter"},
    ];

    const onCellValueChanged = (params) => {
        console.log('PARAMS:',params);
        const { data, colDef, newValue } = params;
        const field = colDef.field;
        console.log(`Row ID: ${data.ID}, Field: ${field}, New Value: ${newValue}`);

        // Update your rowData with the new value
        const updatedRowData = rowData.map((row) => {
            if (row === data) {
                return { ...row, [field]: newValue };
            }
            return row;
        });

        setRowData(updatedRowData);

        // Save to database
        const query = `UPDATE Accounts SET ${field} = '${newValue}' WHERE ID = ${data.ID};`;
        try {
            fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
            });
        } catch (error) {
            console.error(error);
        }

    };

    const fetchAccounts = async () => {
        const query = `SELECT * FROM Accounts;`;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
            });
            const data: Account[] = await response.json();
            setAccounts(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchAccounts().then();
    }, []);

    return (
        <div>
            <h1>Accounts</h1>
            <div className="ag-theme-quartz" style={{ height: "90vh" }}>
                <AgGridReact rowData={accounts}
                             columnDefs={columnDefs}
                             onCellValueChanged={onCellValueChanged}
                />
            </div>
        </div>
    );
};

export default AccountsPage;