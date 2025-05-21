import crypto from 'crypto';
import {parse} from 'csv-parse/sync';
import dotenv from 'dotenv';
import {promises as fs} from 'fs';
import sqlite3 from 'sqlite3';

sqlite3.verbose();
dotenv.config();

const DB_PATH = process.env.NODE_ENV === 'production' ? process.env.DB_PATH_PROD : process.env.DB_PATH_DEV;
const db = new sqlite3.Database(DB_PATH);
const UMPQUA_ACCOUNT_ID = 1
const FNBO_ACCOUNT_ID = 2;
let fileFromAccountID = UMPQUA_ACCOUNT_ID;
let fileFromAccountName = 'Umpqua';

export const handleUpload = async (req, res) => {

    const processAccountHistory = async (filePath, accounts) => {
        console.log('Processing account history', filePath);
        const fileRows = await readCSV(filePath);
        const ledger = [];

        for (const [index, fileRow] of fileRows.entries()) {
            console.log(fileFromAccountName, index, fileRow);

            // Skip pending transactions
            if (fileFromAccountName === 'Umpqua' && fileRow["Status"] === "Pending") {
                continue;
            }

            // Skip FNBO PAYMENT records
            if (fileFromAccountName === 'FNBO' && fileRow.Description.startsWith('PAYMENT')) {
                console.log('Skipping FNBO PAYMENT record:', fileRow);
                continue;
            }

            // Add hash to row
            fileRow['Hash'] = crypto.createHash('md5').update(Object.values(fileRow).join()).digest('hex');

            let accountID = null;
            let matchedAccount = null;
            for (const account of accounts) {
                console.log(`Checking account for ${fileRow["Description"]}`, account.id);
                if (fileRow["Description"].toLowerCase().includes(account.match_string.toLowerCase())) {
                    console.log(`Matched account for ${fileRow["Description"]}`, account.id);
                    matchedAccount = account;
                    break;
                }
            }

            if (!matchedAccount) {
                console.log(`Account not found for ${fileRow["Description"]}`);
                matchedAccount = await insertNewAccount(db, fileRow);
                console.log(`New account created for ${fileRow["Description"]}`,'\n', matchedAccount);
                accounts.push(matchedAccount);
            }

            if (matchedAccount) {
                console.log(`2 Matched account for ${fileRow["Description"]}`, matchedAccount.id);
            } else {
                console.log(`2 No account matched for ${fileRow["Description"]}`);
            }


            // FNBO {Post Date: "2025-02-11", Amount: "-45.99", Description: "AMAZON MKTPL*RP37H1263 Amzn.com/billWA US "}
            // Umpqua {Account Number: "******7502", Post Date: "4/9/2025", Check: "", Description: "HILLTOP MARKET 3 WALDPORT OR USA", Debit: "18.60", ...}
            if (fileFromAccountName === 'Umpqua') {
                if (fileRow["Credit"] !== '') {
                    fileRow["Amount"] = fileRow["Credit"];
                } else {
                    fileRow["Amount"] = fileRow["Debit"];
                }
            }

            if (fileFromAccountName === 'FNBO') {
                fileRow["Amount"] = parseFloat(fileRow["Amount"].replace(/[^0-9.]+/g, ''))
            }

            const ledgerRecord = {
                date: fileRow["Post Date"],
                account_id: matchedAccount.id,
                amount: parseFloat(fileRow["Amount"]),
                memo: fileRow["Description"],
                hash: fileRow["Hash"]
            };
            ledger.push(ledgerRecord);
        }
        return ledger;
    };

    const file = req.file;
    if (!file) {
        res.status(400).json({error: 'No file uploaded'});
        return;
    }
    const filePath = file.path;

    try {

        const fileContent = await fs.readFile(filePath, 'utf8');
        const firstRow = fileContent.split('\n')[0].trim();

        // Check if the first row starts with 'Account Number'
        if (firstRow.startsWith('Account Number')) {
            fileFromAccountName = 'Umpqua';
        } else {
            fileFromAccountName = 'FNBO';
        }

        console.log(`File from account ${fileFromAccountName}`);

        const selectSQL = `SELECT id,
                                  name,
                                  match_string
                           FROM accounts`;
        const accounts = await new Promise((resolve, reject) => {
            db.all(selectSQL, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        console.log('Accounts', accounts);
        const ledger = await processAccountHistory(filePath, accounts);
        console.log('Ledger ',ledger);
        const insertSQL = `INSERT INTO ledger (date, account_id, amount,  memo, hash)
                           VALUES (?, ?, ?, ?, ?)`;
        for (const record of ledger) {
            const formattedDate = formatDate(record.date);

            await new Promise((resolve, reject) => {
                db.run(insertSQL, [formattedDate, record.account_id, record.amount, record.memo, record.hash], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(this.lastID)
                        resolve(this.lastID);
                    }
                });
            });

            const updateAccountSQL = `
                UPDATE accounts
                SET last_transaction_at = ?,
                    active              = 1
                WHERE id = ?`;

            await new Promise((resolve, reject) => {
                db.run(updateAccountSQL, [formattedDate, record.from_account_id], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });

            await new Promise((resolve, reject) => {
                db.run(updateAccountSQL, [formattedDate, record.to_account_id], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
        res.json({message: 'File uploaded successfully', path: filePath});
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({error: 'Failed to save file'});
    }
};

// Format date to 'YYYY-MM-DD'
function formatDate(date) {
    let d = new Date(date);
    let year = d.getFullYear();
    let month = (d.getMonth() + 1).toString().padStart(2, '0');
    let day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to read CSV file into array
const readCSV = async (filePath) => {
    try {
        const content = await fs.readFile(filePath);
        let columns = true
        if (fileFromAccountName === 'FNBO') {
            columns = ['Post Date', 'Amount', 'Description'];
        }
        return parse(content, {
            columns: columns, // treat the first row as header
            bom: true
        });
    } catch (error) {
        console.error("Error reading CSV file:", error);
        throw error;
    }
};

async function insertNewAccount(db, fileRow) {
    const newAccount = {
        name: fileRow["Description"],
        type: 'Unknown',
        match_string: fileRow["Description"],
        created_at: formatDate(new Date()),
    };

    console.log('New Account:F', newAccount);

    const insertAccountSQL = `
        INSERT INTO accounts (name, type, match_string, created_at, updated_at, last_transaction_at, active)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

    return new Promise((resolve, reject) => {
        db.run(insertAccountSQL, [newAccount.name, newAccount.type, newAccount.match_string, newAccount.created_at, newAccount.created_at, newAccount.created_at, 1], function (err) {
            if (err) {
                reject(err);
            } else {
                const insertedAccountId = this.lastID; // Get the inserted account's ID
                const fetchAccountSQL = `SELECT *
                                         FROM accounts
                                         WHERE id = ?`;

                db.get(fetchAccountSQL, [insertedAccountId], (error, row) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(row);
                    }
                });
            }
        });
    });
}