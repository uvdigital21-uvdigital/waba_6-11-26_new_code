import React, { useState, useEffect, useRef } from 'react'

export default function DateRangePicker({ value, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectingStart, setSelectingStart] = useState(true)
    const [tempStartDate, setTempStartDate] = useState(null)
    const [tempEndDate, setTempEndDate] = useState(null)
    const pickerRef = useRef(null)

    // Parse existing value
    useEffect(() => {
        if (value && value.includes(' - ')) {
            const [start, end] = value.split(' - ')
            const startDate = new Date(start)
            const endDate = new Date(end)
            if (!isNaN(startDate) && !isNaN(endDate)) {
                setTempStartDate(startDate)
                setTempEndDate(endDate)
                setCurrentMonth(startDate)
            }
        }
    }, [value])

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const getDaysInMonth = (date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        const daysInMonth = lastDay.getDate()
        const startingDayOfWeek = firstDay.getDay()

        return { daysInMonth, startingDayOfWeek, year, month }
    }

    const formatDate = (date) => {
        if (!date) return ''
        const options = { year: 'numeric', month: 'long', day: 'numeric' }
        return date.toLocaleDateString('en-US', options)
    }

    const isSameDay = (date1, date2) => {
        if (!date1 || !date2) return false
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate()
    }

    const isInRange = (date, start, end) => {
        if (!start || !end) return false
        const time = date.getTime()
        return time > start.getTime() && time < end.getTime()
    }

    const handleDateClick = (day) => {
        const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)

        if (selectingStart || !tempStartDate) {
            setTempStartDate(clickedDate)
            setTempEndDate(null)
            setSelectingStart(false)
        } else {
            if (clickedDate < tempStartDate) {
                setTempEndDate(tempStartDate)
                setTempStartDate(clickedDate)
            } else {
                setTempEndDate(clickedDate)
            }
            setSelectingStart(true)

            // Emit the selected range
            const formattedValue = `${formatDate(tempStartDate)} - ${formatDate(clickedDate)}`
            onChange(formattedValue)
            setIsOpen(false)
        }
    }

    const changeMonth = (offset) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1))
    }

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    const renderCalendarDays = () => {
        const days = []

        // Empty cells for days before the first day of month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day)
            const isStart = isSameDay(date, tempStartDate)
            const isEnd = isSameDay(date, tempEndDate)
            const inRange = isInRange(date, tempStartDate, tempEndDate)
            const isToday = isSameDay(date, new Date())

            let className = 'calendar-day'
            if (isStart || isEnd) className += ' selected'
            else if (inRange) className += ' in-range'
            if (isToday) className += ' today'

            days.push(
                <div
                    key={day}
                    className={className}
                    onClick={() => handleDateClick(day)}
                >
                    {day}
                </div>
            )
        }

        return days
    }

    return (
        <div className="date-range-picker-wrapper" ref={pickerRef}>
            <div
                className="date-range-input-wrapper"
                onClick={() => setIsOpen(!isOpen)}
            >
                <input
                    type="text"
                    className="date-range-input"
                    placeholder="July 4, 2011 - July 4, 2026"
                    value={value}
                    readOnly
                />
                <span className="date-range-icon">📅</span>
            </div>

            {isOpen && (
                <div className="date-range-calendar">
                    <div className="calendar-header">
                        <button
                            type="button"
                            className="calendar-nav-btn"
                            onClick={() => changeMonth(-1)}
                        >
                            ‹
                        </button>
                        <span className="calendar-month-year">
                            {monthNames[month]} {year}
                        </span>
                        <button
                            type="button"
                            className="calendar-nav-btn"
                            onClick={() => changeMonth(1)}
                        >
                            ›
                        </button>
                    </div>

                    <div className="calendar-day-names">
                        {dayNames.map(day => (
                            <div key={day} className="calendar-day-name">{day}</div>
                        ))}
                    </div>

                    <div className="calendar-days">
                        {renderCalendarDays()}
                    </div>

                    <div className="calendar-footer">
                        <span className="calendar-hint">
                            {selectingStart ? 'Select start date' : 'Select end date'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}