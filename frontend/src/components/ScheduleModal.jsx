import React, { useState, useEffect } from 'react'

export default function ScheduleModal({ isOpen, onClose, onConfirm, numbersCount }) {
    if (!isOpen) return null

    const getDefaultDateTime = () => {
        const d = new Date(Date.now() + 60 * 60 * 1000)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const hours = String(d.getHours()).padStart(2, '0')
        const minutes = String(d.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    const getMinDateTime = () => {
        const d = new Date()
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const hours = String(d.getHours()).padStart(2, '0')
        const minutes = String(d.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    const [scheduledDateTime, setScheduledDateTime] = useState(getDefaultDateTime())
    const [timeRemainingText, setTimeRemainingText] = useState('')
    const [isValid, setIsValid] = useState(true)

    useEffect(() => {
        if (!scheduledDateTime) {
            setTimeRemainingText('')
            setIsValid(false)
            return
        }

        const selDate = new Date(scheduledDateTime)
        const diffMs = selDate.getTime() - Date.now()
        if (isNaN(selDate.getTime()) || diffMs <= 0) {
            setTimeRemainingText('Please select a future date and time.')
            setIsValid(false)
            return
        }

        setIsValid(true)
        const totalSecs = Math.floor(diffMs / 1000)
        const hrs = Math.floor(totalSecs / 3600)
        const mins = Math.floor((totalSecs % 3600) / 60)
        const secs = totalSecs % 60

        let timeStr = ''
        if (hrs > 0) timeStr += `${hrs} hr `
        if (mins > 0 || hrs > 0) timeStr += `${mins} min `
        timeStr += `${secs} sec`

        setTimeRemainingText(`Messages will be sent in approx. ${timeStr}`)
    }, [scheduledDateTime])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!isValid) return
        onConfirm(scheduledDateTime)
    }

    return (
        <div className="preview-modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
            <div className="preview-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📅 Schedule Campaign Date &amp; Time
                    </h2>
                    <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <p style={{ fontSize: '13px', color: '#4b5563', margin: '0 0 16px 0' }}>
                        Set a date and time to automatically dispatch messages to <strong>{numbersCount} phone number(s)</strong>.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#374151' }}>
                            Select Date &amp; Time:
                        </label>
                        <input
                            type="datetime-local"
                            value={scheduledDateTime}
                            onChange={e => setScheduledDateTime(e.target.value)}
                            min={getMinDateTime()}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                            required
                        />
                    </div>

                    {timeRemainingText && (
                        <div style={{
                            padding: '10px 12px',
                            backgroundColor: isValid ? '#ecfdf5' : '#fee2e2',
                            color: isValid ? '#047857' : '#b91c1c',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '500',
                            marginBottom: '16px'
                        }}>
                            {isValid ? '⏳ ' : '⚠️ '}{timeRemainingText}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid}
                            style={{
                                padding: '8px 20px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: isValid ? '#4f46e5' : '#9ca3af',
                                color: '#fff',
                                fontWeight: '600',
                                cursor: isValid ? 'pointer' : 'not-allowed'
                            }}
                        >
                            Save Schedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
