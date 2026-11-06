import React, { useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'

export default function Placeholder({ title }) {
  const { setTitle } = useTitle()

  useEffect(() => {
    setTitle(title)
  }, [setTitle, title])

  return (
    <div className="dashboard-content">
      <div className="chart-card">
        <div className="chart-card-head">
          <h3>{title}</h3>
        </div>
        <div className="chart-card-body" style={{ padding: '60px 22px', textAlign: 'center', color: '#9296ab' }}>
          The {title} section is not part of this build yet. Wire it up to your API when ready.
        </div>
      </div>
    </div>
  )
}