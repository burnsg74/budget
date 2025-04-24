import React, { useState, useEffect } from "react";
import styles from "./Unknown.module.css";
import { IAccount } from "../../types";
import { fetchData } from "../../utils/db";
import { DndContext, DragOverlay, useDroppable, useDraggable, DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const DraggableAccount: React.FC<{ account: IAccount }> = ({ account }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: account.id.toString(),
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1, // Make original element transparent while dragging
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={styles.accountItem}
        >
            {account.name}
        </div>
    );
};

const DroppableContainer: React.FC<{ id: string; title: string }> = ({ id, title, children }) => {
    const { isOver, setNodeRef } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`${styles.card} ${isOver ? styles.dragOver : ""}`}
        >
            <div className={styles.cardHeader}>{title}</div>
            <div className={styles.cardBody}>{children}</div>
        </div>
    );
};

const Unknown: React.FC = () => {
    type AccountType =
        | "Income"
        | "Bill"
        | "Household"
        | "Credit Card"
        | "Loan"
        | "Other"
        | "Unknown";
    const accountTypes: AccountType[] = [
        "Income",
        "Bill",
        "Household",
        "Credit Card",
        "Loan",
        "Other",
        "Unknown",
    ];

    const [accounts, setAccounts] = useState<IAccount[]>([]);
    const [accountTypesWithAccounts, setAccountTypesWithAccounts] = useState<
        Record<string, IAccount[]>>({});
    const [activeAccount, setActiveAccount] = useState<IAccount | null>(null);

    useEffect(() => {
        const initialAccountTypes = accountTypes.reduce<Record<string, IAccount[]>>(
            (acc, type) => ({ ...acc, [type]: [] }),
            {}
        );

        fetchData<IAccount[]>(
            'SELECT * FROM accounts WHERE "type"="Unknown"'
        ).then((fetchedAccounts) => {
            setAccounts(fetchedAccounts);
            setAccountTypesWithAccounts(initialAccountTypes);
        });
    }, []);

    const onDragStart = (event: any) => {
        const draggedAccount = accounts.find(
            (account) => account.id.toString() === event.active.id
        );
        if (draggedAccount) {
            setActiveAccount(draggedAccount);
        }
    };

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over) {
            setActiveAccount(null);
            return; // No drop target
        }

        const accountId = active.id;
        const targetType = over.id;

        const draggedAccount = accounts.find(
            (account) => account.id.toString() === accountId
        );

        if (draggedAccount) {
            // Remove from original list
            setAccounts((prevAccounts) =>
                prevAccounts.filter((account) => account.id !== draggedAccount.id)
            );

            // Add to target type
            setAccountTypesWithAccounts((prev) => ({
                ...prev,
                [targetType]: [...prev[targetType], draggedAccount],
            }));
        }

        setActiveAccount(null); // Reset active account
    };

    return (
        <DndContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className={styles.container}>
                <div className={styles.leftCol}>
                    {accounts.length ? (
                        accounts.map((account) => (
                            <DraggableAccount key={account.id} account={account} />
                        ))
                    ) : (
                        <div className={styles.emptyState}>No accounts available</div>
                    )}
                </div>
                <div className={styles.rightCol}>
                    {accountTypes.map((type) => (
                        <DroppableContainer
                            key={type}
                            id={type}
                            title={type}
                        >
                            {accountTypesWithAccounts[type]?.length ? (
                                accountTypesWithAccounts[type].map((account) => (
                                    <div key={account.id} className={styles.accountItem}>
                                        {account.name}
                                    </div>
                                ))
                            ) : (
                                <div className={styles.emptyState}>Drop accounts here</div>
                            )}
                        </DroppableContainer>
                    ))}
                </div>
            </div>
            <DragOverlay>
                {activeAccount ? (
                    <div className={styles.accountItem}>{activeAccount.name}</div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default Unknown;