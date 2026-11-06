import React, { useState, useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import { useTitle } from '../context/TitleContext.jsx'
import { API_BASE_URL } from '../config.js'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [campaignToast, setCampaignToast] = useState(null)
  const { title } = useTitle()
  const location = useLocation()

  // Auto-close mobile drawer when user navigates to a new page
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const [countdownToast, setCountdownToast] = useState(null)

  useEffect(() => {
    let user={};try{user=JSON.parse(localStorage.getItem('wa_dashboard_user')||'{}')}catch{}
    const organizationId=user.organization_id||localStorage.getItem('org_id')
    if(!organizationId)return
    const socket=io(API_BASE_URL.replace(/\/api\/?$/,''),{transports:['websocket','polling'],reconnection:true})
    socket.on('connect',()=>socket.emit('join_organization',organizationId))
    socket.on('sending_history_updated',data=>{
      if(data?.type!=='campaign_completed')return
      const failed=Number(data.failedCount||0),sent=Number(data.sentCount||0),name=data.campaignName||`Campaign #${data.campaignId}`
      setCountdownToast(null)
      setCampaignToast({success:sent>0&&!data.error,title:sent>0?'Campaign sent successfully':'Campaign completed with errors',message:`${name} — ${sent} sent${failed?`, ${failed} failed`:''}`})
      setTimeout(()=>setCampaignToast(null),7000)
    })
    return()=>socket.disconnect()
  },[])

  useEffect(()=>{
    const handleCampaignStatus=event=>{
      const d=event.detail||{}
      if(d.status==='saved'){
        setCampaignToast({success:true,title:'Automation saved successfully',message:d.message||`${d.name||'Birthday automation'} saved successfully.`})
        setTimeout(()=>setCampaignToast(null),7000)
        return
      }
      if(d.status==='queued'){
        // Start interactive countdown: 2s -> 1s -> "Sending in progress..."
        setCountdownToast({
          name: d.name || 'Campaign',
          total: d.total || 0,
          secondsLeft: 2,
          phase: 'countdown'
        })
        return
      }
      setCampaignToast({success:d.status!=='error',title:d.status==='error'?'Campaign could not start':'Campaign sending is starting…',message:d.message||`${d.name||'Campaign'} — ${d.total||0} recipient(s)`})
      if(d.status!=='starting')setTimeout(()=>setCampaignToast(null),7000)
    }
    window.addEventListener('campaign-submit-status',handleCampaignStatus)
    return()=>window.removeEventListener('campaign-submit-status',handleCampaignStatus)
  },[])

  useEffect(()=>{
    if(!countdownToast || countdownToast.phase !== 'countdown') return
    if(countdownToast.secondsLeft > 1){
      const timer = setTimeout(()=>{
        setCountdownToast(prev => prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null)
      }, 1000)
      return () => clearTimeout(timer)
    } else if(countdownToast.secondsLeft === 1){
      const timer = setTimeout(()=>{
        setCountdownToast(prev => prev ? { ...prev, secondsLeft: 0, phase: 'sending' } : null)
      }, 1000)
      return () => clearTimeout(timer)
    } else if(countdownToast.phase === 'sending'){
      // Auto-dismiss the toast after 10 seconds if socket event wasn't caught
      const timer = setTimeout(()=>{
        setCountdownToast(null)
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [countdownToast])

  const handleToggle = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      setMobileOpen((prev) => !prev)
    } else {
      setCollapsed((c) => !c)
    }
  }, [])

  const handleExpand = useCallback(() => {
    setCollapsed(false)
  }, [])

  const closeMobileSidebar = useCallback(() => {
    setMobileOpen(false)
  }, [])

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onExpand={handleExpand}
        onToggleMobile={() => setMobileOpen(prev => !prev)}
      />
      {mobileOpen && <div className="mobile-overlay mobile-overlay--visible" onClick={closeMobileSidebar} />}
      <div className={`main-area ${collapsed ? 'main-area--collapsed' : ''}`}>
        {countdownToast && (
          <div style={{
            position:'fixed',top:20,right:20,zIndex:10000,minWidth:340,maxWidth:480,
            padding:'16px 20px',borderRadius:14,
            background: countdownToast.phase === 'sending' ? '#f0fdf4' : '#eff6ff',
            border:`1px solid ${countdownToast.phase === 'sending' ? '#86efac' : '#93c5fd'}`,
            color: countdownToast.phase === 'sending' ? '#166534' : '#1e40af',
            boxShadow:'0 16px 40px rgba(15,23,42,.22)',display:'flex',gap:14,alignItems:'center'
          }}>
            <div style={{
              width:40,height:40,borderRadius:'50%',
              background: countdownToast.phase === 'sending' ? '#16a34a' : '#2563eb',
              color:'#fff',fontWeight:'bold',fontSize: countdownToast.phase === 'sending' ? 18 : 16,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0
            }}>
              {countdownToast.phase === 'sending' ? '⚡' : `${countdownToast.secondsLeft}s`}
            </div>
            <div style={{flex:1}}>
              <strong style={{display:'block',fontSize:15,marginBottom:2}}>
                {countdownToast.phase === 'sending'
                  ? 'Campaign in progress…'
                  : `Sending will start in ${countdownToast.secondsLeft} second${countdownToast.secondsLeft === 1 ? '' : 's'}`}
              </strong>
              <span style={{fontSize:13,opacity:0.9}}>
                {countdownToast.name} — {countdownToast.total} recipient(s).
                {countdownToast.phase === 'sending' ? ' Sending live to Meta WhatsApp…' : ' Preparing high-speed dispatch…'}
              </span>
            </div>
            <button onClick={()=>setCountdownToast(null)} style={{border:0,background:'transparent',fontSize:20,cursor:'pointer',color:'inherit',padding:'0 4px'}}>×</button>
          </div>
        )}
        {campaignToast&&<div style={{position:'fixed',top:20,right:20,zIndex:10000,minWidth:320,maxWidth:460,padding:'14px 16px',borderRadius:12,background:campaignToast.success?'#ecfdf5':'#fff7ed',border:`1px solid ${campaignToast.success?'#86efac':'#fdba74'}`,color:campaignToast.success?'#166534':'#9a3412',boxShadow:'0 12px 30px rgba(15,23,42,.18)',display:'flex',gap:12,alignItems:'flex-start'}}><span style={{fontSize:20}}>{campaignToast.success?'✓':'⚠'}</span><div style={{flex:1}}><strong style={{display:'block',marginBottom:3}}>{campaignToast.title}</strong><span>{campaignToast.message}</span></div><button onClick={()=>setCampaignToast(null)} style={{border:0,background:'transparent',fontSize:20,cursor:'pointer',color:'inherit'}}>×</button></div>}
        <Topbar title={title} onToggleSidebar={handleToggle} />
        <main className="main-content-scrollable">
          {children}
        </main>
      </div>
    </div>
  )
}
