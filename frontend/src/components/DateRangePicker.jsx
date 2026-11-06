import React, { useState, useEffect, useRef } from 'react'
import './DateRangePicker.css'

export default function DateRangePicker({ value, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectingStart, setSelectingStart] = useState(true)
    const [tempStartDate, setTempStartDate] = useState(null)
    const [tempEndDate, setTempEndDate] = useState(null)
    const pickerRef = useRef(null)

    // Parse existing value string or set default
    useEffect(() => {
        if (!value || value === 'All Time') {
            setTempStartDate(null)
            setTempEndDate(null)
            return
        }
        if (value.includes(' - ')) {
            const [startStr, endStr] = value.split(' - ')
            const sDate = new Date(startStr)
            const eDate = new Date(endStr)
            if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
                setTempStartDate(sDate)
                setTempEndDate(eDate)
                setCurrentMonth(sDate)
            }
        } else {
            const singleDate = new Date(value)
            if (!isNaN(singleDate.getTime())) {
                setTempStartDate(singleDate)
                setTempEndDate(singleDate)
                setCurrentMonth(singleDate)
            }
        }
    }, [value])

    // Close picker when clicking outside
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

    const formatDateStr = (date) => {
        if (!date) return ''
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
    }

    const formatDisplayDate = (date) => {
        if (!date) return ''
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const handleDateClick = (day) => {
        const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)

        if (selectingStart || !tempStartDate || (tempStartDate && tempEndDate && tempStartDate.getTime() !== tempEndDate.getTime())) {
            setTempStartDate(clickedDate)
            setTempEndDate(clickedDate)
            setSelectingStart(false)

            const formatted = formatDisplayDate(clickedDate)
            onChange(formatted)
        } else {
            let start = tempStartDate
            let end = clickedDate
            if (clickedDate < tempStartDate) {
                start = clickedDate
                end = tempStartDate
            }
            setTempStartDate(start)
            setTempEndDate(end)
            setSelectingStart(true)

            const formattedRange = isSameDay(start, end)
                ? `${formatDisplayDate(start)}`
                : `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`
            onChange(formattedRange)
            setIsOpen(false)
        }
    }

    const applyPreset = (presetKey) => {
        const now = new Date()
        let start = new Date()
        let end = new Date()

        if (presetKey === 'Today') {
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        } else if (presetKey === 'Yesterday') {
            start.setDate(now.getDate() - 1)
            start.setHours(0, 0, 0, 0)
            end.setDate(now.getDate() - 1)
            end.setHours(23, 59, 59, 999)
        } else if (presetKey === 'Last 7 Days') {
            start.setDate(now.getDate() - 6)
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        } else if (presetKey === 'Last 30 Days') {
            start.setDate(now.getDate() - 29)
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
        } else if (presetKey === 'This Month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        } else if (presetKey === 'All Time') {
            setTempStartDate(null)
            setTempEndDate(null)
            onChange('All Time')
            setIsOpen(false)
            return
        }

        setTempStartDate(start)
        setTempEndDate(end)
        setCurrentMonth(start)
        const formattedRange = `${formatDisplayDate(start)} - ${formatDisplayDate(end)}`
        onChange(formattedRange)
        setIsOpen(false)
    }

    const changeMonth = (offset) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1))
    }

    const getDaysInMonth = (date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0)
        return {
            daysInMonth: lastDay.getDate(),
            startingDayOfWeek: firstDay.getDay(),
            year,
            month
        }
    }

    const isSameDay = (d1, d2) => {
        if (!d1 || !d2) return false
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate()
    }

    const isInRange = (date, start, end) => {
        if (!start || !end) return false
        const t = date.getTime()
        const s = new Date(start).setHours(0, 0, 0, 0)
        const e = new Date(end).setHours(23, 59, 59, 999)
        return t > s && t < e
    }

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

    const renderCalendarDays = () => {
        const days = []
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
        }
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
                title="Click to select custom date range or quick preset"
            >
                <input
                    type="text"
                    className="date-range-input"
                    value={value || 'All Time'}
                    readOnly
                />
                <span className="date-range-icon">📅</span>
            </div>

            {isOpen && (
                <div className="date-range-calendar">
                    {/* Preset Buttons Bar */}
                    <div className="calendar-presets">
                        <button type="button" onClick={() => applyPreset('Today')}>Today</button>
                        <button type="button" onClick={() => applyPreset('Yesterday')}>Yesterday</button>
                        <button type="button" onClick={() => applyPreset('Last 7 Days')}>Last 7 Days</button>
                        <button type="button" onClick={() => applyPreset('Last 30 Days')}>Last 30 Days</button>
                        <button type="button" onClick={() => applyPreset('This Month')}>This Month</button>
                        <button type="button" onClick={() => applyPreset('All Time')}>All Time</button>
                    </div>

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
                        {dayNames.map(d => (
                            <div key={d} className="calendar-day-name">{d}</div>
                        ))}
                    </div>

                    <div className="calendar-days">
                        {renderCalendarDays()}
                    </div>

                    <div className="calendar-footer">
                        <span className="calendar-hint">
                            {tempStartDate && !tempEndDate ? 'Select End Date' : 'Click start date, then end date'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    )
}