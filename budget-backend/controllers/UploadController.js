const sqlite3 = require('sqlite3');
const fs = require('fs').promises;
const readline = require('readline');
const crypto = require('crypto');
const dotenv = require("dotenv");
const parse = require('csv-parse/sync');

sqlite3.verbose();
dotenv.config();

const dbPath = process.env.NODE_ENV === 'production'
    ? process.env.DB_PATH_PROD
    : process.env.DB_PATH_DEV;
const db = new sqlite3.Database(dbPath);

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
        const records = parse.parse(content, {
            columns: true, // if you want to treat the first row as header
            bom: true
        });
        return records;
    } catch (error) {
        console.error("Error reading CSV file:", error);
        throw error;
    }
};


exports.handleUpload = async (req, res) => {

    const processAccountHistory = async (filePath, accounts) => {
        const records = await readCSV(filePath);
        const ledger = [];
        for (const record of records) {

            if (record["Status"] === "Pending") {
                continue;
            }
            record['Hash'] = crypto.createHash('md5').update(Object.values(record).join()).digest('hex');
            let fromAccountID = null;
            let fromAccountName = null;
            let toAccountID = null;
            let toAccountName = null;
            let matchedAccount = null;
            for (const account of accounts) {
                if (record["Description"].includes(account.MatchString)) {
                    matchedAccount = account;
                    break;
                }
            }
            if (!matchedAccount) {
                const insertAccountSQL = `
                    INSERT INTO Accounts (Name, Classification, Balance, MatchString, Type)
                    VALUES (?, ?, ?, ?, ?)`;
                matchedAccount = await new Promise((resolve, reject) => {
                    db.run(insertAccountSQL, [record["Description"], record["Classification"], 0.0, record["Description"], "Unknown"], function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            const accountRecord = {
                                ID: this.lastID,
                                Name: record["Description"],
                                Classification: record["Classification"],
                                Balance: 0.0, // Since you are inserting 0.0
                                MatchString: record["Description"],
                                Type: "Unknown"
                            };

                            resolve(accountRecord);
                        }
                    });
                });
                accounts.push(matchedAccount);
            }
            if (matchedAccount) {
                if (record["Debit"] !== '') {
                    fromAccountID = 1;
                    fromAccountName = 'Umqua';
                    toAccountID = matchedAccount.ID;
                    toAccountName = matchedAccount.Name;
                } else {
                    fromAccountID = matchedAccount.ID;
                    fromAccountName = matchedAccount.Name;
                    toAccountID = 1;
                    toAccountName = 'Umqua';
                }
                const amount = parseFloat(record["Debit"] !== '' ? record["Debit"] : record["Credit"]);
                const ledgerRecord = {
                    Date: record["Post Date"],
                    FromAccountID: fromAccountID,
                    FromAccountName: fromAccountName,
                    ToAccountID: toAccountID,
                    ToAccountName: toAccountName,
                    Amount: amount,
                    Classification: record["Classification"],
                    Memo: record["Description"],
                    Hash: record["Hash"]
                };
                ledger.push(ledgerRecord);
            }
        }
        return ledger;
    };

    const getAccountID = (accountName, accounts) => {
        return accounts.find(account => account.Name === accountName);
    };

    const file = req.file;
    if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }
    const fileName = file.filename;
    const filePath = file.path;

    try {
        const selectSQL = `SELECT *
                           FROM Accounts`;
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
        const insertSQL = `
            INSERT INTO Ledger (Date, FromAccountID, FromAccountName, ToAccountID, ToAccountName, Amount,
                                Classifications, Memo, Hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(Hash) DO UPDATE SET Date            = excluded.Date,
                                            FromAccountID   = excluded.FromAccountID,
                                            FromAccountName = excluded.FromAccountName,
                                            ToAccountID     = excluded.ToAccountID,
                                            ToAccountName   = excluded.ToAccountName,
                                            Amount          = excluded.Amount,
                                            Classifications = excluded.Classifications,
                                            Memo            = excluded.Memo;
        `;
        for (const record of ledger) {
            const formattedDate = formatDate(record.Date);
            await new Promise((resolve, reject) => {
                db.run(insertSQL, [formattedDate, record.FromAccountID, record.FromAccountName, record.ToAccountID, record.ToAccountName, record.Amount, record.Classification, record.Memo, record.Hash], function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
        }
        res.json({ message: 'File uploaded successfully', path: filePath });
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Failed to save file' });
    } finally {
        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
        });
    }
};