import React, { useState, useEffect, useMemo } from 'react'
import api from '../services/api.js'
import { useTitle } from '../context/TitleContext.jsx'
import CreateGroupModal from '../components/CreateGroupModal.jsx'
import PhonePreview from '../components/PhonePreview.jsx'
import ScheduleModal from '../components/ScheduleModal.jsx'
import CampaignCountdownTimer from '../components/CampaignCountdownTimer.jsx'
import WhatsAppMobilePreview from '../components/WhatsAppMobilePreview.jsx'
import MediaHeaderUpload, { isTemplateMediaHeader } from '../components/MediaHeaderUpload.jsx'
import CreditsBadge from '../components/CreditsBadge.jsx'
import TemplateVariablesInput from '../components/TemplateVariablesInput.jsx'
import { ALL_COUNTRIES } from '../constants/metaConstants.js'
import './Campaigns.css'

export default function SendByGroup() {
    const { setTitle } = useTitle()

    const [formData, setFormData] = useState({
        template: '',
        messageText: '',
        group: '',
        country: 'India(+91)'
    })

    const [templates, setTemplates] = useState([])
    const [templatesError, setTemplatesError] = useState(null)
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
    const [selectedTemplateData, setSelectedTemplateData] = useState(null)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [activeAccountId, setActiveAccountId] = useState(null)
    const [senderNumbers, setSenderNumbers] = useState([])

    const [variables, setVariables] = useState([])
    const [variableValues, setVariableValues] = useState({})
    const [selectedMediaUrl, setSelectedMediaUrl] = useState(null)
    const [selectedMediaFile, setSelectedMediaFile] = useState(null)
    const [selectedMediaBase64, setSelectedMediaBase64] = useState(null)
    const [selectedCarouselMedia, setSelectedCarouselMedia] = useState(null)

    const [groups, setGroups] = useState([])
    const [isLoadingGroups, setIsLoadingGroups] = useState(true)
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
    const [groupSuccessMsg, setGroupSuccessMsg] = useState(null)

    // Group Contacts Pagination & Search State
    const [contactSearchQuery, setContactSearchQuery] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [contactsPerPage, setContactsPerPage] = useState(10)
    const [copiedIndex, setCopiedIndex] = useState(null)

    const [isSending, setIsSending] = useState(false)
    const [sendResult, setSendResult] = useState(null)
    const [sendError, setSendError] = useState(null)

    // Schedule state
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [scheduledCampaigns, setScheduledCampaigns] = useState([])
    const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState(null)
    const [isScheduling, setIsScheduling] = useState(false)

    const [creditsData, setCreditsData] = useState(null)
    const [isLoadingCredits, setIsLoadingCredits] = useState(true)

    const fetchCredits = async () => {
        try {
            setIsLoadingCredits(true)
            const res = await api.get('/credits/balance')
            if (res.data?.success) {
                setCreditsData(res.data)
            }
        } catch (_) {
        } finally {
            setIsLoadingCredits(false)
        }
    }

    useEffect(() => {
        setTitle('Send By Group')
        fetchMetaTemplates()
        fetchGroups()
        fetchScheduledCampaigns()
        fetchCredits()
    }, [setTitle])

    const fetchScheduledCampaigns = async () => {
        try {
            const response = await api.get('/campaign/scheduled?type=group', { silent: true })
            if (response.data && Array.isArray(response.data.data)) {
                const groupList = response.data.data.filter(sc =>
                    !sc.campaign_name || sc.campaign_name.toLowerCase().startsWith('group')
                )
                setScheduledCampaigns(groupList)
            }
        } catch (err) {
            console.error('Failed to load scheduled campaigns:', err)
        }
    }

    const fetchGroups = async () => {
        setIsLoadingGroups(true)
        try {
            const response = await api.get('/groups')
            if (response.data && Array.isArray(response.data.data)) {
                setGroups(response.data.data)
            }
        } catch (err) {
            console.error('Failed to load groups:', err)
        } finally {
            setIsLoadingGroups(false)
        }
    }

    const fetchMetaTemplates = async () => {
        setIsLoadingTemplates(true)
        setTemplatesError(null)
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
            console.error('Failed to load templates:', err)
            setTemplatesError(err.response?.data?.message || err.message)
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
            setTemplatesError(err.response?.data?.message || err.message)
            setTemplates([])
        }).finally(() => {
            setIsLoadingTemplates(false)
        })
    }

    const fetchTemplateDetails = async (templateName) => {
        setIsLoadingPreview(true)
        try {
            const response = await api.get(`/meta-templates/${encodeURIComponent(templateName)}`)
            const tData = response.data
            setSelectedTemplateData(tData)
            const bodyComp = tData?.components?.find(c => (c.type || '').toUpperCase() === 'BODY')
            const bodyText = bodyComp?.text || tData?.text || ''
            if (bodyText) {
                const bodyMatches = bodyText.match(/\{\{(\d+)\}\}/g) || []
                const varNums = [...new Set(bodyMatches.map(m => m.replace(/\D/g, '')))].sort((a, b) => Number(a) - Number(b))
                if (varNums.length > 0) {
                    setVariables(varNums)
                    setVariableValues(prev => {
                        const nextVals = { ...prev }
                        varNums.forEach(v => {
                            if (nextVals[v] === undefined) nextVals[v] = ''
                        })
                        return nextVals
                    })
                }
            }
        } catch (err) {
            console.error('Failed to load template details:', err)
            const fromList = templates.find(t => t.name === templateName)
            setSelectedTemplateData(fromList || null)
        } finally {
            setIsLoadingPreview(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target

        if (name === 'template') {
            const fromList = templates.find(t => t.name === value)
            const bodyComp = fromList?.components?.find(c => (c.type || '').toUpperCase() === 'BODY')
            const bodyText = bodyComp?.text || fromList?.text || ''

            const bodyMatches = bodyText.match(/\{\{(\d+)\}\}/g) || []
            const varNums = [...new Set(bodyMatches.map(m => m.replace(/\D/g, '')))].sort((a, b) => Number(a) - Number(b))

            const initialVals = {}
            varNums.forEach(v => {
                initialVals[v] = ''
            })

            setFormData(prev => ({ ...prev, [name]: value, messageText: bodyText }))
            setVariables(varNums)
            setVariableValues(initialVals)
            setSelectedMediaUrl(null)
            setSelectedMediaFile(null)
            setSelectedMediaBase64(null)
            setSelectedCarouselMedia(null)

            if (!value) {
                setSelectedTemplateData(null)
                return
            }
            if (fromList && fromList.components && fromList.components.length > 0) {
                setSelectedTemplateData(fromList)
                if (!fromList.header_media_url) {
                    api.get(`/meta-templates/${encodeURIComponent(value)}`)
                        .then(res => {
                            if (res.data?.header_media_url) {
                                setSelectedTemplateData(prev => ({
                                    ...prev,
                                    header_media_url: res.data.header_media_url
                                }))
                            }
                        }).catch(() => {})
                }
            } else {
                fetchTemplateDetails(value)
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
            if (name === 'group') {
                setCurrentPage(1)
                setContactSearchQuery('')
            }
        }
    }

    const handleVariableChange = (varNum, val) => {
        setVariableValues(prev => ({
            ...prev,
            [varNum]: val
        }))
    }

    const getPreviewMessageText = (text) => {
        if (!text) return ''
        let result = text
        variables.forEach(v => {
            const val = variableValues[v]
            if (val !== undefined && val !== '') {
                result = result.replaceAll(`{{${v}}}`, val)
            }
        })
        return result
    }

    const handleAddNewGroup = () => {
        setShowCreateGroupModal(true)
    }

    const handleGroupCreated = (newGroup) => {
        setShowCreateGroupModal(false)
        fetchGroups()
        setFormData(prev => ({ ...prev, group: newGroup.name }))
        setCurrentPage(1)
        setContactSearchQuery('')
        setGroupSuccessMsg(`Group "${newGroup.name}" created and saved to Database (${newGroup.totalContacts} contacts).`)
        setTimeout(() => setGroupSuccessMsg(null), 5000)
    }

    const selectedGroupObj = groups.find(g => g.name === formData.group)

    const groupContactsList = useMemo(() => {
        if (!selectedGroupObj || !Array.isArray(selectedGroupObj.numbers)) return []
        return selectedGroupObj.numbers.map((item, idx) => {
            if (typeof item === 'string') {
                return {
                    id: idx + 1,
                    phone: item,
                    name: ''
                }
            }
            return {
                id: item.id || idx + 1,
                phone: item.phone || item.number || item.phoneNumber || '',
                name: item.name || item.contactName || ''
            }
        }).filter(c => !!c.phone)
    }, [selectedGroupObj])

    const filteredContacts = useMemo(() => {
        if (!contactSearchQuery.trim()) return groupContactsList
        const q = contactSearchQuery.trim().toLowerCase()
        return groupContactsList.filter(c => 
            (c.phone && c.phone.toLowerCase().includes(q)) || 
            (c.name && c.name.toLowerCase().includes(q))
        )
    }, [groupContactsList, contactSearchQuery])

    const totalContactsCount = filteredContacts.length
    const totalPages = Math.max(1, Math.ceil(totalContactsCount / contactsPerPage))
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
    const startIndex = (safeCurrentPage - 1) * contactsPerPage
    const endIndex = Math.min(startIndex + contactsPerPage, totalContactsCount)
    const paginatedContacts = filteredContacts.slice(startIndex, endIndex)

    const handleCopyNumber = (phone, idx) => {
        if (navigator?.clipboard) {
            navigator.clipboard.writeText(phone)
        }
        setCopiedIndex(idx)
        setTimeout(() => setCopiedIndex(null), 2000)
    }

    const getSelectedGroupNumbers = () => {
        if (!formData.group) return []
        return groupContactsList.map(c => c.phone)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSendError(null)
        setSendResult(null)
        setScheduleSuccessMsg(null)

        if (!formData.template) {
            alert('Please select an official template first.')
            return
        }

        if (!formData.group) {
            alert('Please select a group first, or click "Add New Group" to create one.')
            return
        }

        const numbers = getSelectedGroupNumbers()
        if (numbers.length === 0) {
            alert(`Selected group "${formData.group}" has no phone numbers.`)
            return
        }

        setIsSending(true)

        // Build runtime components with user variable values
        const outboundComponents = []
        if (variables.length > 0) {
            const bodyParams = variables.map(v => ({
                type: 'text',
                text: variableValues[v]?.trim() || `[${v}]`
            }))
            outboundComponents.push({
                type: 'body',
                parameters: bodyParams
            })
        }

        try {
            const campaignName = `Group Campaign (${formData.group}) ${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`
            const isCarousel = Boolean(selectedTemplateData?.components?.some(c => (c.type || '').toUpperCase() === 'CAROUSEL')) ||
                String(selectedTemplateData?.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(selectedTemplateData?.cards) && selectedTemplateData.cards.length > 0);

            window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'starting',name:campaignName,total:numbers.length,message:`${campaignName} is being submitted for ${numbers.length} recipient(s).`}}))
            const response = await api.post('/campaign/send', {
                campaignName,
                template: formData.template,
                languageCode: selectedTemplateData?.language || 'en_US',
                country: formData.country,
                numbers,
                components: outboundComponents.length > 0 ? outboundComponents : undefined,
                variables: variableValues,
                customMediaUrl: isCarousel ? undefined : (selectedMediaBase64 || selectedMediaUrl || undefined),
                customCarouselMedia: selectedCarouselMedia || undefined,
                featureKey: 'group',
                accountId: activeAccountId || undefined,
                background: true
            },{silent:true})
            setSendResult(response.data)
            if(response.data?.queued)window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'queued',name:campaignName,total:numbers.length,message:`${campaignName} will start sending to ${numbers.length} recipient(s) in about 2 seconds.`}}))
        } catch (err) {
            console.error('Group sending failed:', err)
            window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'error',message:err.response?.data?.message||err.message}}))
            setSendError(err.response?.data?.message || err.message || 'Failed to send campaign.')
        } finally {
            setIsSending(false)
        }
    }

    const handleOpenScheduleModal = () => {
        setSendError(null)
        setScheduleSuccessMsg(null)
        setSendResult(null)

        if (!formData.template) {
            alert('Please select an official template first.')
            return
        }

        if (!formData.group) {
            alert('Please select a group first, or click "Add New Group" to create one.')
            return
        }

        const numbers = getSelectedGroupNumbers()
        if (numbers.length === 0) {
            alert(`Selected group "${formData.group}" has no phone numbers.`)
            return
        }

        setIsScheduleModalOpen(true)
    }

    const handleConfirmSchedule = async (scheduledDateTime) => {
        const numbers = getSelectedGroupNumbers()
        setIsScheduling(true)
        setSendError(null)

        // Build runtime components with user variable values
        const outboundComponents = []
        if (variables.length > 0) {
            const bodyParams = variables.map(v => ({
                type: 'text',
                text: variableValues[v]?.trim() || `[${v}]`
            }))
            outboundComponents.push({
                type: 'body',
                parameters: bodyParams
            })
        }

        try {
            const campaignName = `Group Campaign (${formData.group}) ${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`
            const isCarousel = Boolean(selectedTemplateData?.components?.some(c => (c.type || '').toUpperCase() === 'CAROUSEL')) ||
                String(selectedTemplateData?.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(selectedTemplateData?.cards) && selectedTemplateData.cards.length > 0);

            const response = await api.post('/campaign/schedule', {
                campaignName,
                template: formData.template,
                languageCode: selectedTemplateData?.language || 'en_US',
                country: formData.country,
                numbers,
                components: outboundComponents.length > 0 ? outboundComponents : undefined,
                variables: variableValues,
                customMediaUrl: isCarousel ? undefined : (selectedMediaBase64 || selectedMediaUrl || undefined),
                customCarouselMedia: selectedCarouselMedia || undefined,
                scheduledAt: scheduledDateTime,
                accountId: activeAccountId || undefined
            })

            setScheduleSuccessMsg(response.data.message || 'Campaign scheduled successfully!')
            setIsScheduleModalOpen(false)
            fetchScheduledCampaigns()
        } catch (err) {
            console.error('Failed to schedule campaign:', err)
            const errorMsg = err.response?.data?.message || err.message || 'Failed to schedule campaign.'
            setSendError(errorMsg)
        } finally {
            setIsScheduling(false)
        }
    }

    const handleCancelSchedule = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this scheduled campaign?')) return
        try {
            await api.delete(`/campaign/scheduled/${id}`)
            fetchScheduledCampaigns()
        } catch (err) {
            console.error('Failed to cancel scheduled campaign:', err)
            alert(err.response?.data?.message || 'Failed to cancel scheduled campaign.')
        }
    }

    return (
        <div className="dashboard-content">
            <div className="quick-campaign-card">
                {/* Header with WhatsApp Icon */}
                <div className="quick-campaign-header">
                    <div className="whatsapp-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                            <path d="M19.007 4.93A9.873 9.873 0 0 0 12.008 2c-5.45 0-9.885 4.437-9.888 9.889A9.856 9.856 0 0 0 3.63 17.15l-1.587 5.8 5.937-1.557a9.88 9.88 0 0 0 4.73 1.206h.004c5.449 0 9.883-4.437 9.887-9.889a9.854 9.854 0 0 0-2.894-6.98ZM12.008 20.09h-.004a8.09 8.09 0 0 1-4.13-1.127l-.296-.176-3.064.803.818-2.99-.193-.307a8.082 8.082 0 0 1-1.24-4.51c0-4.469 3.637-8.106 8.108-8.106a8.094 8.094 0 0 1 5.733 2.378 8.092 8.092 0 0 1 2.373 5.737c-.003 4.47-3.64 8.108-8.105 8.108Z" />
                        </svg>
                    </div>
                    <h1>Send By Group Campaign</h1>
                </div>

                {groupSuccessMsg && (
                    <div style={{ margin: '0 0 16px 0', padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', color: '#047857', fontSize: '14px', fontWeight: '500' }}>
                        {groupSuccessMsg}
                    </div>
                )}

                <div className="csv-main-layout">
                    {/* Left: Form */}
                    <div className="csv-form-col">
                        <form onSubmit={handleSubmit}>
                            {/* Form Fields Row */}
                            <div className="form-row">
                                {/* Template Dropdown */}
                                <div className="form-field">
                                    <label className="field-label">Template</label>
                                        <select
                                            name="template"
                                            value={formData.template}
                                            onChange={handleChange}
                                            className="form-select"
                                        >
                                            <option value="">
                                                {isLoadingTemplates
                                                    ? 'Loading templates...'
                                                    : templates.length === 0
                                                        ? 'No Approved Templates Found'
                                                        : 'Select Official Template'}
                                            </option>
                                            {templates.map((t, idx) => (
                                                <option key={idx} value={t.name}>
                                                    {t.name} ({t.language}) - {t.category}
                                                </option>
                                            ))}
                                        </select>
                                    {templatesError && (
                                        <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '5px' }}>
                                            Error: {templatesError}
                                        </p>
                                    )}
                                </div>

                                {/* Group Selector */}
                                <div className="form-field">
                                    <label className="field-label">Group</label>
                                    <div className="select-wrapper">
                                        <select
                                            name="group"
                                            value={formData.group}
                                            onChange={handleChange}
                                            className="form-select"
                                        >
                                            <option value="">
                                                {isLoadingGroups
                                                    ? 'Loading groups...'
                                                    : groups.length === 0
                                                        ? 'No Groups Found (Click Add New Group)'
                                                        : 'Select Group'}
                                            </option>
                                            {groups.map(group => (
                                                <option key={group.id} value={group.name}>
                                                    {group.name} ({group.totalContacts} contacts)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Add New Group Button */}
                                <div className="form-field-button">
                                    <button
                                        type="button"
                                        className="btn-add-group"
                                        onClick={handleAddNewGroup}
                                    >
                                        Add New Group
                                    </button>
                                </div>

                                {/* Country Selector */}
                                <div className="form-field">
                                    <label className="field-label">Country</label>
                                    <div className="select-wrapper">
                                        <select
                                            name="country"
                                            value={formData.country}
                                            onChange={handleChange}
                                            className="form-select"
                                        >
                                            {ALL_COUNTRIES.map((c) => (
                                                <option key={c.label} value={c.label}>
                                                    {c.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Template Message Content & Media Preview */}
                            {isTemplateMediaHeader(selectedTemplateData) ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', marginBottom: '16px' }}>
                                    <MediaHeaderUpload
                                        templateData={selectedTemplateData}
                                        customPreview={selectedMediaUrl}
                                        onMediaChange={(file, previewUrl, base64, carouselData) => {
                                            setSelectedMediaFile(file)
                                            setSelectedMediaUrl(previewUrl)
                                            setSelectedMediaBase64(base64)
                                            setSelectedCarouselMedia(carouselData)
                                        }}
                                    />
                                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column' }}>
                                        <label className="field-label" style={{ marginBottom: '8px', fontWeight: '700', color: '#334155' }}>Template Message Content</label>
                                        <textarea
                                            name="messageText"
                                            value={formData.messageText}
                                            onChange={handleChange}
                                            placeholder="Select an official template above to auto-populate message content..."
                                            rows="6"
                                            className="form-textarea"
                                            style={{ flex: 1, resize: 'vertical' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="numbers-section" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                    <label className="field-label">Template Message Content</label>
                                    <textarea
                                        name="messageText"
                                        value={formData.messageText}
                                        onChange={handleChange}
                                        placeholder="Select an official template above to auto-populate message content..."
                                        rows="4"
                                        className="form-textarea"
                                    />
                                </div>
                            )}

                            {/* Dynamic Variable Inputs with History & Auto-Suggestion */}
                            <TemplateVariablesInput
                                variables={variables}
                                variableValues={variableValues}
                                onVariableChange={handleVariableChange}
                            />

                            {sendError && (
                                <div style={{ margin: '15px 0', padding: '12px 16px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#b91c1c', fontSize: '14px' }}>
                                    <strong>Error: </strong> {sendError}
                                </div>
                            )}

                            {scheduleSuccessMsg && (
                                <div style={{ margin: '15px 0', padding: '14px 16px', backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', color: '#1e40af', fontSize: '14px', fontWeight: '500' }}>
                                    ⏰ {scheduleSuccessMsg}
                                </div>
                            )}

                            {sendResult && (
                                <div style={{ margin: '15px 0', padding: '16px', backgroundColor: sendResult.sent === 0 ? '#fef2f2' : (sendResult.failed === 0 ? '#ecfdf5' : '#fff7ed'), border: `1px solid ${sendResult.sent === 0 ? '#fca5a5' : (sendResult.failed === 0 ? '#6ee7b7' : '#fdba74')}`, borderRadius: '8px' }}>
                                    <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: sendResult.sent === 0 ? '#991b1b' : (sendResult.failed === 0 ? '#065f46' : '#9a3412') }}>
                                        {sendResult.sent === 0 ? '❌ Campaign Failed to Send' : (sendResult.failed === 0 ? '✅ Campaign Completed Successfully' : '⚠️ Campaign Completed with Partial Success')}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
                                        <div><strong>Total:</strong> {sendResult.total}</div>
                                        <div><strong>Sent:</strong> <span style={{ color: '#059669', fontWeight: 'bold' }}>{sendResult.sent}</span></div>
                                        <div><strong>Failed:</strong> <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{sendResult.failed}</span></div>
                                    </div>
                                    {sendResult.results && sendResult.results.some(r => !r.success) && (
                                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#b91c1c' }}>
                                            Reason: {sendResult.results.find(r => !r.success)?.error || 'Provider execution failed'}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Credit Indicator / Subscription Validity Badge */}
                            <div style={{ marginTop: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                    {creditsData?.isDaysBased ? 'Subscription Validity:' : 'Available Credits:'}
                                </span>
                                <CreditsBadge creditsData={creditsData} featureKey="group" loading={isLoadingCredits} />
                            </div>

                            {/* Action Buttons */}
                            <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    type="submit"
                                    className="btn-send-now"
                                    disabled={isSending || isScheduling || (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.group === 0))}
                                >
                                    {isSending ? 'Sending...' : 'Send Now'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-schedule"
                                    onClick={handleOpenScheduleModal}
                                    disabled={isSending || isScheduling || (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.group === 0))}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    Schedule Date
                                </button>
                                {senderNumbers.length > 0 && (
                                    <select
                                        className="form-select"
                                        style={{ width: 'auto', minWidth: '250px', marginLeft: 'auto', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                        value={activeAccountId || ''}
                                        onChange={handleSenderNumberChange}
                                    >
                                        {senderNumbers.map((n) => (
                                            <option key={n.id} value={n.id}>
                                                {n.wa_number || n.number} ({n.name || n.verified_name || 'No Name'})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Progress Indicator */}
                            {isSending && (
                                <div className="campaign-progress" style={{ marginTop: '20px' }}>
                                    <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#10b981' }}>
                                        Sending in progress, please wait...
                                    </p>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#10b981', animation: 'progress-indeterminate 1.5s infinite linear', transformOrigin: '0% 50%' }}></div>
                                    </div>
                                    <style>{`
                                        @keyframes progress-indeterminate {
                                             0% { transform: translateX(-100%) scaleX(0.2); }
                                             100% { transform: translateX(100%) scaleX(1); }
                                        }
                                    `}</style>
                                </div>
                            )}

                            {/* Group Contacts Preview & Pagination Section */}
                            {formData.group ? (
                                <div className="group-contacts-section">
                                    {/* Header Toolbar */}
                                    <div className="group-contacts-header">
                                        <div className="group-contacts-title-area">
                                            <div className="group-contacts-icon">👥</div>
                                            <div>
                                                <h3 className="group-contacts-title">
                                                    Group Contacts: <span style={{ color: '#166534' }}>{formData.group}</span>
                                                    <span className="group-contacts-badge">
                                                        {selectedGroupObj?.totalContacts ?? groupContactsList.length} Contacts
                                                    </span>
                                                </h3>
                                            </div>
                                        </div>

                                        <div className="group-contacts-toolbar">
                                            {/* Search in group */}
                                            <div className="group-contacts-search-box">
                                                <span className="group-contacts-search-icon">🔍</span>
                                                <input
                                                    type="text"
                                                    placeholder="Search number / name..."
                                                    value={contactSearchQuery}
                                                    onChange={(e) => {
                                                        setContactSearchQuery(e.target.value)
                                                        setCurrentPage(1)
                                                    }}
                                                    className="group-contacts-search-input"
                                                />
                                            </div>

                                            {/* Per page selector */}
                                            <div className="group-contacts-per-page">
                                                <span>Show:</span>
                                                <select
                                                    value={contactsPerPage}
                                                    onChange={(e) => {
                                                        setContactsPerPage(Number(e.target.value))
                                                        setCurrentPage(1)
                                                    }}
                                                >
                                                    <option value={5}>5</option>
                                                    <option value={10}>10</option>
                                                    <option value={20}>20</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                    <option value={500}>500</option>
                                                    <option value={1000}>1000</option>
                                                    <option value={10000}>10000</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contacts Table or Empty */}
                                    {groupContactsList.length === 0 ? (
                                        <div className="group-contacts-empty">
                                            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                                                ⚠️ No contact numbers found in group "<strong>{formData.group}</strong>".
                                            </p>
                                        </div>
                                    ) : filteredContacts.length === 0 ? (
                                        <div className="group-contacts-empty">
                                            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                                                No contacts matching "{contactSearchQuery}".
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="group-contacts-table-wrapper">
                                                <table className="group-contacts-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                                                            <th>Phone Number</th>
                                                            <th>Name / Details</th>
                                                            <th style={{ width: '130px', textAlign: 'center' }}>Status</th>
                                                            <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedContacts.map((contact, idx) => {
                                                            const globalIndex = startIndex + idx + 1
                                                            return (
                                                                <tr key={contact.id || `${contact.phone}-${idx}`}>
                                                                    <td style={{ textAlign: 'center', fontWeight: '700', color: '#64748b' }}>
                                                                        {globalIndex}
                                                                    </td>
                                                                    <td>
                                                                        <span className="contact-phone-badge">
                                                                            <span>📱</span>
                                                                            <span>{contact.phone}</span>
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ color: contact.name ? '#1e293b' : '#94a3b8', fontStyle: contact.name ? 'normal' : 'italic' }}>
                                                                        {contact.name || '—'}
                                                                    </td>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <span style={{
                                                                            fontSize: '11px',
                                                                            fontWeight: '700',
                                                                            padding: '3px 8px',
                                                                            borderRadius: '20px',
                                                                            backgroundColor: '#ecfdf5',
                                                                            color: '#059669',
                                                                            border: '1px solid #a7f3d0'
                                                                        }}>
                                                                            ✓ Ready
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <button
                                                                            type="button"
                                                                            className="btn-copy-number"
                                                                            onClick={() => handleCopyNumber(contact.phone, globalIndex)}
                                                                            title="Copy Phone Number"
                                                                        >
                                                                            {copiedIndex === globalIndex ? (
                                                                                <span style={{ color: '#059669', fontSize: '11px', fontWeight: '700' }}>Copied!</span>
                                                                            ) : (
                                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                                                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                                                </svg>
                                                                            )}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination Footer */}
                                            <div className="group-contacts-footer">
                                                <div className="group-contacts-info">
                                                    Showing {totalContactsCount === 0 ? 0 : startIndex + 1} to {endIndex} of {totalContactsCount} contacts
                                                    {contactSearchQuery && ` (filtered from ${groupContactsList.length})`}
                                                </div>

                                                <div className="group-contacts-pagination-btns">
                                                    <button
                                                        type="button"
                                                        className="btn-group-page"
                                                        disabled={safeCurrentPage <= 1}
                                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                    >
                                                        ← Previous
                                                    </button>

                                                    {/* Page Pills */}
                                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                        .filter(p => p === 1 || p === totalPages || (p >= safeCurrentPage - 1 && p <= safeCurrentPage + 1))
                                                        .map((p, idx, arr) => {
                                                            const prevPage = arr[idx - 1]
                                                            return (
                                                                <React.Fragment key={p}>
                                                                    {prevPage && p - prevPage > 1 && (
                                                                        <span style={{ color: '#94a3b8', padding: '0 2px' }}>...</span>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className={`group-page-pill ${safeCurrentPage === p ? 'active' : ''}`}
                                                                        onClick={() => setCurrentPage(p)}
                                                                    >
                                                                        {p}
                                                                    </button>
                                                                </React.Fragment>
                                                            )
                                                        })}

                                                    <button
                                                        type="button"
                                                        className="btn-group-page"
                                                        disabled={safeCurrentPage >= totalPages}
                                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                    >
                                                        Next →
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : null}

                            {/* Scheduled Campaigns List */}
                            {scheduledCampaigns.length > 0 && (
                                <div style={{ marginTop: '25px', padding: '16px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        📅 Upcoming Scheduled Campaigns ({scheduledCampaigns.length})
                                    </h3>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f3f4f6', color: '#4b5563', borderBottom: '1px solid #e5e7eb' }}>
                                                    <th style={{ padding: '8px 10px' }}>Campaign</th>
                                                    <th style={{ padding: '8px 10px' }}>Template</th>
                                                    <th style={{ padding: '8px 10px' }}>Total Numbers</th>
                                                    <th style={{ padding: '8px 10px' }}>Scheduled For</th>
                                                    <th style={{ padding: '8px 10px' }}>Sends In</th>
                                                    <th style={{ padding: '8px 10px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {scheduledCampaigns.map((sc) => (
                                                    <tr key={sc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                        <td style={{ padding: '10px', fontWeight: '600' }}>{sc.campaign_name}</td>
                                                        <td style={{ padding: '10px' }}>{sc.template_name}</td>
                                                        <td style={{ padding: '10px' }}>{sc.total_numbers}</td>
                                                        <td style={{ padding: '10px' }}>
                                                            {new Date(sc.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <CampaignCountdownTimer scheduledAt={sc.scheduled_at} onExpire={fetchScheduledCampaigns} />
                                                        </td>
                                                        <td style={{ padding: '10px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCancelSchedule(sc.id)}
                                                                style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Right: Live WhatsApp Mobile Preview */}
                    <div className="campaign-preview-column">
                        <WhatsAppMobilePreview
                            template={selectedTemplateData}
                            messageText={getPreviewMessageText(formData.messageText)}
                            customMediaUrl={selectedMediaUrl}
                            customCarouselMedia={selectedCarouselMedia}
                        />
                    </div>
                </div>

                {/* Create Group Modal Popup */}
                <CreateGroupModal
                    isOpen={showCreateGroupModal}
                    onClose={() => setShowCreateGroupModal(false)}
                    onSave={handleGroupCreated}
                />

                {/* Schedule Modal */}
                <ScheduleModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setIsScheduleModalOpen(false)}
                    onConfirm={handleConfirmSchedule}
                    numbersCount={getSelectedGroupNumbers().length}
                />
            </div>
        </div>
    )
}
