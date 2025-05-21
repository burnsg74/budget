import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchData } from '../../utils/db';
import styles from "./styles.module.css";

const Unknown: React.FC = () => {
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
    const inputRef = useRef<HTMLInputElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    const fetchAccounts = async () => {
        const query = `
            SELECT *
            FROM accounts a
            WHERE a.type = 'Unknown'
            ORDER BY a.name
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
        if (selectedIndex === -1 || !accounts[selectedIndex]) return;

        const account = accounts[selectedIndex];
        updateAccountType(account.id, newType);
    }, [selectedIndex, accounts]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!accounts.length || isUpdating) return;

        const key = event.key.toLowerCase();

        // If we're editing, don't handle other shortcuts
        if (editingName !== null) {
            return;
        }

        // Navigation keys
        if (key === 'j' || key === 'arrowdown') {
            event.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, accounts.length - 1));
        } else if (key === 'k' || key === 'arrowup') {
            event.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        }

        // Name editing triggers
        if ((key === 'e' || key === 'n') && selectedIndex !== -1) {
            event.preventDefault();
            setEditingName(accounts[selectedIndex].id);
        }

        // Type change shortcuts
        const typeMap: Record<string, string> = {
            'i': 'Income',
            'b': 'Bill',
            'h': 'Household',
            'c': 'Credit Card',
            'm': 'Mortgage',
            'l': 'Loan',
            'o': 'Other'
        };

        if (typeMap[key]) {
            event.preventDefault();
            handleTypeChange(typeMap[key]);
        }
    }, [accounts.length, isUpdating, handleTypeChange, selectedIndex, editingName]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // Focus input when editing starts
    useEffect(() => {
        if (editingName !== null && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingName]);

    return (
        <div className={styles["unknown-table"]} ref={tableRef}>
            {isUpdating && <div className={styles["loading-indicator"]}>Updating...</div>}
            <table>
                <thead>
                    <tr className={styles["type-name"]}>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Match String</th>
                        <th>Created At</th>
                        <th>Updated At</th>
                        <th>Last Transaction</th>
                        <th>Active</th>
                    </tr>
                </thead>
                <tbody>
                    {accounts.map((account, index) => (
                        <tr
                            key={account.id}
                            data-index={index}
                            onClick={() => setSelectedIndex(index)}
                            className={`${selectedIndex === index ? styles["selected-row"] : ''} 
                                      ${styles["account-row"]}
                                      ${styles[account.type.toLowerCase().replace(' ', '-')]}`}
                        >
                            <td>{account.id}</td>
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
                            <td>{account.type}</td>
                            <td>{account.match_string}</td>
                            <td>{account.created_at}</td>
                            <td>{account.updated_at}</td>
                            <td>{account.last_transaction_at}</td>
                            <td>{account.active.toString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Unknown;