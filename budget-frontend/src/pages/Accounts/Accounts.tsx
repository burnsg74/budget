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
        { field: "id", headerName: "ID", flex: 1, sortable: true, editable: true, filter: "agTextColumnFilter" },
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
        { field: "classification", headerName: "Classification", flex: 1, sortable: true, editable: true, filter: "agTextColumnFilter" },
        { field: "balance", headerName: "Balance", flex: 1, sortable: true, editable: true, filter: "agTextColumnFilter" },
        { field: "match_string", headerName: "Match String", flex: 1 , sortable: true, editable: true, filter: "agTextColumnFilter"},
        { field: "memo", headerName: "Memo",flex: 1 , sortable: true, editable: true, filter: "agTextColumnFilter"},
    ];

    useEffect(() => {
        fetchData<IAccount[]>('SELECT * FROM accounts').then(setAccounts);
    }, []);


    const onCellValueChanged = (params: { data: any; colDef: any; newValue: any; }) => {
        console.log('PARAMS:',params);
        const { data, colDef, newValue } = params;
        const field = colDef.field;
        console.log(`Row ID: ${data.id}, Field: ${field}, New Value: ${newValue}`);

        // Update your rowData with the new value
        // const updatedRowData = rowData.map((row) => {
        //     if (row === data) {
        //         return { ...row, [field]: newValue };
        //     }
        //     return row;
        // });
        //
        // setRowData(updatedRowData);

        // Save to database
        const query = `UPDATE Accounts SET ${field} = '${newValue}' WHERE id = ${data.id};`;
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

    return (
        <div style={{padding: "10px"}}>
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

export default Accounts;