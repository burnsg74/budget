export async function dbQuery<T>(query: string): Promise<T> {
    const response = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    console.log(response);

    return response.json();
}

// This function directly fetches data based on a query
export async function fetchData<T>(query: string): Promise<T> {
    console.log(query);
    return dbQuery(query);
}