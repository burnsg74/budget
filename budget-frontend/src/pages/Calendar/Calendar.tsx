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

const Calendar: React.FC = () => {

    const [events, setEvents] = useState<Event[]>([]);

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

export default Calendar
