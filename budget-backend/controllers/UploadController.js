import sqlite3 from 'sqlite3';
import {promises as fs} from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {parse} from 'csv-parse/sync';

sqlite3.verbose();
dotenv.config();

const DB_PATH = process.env.NODE_ENV === 'production'
    ? process.env.DB_PATH_PROD
    : process.env.DB_PATH_DEV;
const db = new sqlite3.Database(DB_PATH);

export const handleUpload = async (req, res) => {

    const processAccountHistory = async (filePath, accounts) => {
        const fileRows = await readCSV(filePath);
        const ledger = [];
        for (const fileRow of fileRows) {

            // Skip pending transactions
            if (fileRow["Status"] === "Pending") {
                continue;
            }

            // Add hash to row
            fileRow['Hash'] = crypto.createHash('md5').update(Object.values(fileRow).join()).digest('hex');

            let fromAccountID = null;
            let toAccountID = null;
            let matchedAccount = null;
            for (const account of accounts) {
                if (fileRow["Description"].includes(account.match_string)) {
                    matchedAccount = account;
                    break;
                }
            }

            if (!matchedAccount) {
                matchedAccount = await insertNewAccount(db, fileRow);
                accounts.push(matchedAccount);
            }

            if (fileRow["Debit"] !== '') {
                fromAccountID = 1;
                toAccountID = matchedAccount.id;
            } else {
                fromAccountID = matchedAccount.id;
                toAccountID = 1;
            }
            const amount = parseFloat(fileRow["Debit"] !== '' ? fileRow["Debit"] : fileRow["Credit"]);
            const ledgerRecord = {
                date: fileRow["Post Date"],
                from_account_id: fromAccountID,
                to_account_id: toAccountID,
                amount: amount,
                classification: fileRow["Classification"],
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
        const selectSQL = `SELECT id,
                                  name,
                                  classification,
                                  balance,
                                  match_string,
                                  created_at,
                                  updated_at,
                                  last_transaction_at
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

        const ledger = await processAccountHistory(filePath, accounts);
        const insertSQL = `INSERT INTO ledger (date, from_account_id, to_account_id, amount, classification, memo, hash)
                           VALUES (?, ?, ?, ?, ?, ?, ?)`;
        for (const record of ledger) {
            const formattedDate = formatDate(record.date);

            await new Promise((resolve, reject) => {
                db.run(insertSQL, [formattedDate, record.from_account_id, record.to_account_id, record.amount, record.classification, record.memo, record.hash], function (err) {
                    if (err) {
                        reject(err);
                    } else {
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
        return parse(content, {
            columns: true, // treat the first row as header
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
        classification: fileRow["Classification"],
        balance: 0.0,
        match_string: fileRow["Description"],
        created_at: formatDate(new Date()),
        updated_at: formatDate(new Date()),
        last_transaction_at: null
    };

    const insertAccountSQL = `
        INSERT INTO accounts (name, type, classification, balance, match_string, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;

    return new Promise((resolve, reject) => {
        db.run(insertAccountSQL, [
            newAccount.name,
            newAccount.type,
            newAccount.classification,
            newAccount.balance,
            newAccount.match_string,
            newAccount.created_at,
            newAccount.updated_at
        ], function (err) {
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