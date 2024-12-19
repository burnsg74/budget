import React, { useState, useEffect } from 'react';

const useDatabaseQuery = (query: string) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
                const response = await fetch('/api/db', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: query }),
                });

                return await response.json();
        };
        fetchData();
    }, [query]);

};

