import React, {useEffect, useState} from "react";
import styles from "./Unknown.module.css";
import {IAccount} from "../../types";
import {fetchData} from "../../utils/db";

const Unknown: React.FC = () => {
    const [accounts, setAccounts] = useState<IAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<IAccount | null>(null);

    useEffect(() => {
        fetchData<IAccount[]>('SELECT * FROM accounts WHERE "type"="Unknown"').then(fetchedAccounts => {
            setAccounts(fetchedAccounts);
            if (fetchedAccounts.length > 0) {
                setSelectedAccount(fetchedAccounts[0]);
            }
        });
    }, []);


    return (
        <div className={styles.container}>
            <div className={styles.leftCol}>

                {accounts.map((account) => (
                    <div key={account.id}>
                        {account.name}
                    </div>
                ))}
            </div>
            <div className={styles.rightCol}>
                Right
            </div>
        </div>
    )
}

export default Unknown;