import React, {useEffect, useState} from "react"
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'


interface Event {
    id: string;
    allDay?: boolean;
    title: string;
    start: string;
    end?: string;
}

const CalendarPage: React.FC = () => {

    const fetchEvents = async (): Promise<Event[]> => {
        const query = `SELECT ID as id, ToAccountName as title, Date as start, Date as end FROM Ledger;`;
        try {
            const response = await fetch("/api/db", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
            });
            const data = await response.json();
            return data.map((event: Event) => ({
                id: event.id,
                title: event.title,
                start: event.start,
            }));
        } catch (error) {
            console.error("Error fetching events:", error);
            return [];
        }
    };

    const [events, setEvents] = useState<Event[]>([]);

    useEffect(() => {
        const getEvents = async () => {
            const events = await fetchEvents();
            setEvents(events);
        };

        getEvents();
    }, []);
    return (
        <div className="container mx-auto px-4">
            <main className="mt-8">
                <FullCalendar
                    plugins={[dayGridPlugin]}
                    initialView="dayGridMonth"
                    height="90vh"
                    events={events}
                />
            </main>
        </div>
    )
}

export default CalendarPage
