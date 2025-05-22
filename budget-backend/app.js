import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import {handleUpload} from "./controllers/UploadController.js";
// handleValidation

const app = express();
const upload = multer({dest: 'uploads/'});
const port = process.env.PORT || 5174;

dotenv.config();
sqlite3.verbose();

app.use(express.json());

const dbPath = process.env.NODE_ENV === 'production'
  ? process.env.DB_PATH_PROD 
  : process.env.DB_PATH_DEV;

app.get('/api', (req, res) => {
    res.send({
        app: 'Budget',
        dbPath: dbPath
    });
});

app.post('/api/db', (req, res) => {
    const { query, params } = req.body;
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

    // Convert params to an array if it exists, or use empty array as default
    const sqlParams = Array.isArray(params) ? params : [];

    if (operation === 'SELECT') {
        db.all(query, sqlParams, (err, records) => {
            if (err) {
                console.error('Error: ', err);
                res.status(500).send(err);
                return;
            }
            if (records.length === 0) {
                res.json([]);
                return;
            }
            res.json(records);
        });
    } else {
        db.run(query, sqlParams, function (err) {
            if (err) {
                console.error(err);
                res.status(500).send(`Error executing ${operation} operation`);
                return;
            }

            console.log('Query:', query);
            console.log('Params:', sqlParams);

            res.json({
                id: this.lastID,
                changes: this.changes
            });
        });
    }

    db.close();
});

app.post('/api/upload/validate', upload.single('file'), (req, res) => {
    handleValidation(req, res).then();
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    handleUpload(req, res).then();
});

app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
});