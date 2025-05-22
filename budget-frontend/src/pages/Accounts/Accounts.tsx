import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchData } from '../../utils/db';
import styles from "./styles.module.css";

const Accounts: React.FC = () => {
    interface Account {
        id: number;
        name: string;
        type: string;
        match_string: string;
        created_at: string;
        updated_at: string;
        last_transaction_at: string;
        active: boolean;
    }

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editingName, setEditingName] = useState<number | null>(null);
    const [editingMatchString, setEditingMatchString] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);
    const [sortField, setSortField] = useState<keyof Account | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [filters, setFilters] = useState<Partial<Record<keyof Account, string>>>({});


    const handleFilterChange = (field: keyof Account, value: string) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const getFilteredAccounts = () => {
        return accounts.filter(account => {
            return Object.entries(filters).every(([field, filterValue]) => {
                if (!filterValue) return true;

                const value = account[field as keyof Account];
                if (value === null || value === undefined) return false;

                return String(value)
                    .toLowerCase()
                    .includes(filterValue.toLowerCase());
            });
        });
    };


    const handleSort = (field: keyof Account) => {
        const newDirection = field === sortField && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortDirection(newDirection);

        const sortedAccounts = [...accounts].sort((a, b) => {
            const aValue = a[field];
            const bValue = b[field];

            if (aValue === null) return 1;
            if (bValue === null) return -1;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return newDirection === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return newDirection === 'asc'
                    ? aValue - bValue
                    : bValue - aValue;
            }

            if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                return newDirection === 'asc'
                    ? (aValue === bValue ? 0 : aValue ? 1 : -1)
                    : (aValue === bValue ? 0 : aValue ? -1 : 1);
            }

            return 0;
        });

        setAccounts(sortedAccounts);
    };


    const fetchAccounts = async () => {
        const query = `
            SELECT *
            FROM accounts a
            WHERE a.type = 'Unknown'
            ORDER BY a.id
        `;

        const fetchedAccounts = await fetchData<Account[]>(query);
        setAccounts(fetchedAccounts);
        if (fetchedAccounts.length > 0 && selectedIndex === -1) {
            setSelectedIndex(0);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const updateAccountName = async (accountId: number, newName: string) => {
        setIsUpdating(true);
        try {
            const query = `UPDATE accounts 
                          SET name = ?, 
                              updated_at = CURRENT_TIMESTAMP 
                          WHERE id = ?`;
            await fetch("/api/db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    query,
                    params: [newName, accountId]
                }),
            });

            // Update local state
            setAccounts(prev => prev.map(account =>
                account.id === accountId
                    ? { ...account, name: newName, updated_at: new Date().toISOString() }
                    : account
            ));
        } catch (error) {
            console.error('Failed to update account name:', error);
        } finally {
            setIsUpdating(false);
            setEditingName(null);
        }
    };

    const updateMatchString = async (accountId: number, newMatchString: string) => {
        setIsUpdating(true);
        try {

            // First, find accounts with matching strings
            const matchQuery = `
                SELECT id FROM accounts 
                WHERE id != ? 
                AND LOWER(match_string) LIKE LOWER(?)
            `;
            const matchResponse = await fetch("/api/db", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    query: matchQuery,
                    params: [accountId, `%${newMatchString}%`]
                }),
            });
            const matchedAccounts = await matchResponse.json();
            console.log('Matched accounts:', matchedAccounts);

            if (matchedAccounts.length > 0) {
                // Update ledger entries for matched accounts
                const updateLedgerQuery = `
                    UPDATE ledger 
                    SET account_id = ? 
                    WHERE account_id IN (${matchedAccounts.map((a: { id: number }) => a.id).join(',')})
                `;
                await fetch("/api/db", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        query: updateLedgerQuery,
                        params: [accountId]
                    }),
                });

                // Delete matched accounts
                const deleteAccountsQuery = `
                    DELETE FROM accounts 
                    WHERE id IN (${matchedAccounts.map((a: { id: number }) => a.id).join(',')})
                `;
                await fetch("/api/db", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({query: deleteAccountsQuery}),
                });
            }

            // Update the match string for the current account
            const updateQuery = `
                UPDATE accounts 
                SET match_string = ?, 
                    updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            await fetch("/api/db", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    query: updateQuery,
                    params: [newMatchString, accountId]
                }),
            });

            // Update local state
            setAccounts(prev => {
                const filtered = prev.filter(account =>
                    !matchedAccounts.some((matched: { id: number }) => matched.id === account.id)
                );
                return filtered.map(account =>
                    account.id === accountId
                        ? {...account, match_string: newMatchString, updated_at: new Date().toISOString()}
                        : account
                );
            });
        } catch (error) {
            console.error('Failed to update match string:', error);
        } finally {
            setIsUpdating(false);
            setEditingMatchString(null);
        }
    };

    const updateAccountType = async (accountId: number, newType: string) => {
        setIsUpdating(true);
        try {
            const query = `UPDATE accounts
                           SET type = '${newType}',
                               updated_at = CURRENT_TIMESTAMP
                           WHERE id = ${accountId}`;
            await fetch("/api/db", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });

            // Update local state
            setAccounts(prev => prev.map(account =>
                account.id === accountId
                    ? { ...account, type: newType, updated_at: new Date().toISOString() }
                    : account
            ));
        } catch (error) {
            console.error('Failed to update account type:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleTypeChange = useCallback((newType: string) => {
        if (selectedIndex === -1) return;
        
        const filteredAccounts = getFilteredAccounts();
        const account = filteredAccounts[selectedIndex];
        if (!account) return;

        updateAccountType(account.id, newType);
    }, [selectedIndex, accounts, getFilteredAccounts]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!accounts.length || isUpdating) return;

        const key = event.key.toLowerCase();
        const filteredAccounts = getFilteredAccounts();

        // If we're editing, don't handle other shortcuts
        if (editingName !== null || editingMatchString !== null) {
            return;
        }

        // Navigation keys
        if (key === 'j' || key === 'arrowdown') {
            event.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredAccounts.length - 1));
        } else if (key === 'k' || key === 'arrowup') {
            event.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        }

        // Name editing triggers
        if (event.metaKey && key === 'e' && selectedIndex !== -1) {
            event.preventDefault();
            const account = filteredAccounts[selectedIndex];
            if (account) {
                setEditingName(account.id);
            }
        }

        // Match string editing trigger
        if (event.metaKey && key === 'm' && selectedIndex !== -1) {
            event.preventDefault();
            const account = filteredAccounts[selectedIndex];
            if (account) {
                setEditingMatchString(account.id);
            }
        }

        // Type change shortcuts
        const typeMap: Record<string, string> = {
            'i': 'Income',
            'b': 'Bill',
            'h': 'Household',
            'c': 'Credit Card',
            'l': 'Loan',
            'o': 'Other'
        };

        if (event.metaKey && typeMap[key] && selectedIndex !== -1) {
            event.preventDefault();
            const account = filteredAccounts[selectedIndex];
            if (account) {
                handleTypeChange(typeMap[key]);
            }
        }
    }, [accounts.length, isUpdating, handleTypeChange, selectedIndex, editingName, editingMatchString, getFilteredAccounts]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // Focus input when editing starts
    useEffect(() => {
        if ((editingName !== null || editingMatchString !== null) && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingName, editingMatchString]);

    return (
        <div className={styles["unknown-table"]} ref={tableRef}>
            {isUpdating && <div className={styles["loading-indicator"]}>Updating...</div>}
            Number of Accounts: {accounts.length}
            <table>
                <thead>
                <tr className={styles["type-name"]}>
                    <th>
                        <div onClick={() => handleSort('id')} style={{ cursor: 'pointer' }}>
                            ID {sortField === 'id' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </div>
                        <input
                            type="text"
                            value={filters.id || ''}
                            onChange={(e) => handleFilterChange('id', e.target.value)}
                            placeholder="Filter ID..."
                            className={styles["filter-input"]}
                        />
                    </th>
                    <th>
                        <div onClick={() => handleSort('type')} style={{ cursor: 'pointer' }}>
                            Type {sortField === 'type' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </div>
                        <input
                            type="text"
                            value={filters.type || ''}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            placeholder="Filter type..."
                            className={styles["filter-input"]}
                        />
                    </th>
                    <th>
                        <div onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                            Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </div>
                        <input
                            type="text"
                            value={filters.name || ''}
                            onChange={(e) => handleFilterChange('name', e.target.value)}
                            placeholder="Filter name..."
                            className={styles["filter-input"]}
                        />
                    </th>
                    <th>
                        <div onClick={() => handleSort('match_string')} style={{ cursor: 'pointer' }}>
                            Match String {sortField === 'match_string' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </div>
                        <input
                            type="text"
                            value={filters.match_string || ''}
                            onChange={(e) => handleFilterChange('match_string', e.target.value)}
                            placeholder="Filter match string..."
                            className={styles["filter-input"]}
                        />
                    </th>
                </tr>
                </thead>
                <tbody>
                {getFilteredAccounts().map((account, index) => (
                    // {accounts.map((account, index) => (
                        <tr
                            key={account.id}
                            data-index={index}
                            onClick={() => setSelectedIndex(index)}
                            className={`${selectedIndex === index ? styles["selected-row"] : ''} 
                                      ${styles["account-row"]}
                                      ${styles[account.type.toLowerCase().replace(' ', '-')]}`}
                        >
                            <td>{account.id}</td>
                            <td>{account.type}</td>
                            <td>
                                {editingName === account.id ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        defaultValue={account.name}
                                        className={styles["name-input"]}
                                        onBlur={(e) => updateAccountName(account.id, e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                updateAccountName(account.id, e.currentTarget.value);
                                            } else if (e.key === 'Escape') {
                                                setEditingName(null);
                                            }
                                            e.stopPropagation();
                                        }}
                                    />
                                ) : (
                                    account.name
                                )}
                            </td>
                            <td>
                                {editingMatchString === account.id ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        defaultValue={account.match_string}
                                        className={styles["name-input"]}
                                        onBlur={(e) => updateMatchString(account.id, e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                updateMatchString(account.id, e.currentTarget.value);
                                            } else if (e.key === 'Escape') {
                                                setEditingMatchString(null);
                                            }
                                            e.stopPropagation();
                                        }}
                                    />
                                ) : (
                                    account.match_string
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Accounts;