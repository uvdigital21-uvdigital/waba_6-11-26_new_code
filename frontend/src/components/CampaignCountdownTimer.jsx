import React, { useState, useEffect } from 'react'

export default function CampaignCountdownTimer({ scheduledAt, onExpire }) {
    const [timeLeft, setTimeLeft] = useState('')
    const [isDue, setIsDue] = useState(false)

    useEffect(() => {
        const updateTimer = () => {
            const targetTime = new Date(scheduledAt).getTime()
            const now = Date.now()
            const diff = targetTime - now

            if (diff <= 0) {
                setTimeLeft('Executing now...')
                setIsDue(true)
                if (onExpire) onExpire()
                return
            }

            const hrs = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0')
            const mins = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0')
            const secs = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0')
            setTimeLeft(`${hrs}:${mins}:${secs}`)
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [scheduledAt, onExpire])

    return (
        <span style={{ fontWeight: 'bold', color: isDue ? '#d97706' : '#2563eb', fontFamily: 'monospace', fontSize: '13px' }}>
            {isDue ? '⚡ Executing...' : `⏱️ ${timeLeft}`}
        </span>
    )
}
