import sqlite3 from 'sqlite3';

// Get the name argument from the command line
const nameArg = process.argv[2];

if (!nameArg) {
    console.error('Please provide a name as a command line argument.');
    process.exit(1);
}

// Open the SQLite database
let db = new sqlite3.Database('./db-dev.sqlite3', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('Database connection opened successfully.');
});

// Function to query, delete, and insert records
function processDatabase() {
    db.serialize(() => {
        console.log('Beginning database serialization.');

        // Query for one record to use as a template
        db.get(
            `SELECT t.*
             FROM accounts t
             WHERE name LIKE '${nameArg}%'
             LIMIT 1`,
            (err, row) => {
                if (err) {
                    console.error('Error querying database:', err.message);
                    return;
                }

                console.log('Query executed successfully.');
                if (!row) {
                    console.log('No matching record found.');
                    return;
                }

                console.log('Retrieved template row:', row);

                // Delete all records from the database
                db.run(`DELETE FROM accounts WHERE name LIKE '${nameArg}%'`, (err, row) => {
                    if (err) {
                        console.error('Error deleting records:', err.message);
                        return;
                    }

                    console.log('All records deleted.');

                    const columns = Object.keys(row).join(', ');
                    const placeholders = Object.keys(row).map(() => '?').join(', ');
                    const values = Object.values(row);

                    // Update the `name` and `march_string` fields with `nameArg`
                    if ('name' in row) {
                        const nameIndex = Object.keys(row).indexOf('name');
                        values[nameIndex] = nameArg;
                    }
                    if ('march_string' in row) {
                        const marchStringIndex = Object.keys(row).indexOf('march_string');
                        values[marchStringIndex] = nameArg;
                    }

                    const insertQuery = `INSERT INTO accounts (${columns}) VALUES (${placeholders})`;
                    console.log('Insert query:', insertQuery);

                    db.run(insertQuery, values, (err) => {
                        if (err) {
                            console.error('Error inserting record:', err.message);
                            return;
                        }

                        console.log('New record inserted successfully with values:', values);
                    });

                });
            }
        );
    });
}

// Execute the database processing function
processDatabase();

function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
}