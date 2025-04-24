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
const FNBO_ACCOUNT_ID = 17;
let fileFromAccountID = UMPQUA_ACCOUNT_ID;
let fileFromAccountName = 'Umpqua';

export const handleUpload = async (req, res) => {
    const file = req.file;
    if (!file) {
        res.status(400).json({error: 'No file uploaded'});
        return;
    }
    const filePath = file.path;

    if (file.originalname.startsWith('Transactions')) {
        fileFromAccountID = FNBO_ACCOUNT_ID;
        fileFromAccountName = 'FNBO';
    }
}