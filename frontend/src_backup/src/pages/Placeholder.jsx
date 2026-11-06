import React from 'react'
import Layout from '../components/Layout.jsx'

export default function Placeholder({ title }) {
  return (
    <Layout title={title}>
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
    </Layout>
  )
}
