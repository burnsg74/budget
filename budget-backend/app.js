import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import {handleUpload} from "./controllers/UploadController.js";

const app = express();
const upload = multer({dest: 'uploads/'});
const port = process.env.PORT || 5174;

dotenv.config();
sqlite3.verbose();

app.use(express.json());

console.log('NODE_ENV x', process.env.NODE_ENV);

const dbPath = process.env.NODE_ENV === 'production' 
  ? process.env.DB_PATH_PROD 
  : process.env.DB_PATH_DEV;
console.log('DB x', dbPath);

app.post('/api/db', (req, res) => {
    const { query, id } = req.body;
    if (!query || typeof query !== 'string') {
        res.status(400).send('Invalid query');
        return;
    }
    const operation = query.trim().split(' ')[0].toUpperCase();
    if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(operation)) {
        res.status(400).send('Invalid SQL operation');
        return;
    }

    sqlite3.verbose();
    const db = new sqlite3.Database(dbPath);

    if (operation === 'SELECT') {
        db.all(query, [], (err, records) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error retrieving records');
                return;
            }
            res.json(records);
        });
    } else {
        db.run(query, [], function (err) {
            if (err) {
                console.error(err);
                res.status(500).send(`Error executing ${operation} operation`);
                return;
            }

            res.json({
                id: this.lastID,
                changes: this.changes
            });

        });
    }

    db.close();
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    handleUpload(req, res).then();
});

app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
});
