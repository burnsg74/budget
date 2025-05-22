import React, {useEffect, useState} from "react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { EventSourceInput } from '@fullcalendar/core';
import { fetchData } from '../../utils/db';
import styles from "./styles.module.css";

interface Event {
    id: string;
    allDay?: boolean;
    title: string;
    start: string;
    end?: string;
}

interface LedgerEntry {
    id: number;
    account_name: string;
    date: string;
    amount: number;
    memo: string;
}

const Calendar: React.FC = () => {
    const [events, setEvents] = useState<EventSourceInput>([]);

    useEffect(() => {
        const fetchLedgerEvents = async () => {
            try {
                const query = `
                    SELECT 
                        l.id,
                        a.name as account_name,
                        l.date,
                        l.amount,
                        l.memo
                    FROM ledger l
                    JOIN accounts a ON l.account_id = a.id
                    ORDER BY l.date
                `;
                
                const ledgerEntries: LedgerEntry[] = await fetchData(query);
                
                const calendarEvents = ledgerEntries.map(entry => ({
                    id: entry.id.toString(),
                    title: `${entry.account_name}: ${entry.amount.toFixed(2)} - ${entry.memo || 'No memo'}`,
                    start: entry.date,
                    allDay: true
                }));
                
                setEvents(calendarEvents);
            } catch (error) {
                console.error('Error fetching ledger events:', error);
            }
        };

        fetchLedgerEvents();
    }, []);

    return (
        <div className={styles.container}>
                <FullCalendar
                    plugins={[
                        dayGridPlugin,
                        timeGridPlugin,
                        listPlugin,
                        interactionPlugin
                    ]}
                    initialView="dayGridMonth"
                    height="90vh"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,dayGridWeek,dayGridDay,dayGridYear'
                    }}
                    events={events}
                />
        </div>
    );
};

export default Calendar;