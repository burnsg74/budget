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
        {field: "account_name", headerName: "Account", flex: 2, sortable: true, filter: true},
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
        {field: "memo", headerName: "Memo", flex: 2, sortable: true, filter: true},
    ];

    useEffect(() => {
        fetchData<ILedger[]>(
            `SELECT l.*,
                    a.name AS account_name
             FROM main.ledger l
                      LEFT JOIN main.accounts a ON l.account_id = a.id`
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