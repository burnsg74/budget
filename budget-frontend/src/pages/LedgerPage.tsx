import React, { useState, useEffect } from "react";
import { Ledger } from "../types"; // Make sure to adjust the path as needed
import { AgGridReact } from "ag-grid-react";
import { ColDef } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

const LedgersPage: React.FC = () => {
    const [ledgers, setLedgers] = useState<Ledger[]>([]);

    const columnDefs: ColDef[] = [
        { field: "Date", headerName: "Date", flex: 1, sortable: true, filter:true },
        { field: "FromAccountName", headerName: "From", flex: 2, sortable: true, editable: true, filter:true },
        { field: "ToAccountName", headerName: "To", flex: 2, sortable: true, editable: true, filter:true },
        {
            field: "Amount",
            headerName: "Amount",
            flex: 1,
            sortable: true,
            filter: true,
            cellStyle: { textAlign: 'right' },
            valueFormatter: params => {
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(params.value);
            }
        },
        { field: "Classification", headerName: "Classification", flex: 1, sortable: true, editable: true, filter:true },
        { field: "Memo", headerName: "Memo", flex: 1, sortable: true, editable: true, filter:true },
    ];

    const fetchLedgers = async () => {
        const query = `SELECT * FROM Ledger;`;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
            });
            const data: Ledger[] = await response.json();
            setLedgers(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchLedgers();
    }, []);

    const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fileInput = form.elements.namedItem('file') as HTMLInputElement;
        const file = fileInput.files?.[0];

        if (!file) {
            console.error("No file selected");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            if (!response.ok) {
                throw new Error('File upload failed');
            }

            // Handle successful file upload
            console.log('File uploaded successfully');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h1>Ledgers</h1>
                <form encType="multipart/form-data" onSubmit={handleFileUpload}>
                    <input type="file" name="file" placeholder="Upload" aria-label="Upload" required/>
                    <button type="submit">Upload</button>
                </form>
            </div>
            <div className="ag-theme-quartz"  style={{ height: "90vh" }}>
                <AgGridReact rowData={ledgers} columnDefs={columnDefs}/>
            </div>
        </div>
    );
};

export default LedgersPage;