import React, {useState, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import {ColDef} from 'ag-grid-community';
import {fetchData} from "../../utils/db";
import {IAccount, ILedger} from "../../types";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import styles from "./Ledger.module.css";

const Ledgers: React.FC = () => {
    const [ledger, setLedger] = useState<ILedger[]>([]);
    const columnDefs: ColDef[] = [
        {field: "date", headerName: "Date", flex: 1, sortable: true, filter: true},
        {field: "from_account_name", headerName: "From", flex: 2, sortable: true, editable: true, filter: true},
        {field: "to_account_name", headerName: "To", flex: 2, sortable: true, editable: true, filter: true},
        {
            field: "amount",
            headerName: "Amount",
            flex: 1,
            sortable: true,
            filter: true,
            cellStyle: {textAlign: 'right'},
            valueFormatter: params => {
                return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(params.value);
            }
        },
        {field: "classification", headerName: "Classification", flex: 1, sortable: true, editable: true, filter: true},
        {field: "memo", headerName: "Memo", flex: 1, sortable: true, editable: true, filter: true},
    ];

    useEffect(() => {
        fetchData<ILedger[]>(
            `SELECT l.*,
                    a1.name AS from_account_name,
                    a2.name AS to_account_name
             FROM main.ledger l
                      LEFT JOIN
                  main.accounts a1 ON l.from_account_id = a1.id
                      LEFT JOIN
                  main.accounts a2 ON l.to_account_id = a2.id`
        ).then(setLedger);
    }, []);

    return (
        <div>
            <h1>Ledgers</h1>
            <div className="ag-theme-quartz" style={{height: "90vh"}}>
                <AgGridReact rowData={ledger} columnDefs={columnDefs}/>
            </div>
        </div>
    );
};

export default Ledgers;