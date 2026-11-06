import React, { useState, useEffect } from 'react'
import api from '../services/api.js'
import MediaHeaderUpload, { isTemplateMediaHeader } from './MediaHeaderUpload.jsx'
import TemplateVariablesInput from './TemplateVariablesInput.jsx'
import { ALL_COUNTRIES } from '../constants/metaConstants.js'

export default function BirthdayCampaignModal({ isOpen, onClose, onSave, editingCampaign }) {
    // Template state
    const [templates, setTemplates] = useState([])
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
    const [variables, setVariables] = useState([])
    const [variableValues, setVariableValues] = useState({})
    const [activeAccountId, setActiveAccountId] = useState(null)
    const [senderNumbers, setSenderNumbers] = useState([])

    // Single Details Form State
    const [singleForm, setSingleForm] = useState({
        name: '',
        dob: '',
        wishTime: '10:00',
        country: 'India(+91)',
        mobileNumbers: '',
        template: '',
        notes: ''
    })

    useEffect(() => {
        if (isOpen) {
            fetchMetaTemplates()
            if (editingCampaign) {
                setSingleForm({
                    name: editingCampaign.name || '',
                    dob: editingCampaign.dob || '',
                    wishTime: editingCampaign.wishTime || '10:00',
                    country: editingCampaign.country || 'India(+91)',
                    mobileNumbers: editingCampaign.mobile || '',
                    template: editingCampaign.template || '',
                    notes: editingCampaign.notes || ''
                })
                if (editingCampaign.variables) {
                    setVariableValues(editingCampaign.variables)
                }
            } else {
                resetForm()
            }
        }
    }, [isOpen, editingCampaign])

    const fetchMetaTemplates = async () => {
        setIsLoadingTemplates(true)
        try {
            const searchParams = new URLSearchParams(window.location.search)
            const activeId = searchParams.get('account_id') || localStorage.getItem('active_wa_account_id') || ''
            const url = activeId ? `/meta-templates?account_id=${activeId}` : '/meta-templates'

            const response = await api.get(url)
            const list = Array.isArray(response.data) ? response.data : (response.data?.data || [])
            const approvedList = list.filter(t => !t.status || String(t.status).toUpperCase() === 'APPROVED')
            setTemplates(approvedList)

            // Fetch all connected numbers for dropdown
            try {
                const numRes = await api.get('/numbers?limit=100')
                const nums = numRes.data?.data || numRes.data?.numbers || numRes.data?.whatsapp_accounts || []
                setSenderNumbers(nums)
                if (nums.length > 0 && !activeId) {
                    setActiveAccountId(String(nums[0].id))
                    localStorage.setItem('active_wa_account_id', String(nums[0].id))
                } else if (activeId) {
                    setActiveAccountId(activeId)
                }
            } catch (_) { }
        } catch (err) {
            console.error('Failed to load meta templates:', err)
        } finally {
            setIsLoadingTemplates(false)
        }
    }

    const handleSenderNumberChange = (e) => {
        const newId = e.target.value
        setActiveAccountId(newId)
        localStorage.setItem('active_wa_account_id', newId)
        
        const url = `/meta-templates?account_id=${newId}`
        setIsLoadingTemplates(true)
        api.get(url).then(response => {
            const list = Array.isArray(response.data) ? response.data : (response.data?.data || [])
            const approvedList = list.filter(t => !t.status || String(t.status).toUpperCase() === 'APPROVED')
            setTemplates(approvedList)
        }).catch(err => {
            setTemplates([])
        }).finally(() => {
            setIsLoadingTemplates(false)
        })
    }

    const handleSingleChange = (field, value) => {
        if (field === 'template') {
            const tObj = templates.find(t => (t.name || t.id || t) === value)
            const bodyComp = tObj?.components?.find(c => (c.type || '').toUpperCase() === 'BODY')
            const bodyText = bodyComp?.text || tObj?.text || ''
            const bodyMatches = bodyText.match(/\{\{(\d+)\}\}/g) || []
            const varNums = [...new Set(bodyMatches.map(m => m.replace(/\D/g, '')))].sort((a, b) => Number(a) - Number(b))
            const initialVals = {}
            varNums.forEach(v => { initialVals[v] = variableValues[v] || '' })
            setVariables(varNums)
            setVariableValues(initialVals)

            if (value) {
                api.get(`/meta-templates/${encodeURIComponent(value)}`)
                    .then(res => {
                        if (res.data) {
                            setTemplates(prev => prev.map(t => {
                                if ((t.name || t.id || t) === value) {
                                    return {
                                        ...t,
                                        ...res.data,
                                        header_media_url: res.data.header_media_url || t.header_media_url,
                                        components: res.data.components || t.components
                                    }
                                }
                                return t
                            }))
                        }
                    })
                    .catch(() => {})
            }
        }
        setSingleForm(prev => ({ ...prev, [field]: value }))
    }

    const handleVariableChange = (varNum, val) => {
        setVariableValues(prev => ({
            ...prev,
            [varNum]: val
        }))
    }

    const handleSingleSave = async (e) => {
        e.preventDefault()
        if (!singleForm.name || !singleForm.dob || !singleForm.mobileNumbers || !singleForm.template) {
            alert('Please fill all required fields.')
            return
        }

        const campaignName = singleForm.name.trim()
        window.dispatchEvent(new CustomEvent('campaign-submit-status', {
            detail: { status: 'starting', name: campaignName, message: `Birthday automation "${campaignName}" is being saved.` }
        }))

        try {
            let res
            const dataToSave = {
                ...singleForm,
                accountId: activeAccountId || undefined
            }
            if (editingCampaign && editingCampaign.id) {
                // UPDATE
                res = await api.put(`/birthday-campaigns/${editingCampaign.id}`, dataToSave, { silent: true })
            } else {
                // CREATE
                res = await api.post('/birthday-campaigns', {
                    type: 'single',
                    data: dataToSave
                }, { silent: true })
            }

            if (res.data && res.data.success) {
                window.dispatchEvent(new CustomEvent('campaign-submit-status', {
                    detail: { status: 'saved', name: campaignName, message: `Birthday automation "${campaignName}" saved successfully. It will run automatically at the selected date and time.` }
                }))
                if (onSave) onSave()
                resetForm()
                onClose()
            }
        } catch (err) {
            console.error('Failed to save birthday campaign:', err)
            const message = err.response?.data?.message || err.message || 'Failed to save birthday campaign.'
            window.dispatchEvent(new CustomEvent('campaign-submit-status', {
                detail: { status: 'error', name: campaignName, message }
            }))
        }
    }

    const resetForm = () => {
        setSingleForm({
            name: '',
            dob: '',
            wishTime: '10:00',
            country: 'India(+91)',
            mobileNumbers: '',
            template: '',
            notes: ''
        })
    }

    const handleDiscard = () => {
        resetForm()
        onClose()
    }

    if (!isOpen) return null

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                width: '650px',
                maxWidth: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                padding: '24px'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                        {editingCampaign ? 'Edit Birthday Campaign' : 'Add Birthday Campaign'}
                    </h2>
                    <button
                        onClick={handleDiscard}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#6b7280' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSingleSave}>
                    {senderNumbers.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Sender Number</label>
                            <select
                                className="form-select"
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                value={activeAccountId || ''}
                                onChange={handleSenderNumberChange}
                            >
                                {senderNumbers.map((n) => (
                                    <option key={n.id} value={n.id}>
                                        {n.wa_number || n.number} ({n.name || n.verified_name || 'No Name'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Name *</label>
                            <input
                                type="text"
                                placeholder="Enter Name"
                                value={singleForm.name}
                                onChange={(e) => handleSingleChange('name', e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Date of Birth *</label>
                            <input
                                type="date"
                                value={singleForm.dob}
                                onChange={(e) => handleSingleChange('dob', e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Wish Time *</label>
                            <input
                                type="time"
                                value={singleForm.wishTime}
                                onChange={(e) => handleSingleChange('wishTime', e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Country Code</label>
                            <select
                                value={singleForm.country}
                                onChange={(e) => handleSingleChange('country', e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                            >
                                {ALL_COUNTRIES.map((c) => (
                                    <option key={c.label} value={c.label}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Mobile Numbers *</label>
                        <input
                            type="text"
                            placeholder="Enter mobile number(s)"
                            value={singleForm.mobileNumbers}
                            onChange={(e) => handleSingleChange('mobileNumbers', e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Select Official Template *</label>
                        <select
                            value={singleForm.template}
                            onChange={(e) => handleSingleChange('template', e.target.value)}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
                            required
                        >
                            <option value="">{isLoadingTemplates ? 'Loading templates...' : 'Select Official Template'}</option>
                            {templates.map((t, idx) => {
                                const name = typeof t === 'string' ? t : (t.name || t.id)
                                const lang = typeof t === 'object' && t.language ? ` (${t.language})` : ''
                                const cat = typeof t === 'object' && t.category ? ` - ${t.category}` : ''
                                return (
                                    <option key={idx} value={name}>
                                        {name}{lang}{cat}
                                    </option>
                                )
                            })}
                        </select>
                    </div>

                    {/* Media Preview if template has media header */}
                    {(() => {
                        const selectedT = templates.find(t => (t.name || t.id || t) === singleForm.template)
                        return isTemplateMediaHeader(selectedT) ? (
                            <div style={{ marginBottom: '16px' }}>
                                <MediaHeaderUpload templateData={selectedT} />
                            </div>
                        ) : null
                    })()}

                    {/* Dynamic Variable Inputs with History & Auto-Suggestion */}
                    <TemplateVariablesInput
                        variables={variables}
                        variableValues={variableValues}
                        onVariableChange={handleVariableChange}
                    />

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>Notes (optional)</label>
                        <textarea
                            value={singleForm.notes}
                            onChange={(e) => handleSingleChange('notes', e.target.value)}
                            placeholder="Enter notes..."
                            rows={3}
                            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button type="button" onClick={handleDiscard} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#fff', cursor: 'pointer' }}>
                            Discard
                        </button>
                        <button type="submit" style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#4f46e5', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                            {editingCampaign ? 'Update Details' : 'Save Details'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
