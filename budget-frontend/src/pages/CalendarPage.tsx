import React from "react"
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'

const CalendarPage: React.FC = () => {
    return (
        <div className="container mx-auto px-4">
            <main className="mt-8">
                <FullCalendar
                    plugins={[dayGridPlugin]}
                    initialView="dayGridMonth"
                    height="90vh"
                />
            </main>
        </div>
    )
}

export default CalendarPage
