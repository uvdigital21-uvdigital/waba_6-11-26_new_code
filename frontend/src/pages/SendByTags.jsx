import React, { useState, useEffect } from 'react'
import api from '../services/api.js'
import { getTags } from '../services/tagService.js'
import { useTitle } from '../context/TitleContext.jsx'
import AddTagsModal from '../components/AddTagsModal.jsx'
import ScheduleModal from '../components/ScheduleModal.jsx'
import CampaignCountdownTimer from '../components/CampaignCountdownTimer.jsx'
import WhatsAppMobilePreview from '../components/WhatsAppMobilePreview.jsx'
import MediaHeaderUpload, { isTemplateMediaHeader } from '../components/MediaHeaderUpload.jsx'
import CreditsBadge from '../components/CreditsBadge.jsx'
import TemplateVariablesInput from '../components/TemplateVariablesInput.jsx'
import './Campaigns.css'

export default function SendByTags() {
    const { setTitle } = useTitle()

    const [selectedTemplate, setSelectedTemplate] = useState('')
    const [messageText, setMessageText] = useState('')
    const [selectedTags, setSelectedTags] = useState('')
    const [showAddTagsModal, setShowAddTagsModal] = useState(false)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [scheduledCampaigns, setScheduledCampaigns] = useState([])
    const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState(null)
    const [isScheduling, setIsScheduling] = useState(false)

    const [templates, setTemplates] = useState([])
    const [templatesError, setTemplatesError] = useState(null)
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
    const [selectedTemplateData, setSelectedTemplateData] = useState(null)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [activeAccountId, setActiveAccountId] = useState(null)
    const [senderNumbers, setSenderNumbers] = useState([])

    const [availableTags, setAvailableTags] = useState([])
    const [isLoadingTags, setIsLoadingTags] = useState(true)

    // Selected tag contacts (total + numbers list for preview)
    const [tagContacts, setTagContacts] = useState([])
    const [tagContactTotal, setTagContactTotal] = useState(0)
    const [selectedTagInfo, setSelectedTagInfo] = useState(null)
    const [isLoadingTagContacts, setIsLoadingTagContacts] = useState(false)
    const [tagContactsError, setTagContactsError] = useState(null)
    const [isSendingCampaign, setIsSendingCampaign] = useState(false)
    const [campaignMessage, setCampaignMessage] = useState('')
    const [campaignError, setCampaignError] = useState('')
    const [campaignSummary, setCampaignSummary] = useState(null)

    const [variables, setVariables] = useState([])
    const [variableValues, setVariableValues] = useState({})
    const [selectedMediaUrl, setSelectedMediaUrl] = useState(null)
    const [selectedMediaFile, setSelectedMediaFile] = useState(null)
    const [selectedMediaBase64, setSelectedMediaBase64] = useState(null)
    const [selectedCarouselMedia, setSelectedCarouselMedia] = useState(null)

    const [creditsData, setCreditsData] = useState(null)
    const [isLoadingCredits, setIsLoadingCredits] = useState(true)

    useEffect(() => {
        setTitle('Send By Tags')
        fetchMetaTemplates()
        fetchTags()
        fetchCredits()
        fetchScheduledCampaigns()
    }, [setTitle])

    const fetchScheduledCampaigns = async () => {
        try {
            const response = await api.get('/campaign/scheduled?type=tag', { silent: true })
            if (response.data && Array.isArray(response.data.data)) {
                const tagList = response.data.data.filter(sc =>
                    !sc.campaign_name || sc.campaign_name.toLowerCase().startsWith('tag')
                )
                setScheduledCampaigns(tagList)
            }
        } catch (err) {
            console.error('Failed to load scheduled campaigns:', err)
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

    const fetchCredits = async () => {
        try {
            setIsLoadingCredits(true)
            const res = await api.get('/credits/balance')
            if (res.data?.success) {
                setCreditsData(res.data)
            }
        } catch (err) {
            console.error('Failed to fetch credits:', err)
        } finally {
            setIsLoadingCredits(false)
        }
    }

    useEffect(() => {
        const handleTagsUpdated = () => {
            fetchTags()
        }

        window.addEventListener('tags:updated', handleTagsUpdated)
        return () => window.removeEventListener('tags:updated', handleTagsUpdated)
    }, [])

    const fetchTags = async () => {
        setIsLoadingTags(true)
        try {
            const data = await getTags()
            setAvailableTags(Array.isArray(data.tags) ? data.tags : [])
        } catch (err) {
            console.error('Failed to load tags:', err)
        } finally {
            setIsLoadingTags(false)
        }
    }

    const fetchTagContacts = async (tagId) => {
        if (!tagId) {
            setTagContacts([])
            setTagContactTotal(0)
            setSelectedTagInfo(null)
            setTagContactsError(null)
            return
        }

        setIsLoadingTagContacts(true)
        setTagContactsError(null)
        try {
            const response = await api.get(`/tags/${tagId}/contacts`)
            const normalizedContacts = (response.data.contacts || response.data.chats || response.data.results || response.data.numbers || []).map((item) => {
                if (typeof item === 'string') {
                    return { phoneNumber: item, contactName: item, name: item }
                }
                return {
                    ...item,
                    name: item.contactName || item.name || item.phoneNumber || item.phone || 'Unnamed entry',
                    phone: item.phoneNumber || item.phone || null,
                }
            })

            if (response.data.success) {
                setTagContacts(normalizedContacts)
                setTagContactTotal(Number(response.data.total ?? normalizedContacts.length))
                setSelectedTagInfo(response.data.tag || null)
            } else {
                setTagContacts([])
                setTagContactTotal(0)
                setSelectedTagInfo(null)
                setTagContactsError(response.data.message || 'Failed to load tag contacts')
            }
        } catch (err) {
            console.error('Failed to load tag contacts:', err)
            setTagContacts([])
            setTagContactTotal(0)
            setSelectedTagInfo(null)
            setTagContactsError(err.response?.data?.message || err.message)
        } finally {
            setIsLoadingTagContacts(false)
        }
    }

    const handleTagChange = (e) => {
        const value = e.target.value
        setSelectedTags(value)
        fetchTagContacts(value)
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

    const handleTemplateChange = (e) => {
        const value = e.target.value
        setSelectedTemplate(value)

        const fromList = templates.find(t => t.name === value)
        const bodyComp = fromList?.components?.find(c => (c.type || '').toUpperCase() === 'BODY')
        const bodyText = bodyComp?.text || fromList?.text || ''
        setMessageText(bodyText)

        const bodyMatches = bodyText.match(/\{\{(\d+)\}\}/g) || []
        const varNums = [...new Set(bodyMatches.map(m => m.replace(/\D/g, '')))].sort((a, b) => Number(a) - Number(b))

        const initialVals = {}
        varNums.forEach(v => {
            initialVals[v] = ''
        })

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

    const handleTagCreated = async (tagData) => {
        setShowAddTagsModal(false)
        await fetchTags()
        if (tagData?.id) {
            setSelectedTags(String(tagData.id))
            fetchTagContacts(String(tagData.id))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setCampaignError('');
        setCampaignMessage('');
        setScheduleSuccessMsg(null);
        setCampaignSummary(null);

        if (!selectedTemplate || !selectedTags) {
            setCampaignError('Please select both a template and a tag.');
            return;
        }

        if (tagContactTotal === 0) {
            setCampaignError('No contacts are assigned to this tag.');
            return;
        }

        setIsSendingCampaign(true)
        setCampaignError('')
        setCampaignMessage('Sending campaign...')
        setCampaignSummary(null)

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
            const campaignName = `Tag_Campaign_${Date.now()}`;
            const templateLang = selectedTemplateData?.language || templates.find(t => t.name === selectedTemplate)?.language || 'en_US';
            const isCarousel = Boolean(selectedTemplateData?.components?.some(c => (c.type || '').toUpperCase() === 'CAROUSEL')) ||
                String(selectedTemplateData?.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(selectedTemplateData?.cards) && selectedTemplateData.cards.length > 0);

            window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'starting',name:campaignName,total:tagContactTotal,message:`${campaignName} is being submitted for ${tagContactTotal} recipient(s).`}}))
            const response = await api.post('/campaign/send-by-tag', {
                campaignName,
                template: selectedTemplate,
                languageCode: templateLang,
                tagId: selectedTags,
                components: outboundComponents.length > 0 ? outboundComponents : undefined,
                variables: variableValues,
                customMediaUrl: isCarousel ? undefined : (selectedMediaBase64 || selectedMediaUrl || undefined),
                customCarouselMedia: selectedCarouselMedia || undefined,
                accountId: activeAccountId || undefined,
                background: true
            },{silent:true});

            if(response.data?.queued){window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'queued',name:campaignName,total:response.data.total||tagContactTotal,message:`${campaignName} will start sending in about 2 seconds.`}}));setCampaignMessage(response.data.message);setCampaignSummary({total:response.data.total||tagContactTotal,sent:0,failed:0});return;}
            const sent = response.data?.sent || 0;
            const failed = response.data?.failed || 0;
            const total = response.data?.total || (sent + failed) || tagContactTotal;

            const summary = { total, sent, failed };
            setCampaignSummary(summary);

            if (response.data?.success && sent > 0) {
                if (failed === 0) {
                    setCampaignMessage('Campaign sent successfully.');
                    setCampaignError('');
                } else {
                    setCampaignMessage(`Campaign completed with partial success (${sent} sent, ${failed} failed).`);
                    setCampaignError('');
                }
            } else {
                setCampaignMessage('');
                const errDetail = response.data?.errorSummary || response.data?.message || 'All messages failed to send via Meta WhatsApp API.';
                setCampaignError(`Campaign failed to send. Reason: ${errDetail}`);
            }
        } catch (err) {
            console.error('Failed to send campaign by tag:', err);
            window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'error',message:err.response?.data?.message||err.message}}));
            setCampaignError(err.response?.data?.message || err.message || 'Failed to send campaign.');
            setCampaignMessage('');
        } finally {
            setIsSendingCampaign(false);
            fetchCredits();
        }
    }

    const handleOpenScheduleModal = () => {
        setCampaignError('')
        setCampaignMessage('')
        setScheduleSuccessMsg(null)
        setCampaignSummary(null)

        if (!selectedTemplate || !selectedTags) {
            alert('Please select both a template and a tag.')
            return
        }

        const numbers = tagContacts.map(c => c.phone || c.phoneNumber).filter(Boolean)
        if (numbers.length === 0) {
            alert('No contacts are assigned to this tag.')
            return
        }

        setIsScheduleModalOpen(true)
    }

    const handleConfirmSchedule = async (scheduledDateTime) => {
        const numbers = tagContacts.map(c => c.phone || c.phoneNumber).filter(Boolean)
        if (!selectedTemplate || !selectedTags) {
            setCampaignError('Please select both a template and a tag.')
            return
        }
        if (numbers.length === 0) {
            setCampaignError('No contacts are assigned to this tag.')
            return
        }

        setIsScheduling(true)
        setCampaignError('')
        setScheduleSuccessMsg(null)
        setCampaignSummary(null)

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
            const tagName = selectedTagInfo?.name || availableTags.find(t => String(t.id) === String(selectedTags))?.name || 'Tag'
            const campaignName = `Tag Campaign (${tagName}) ${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`
            const templateLang = selectedTemplateData?.language || templates.find(t => t.name === selectedTemplate)?.language || 'en_US'
            const isCarousel = Boolean(selectedTemplateData?.components?.some(c => (c.type || '').toUpperCase() === 'CAROUSEL')) ||
                String(selectedTemplateData?.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(selectedTemplateData?.cards) && selectedTemplateData.cards.length > 0);

            const response = await api.post('/campaign/schedule', {
                campaignName,
                template: selectedTemplate,
                languageCode: templateLang,
                numbers,
                components: outboundComponents.length > 0 ? outboundComponents : undefined,
                variables: variableValues,
                customMediaUrl: isCarousel ? undefined : (selectedMediaBase64 || selectedMediaUrl || undefined),
                customCarouselMedia: selectedCarouselMedia || undefined,
                scheduledAt: scheduledDateTime,
                accountId: activeAccountId || undefined
            })

            setScheduleSuccessMsg(response.data?.message || 'Campaign scheduled successfully!')
            setIsScheduleModalOpen(false)
            fetchScheduledCampaigns()
        } catch (err) {
            console.error('Failed to schedule campaign by tag:', err);
            setCampaignError(err.response?.data?.message || err.message || 'Failed to schedule campaign.')
        } finally {
            setIsScheduling(false)
        }
    }

    return (
        <div className="dashboard-content">
            <div className="send-by-tags-card">
                {/* Header with WhatsApp Icon */}
                <div className="quick-campaign-header">
                    <div className="whatsapp-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                            <path d="M19.007 4.93A9.873 9.873 0 0 0 12.008 2c-5.45 0-9.885 4.437-9.888 9.889A9.856 9.856 0 0 0 3.63 17.15l-1.587 5.8 5.937-1.557a9.88 9.88 0 0 0 4.73 1.206h.004c5.449 0 9.883-4.437 9.887-9.889a9.854 9.854 0 0 0-2.894-6.98ZM12.008 20.09h-.004a8.09 8.09 0 0 1-4.13-1.127l-.296-.176-3.064.803.818-2.99-.193-.307a8.082 8.082 0 0 1-1.24-4.51c0-4.469 3.637-8.106 8.108-8.106a8.094 8.094 0 0 1 5.733 2.378 8.092 8.092 0 0 1 2.373 5.737c-.003 4.47-3.64 8.108-8.105 8.108Z" />
                        </svg>
                    </div>
                    <h1>Send By Tag Campaign</h1>
                </div>

                <div className="csv-main-layout">
                    {/* Left: Form */}
                    <div className="csv-form-col">
                        <form onSubmit={handleSubmit}>
                            {/* Form Fields Row */}
                            <div className="form-row-tags">
                                {/* Template Dropdown */}
                                <div className="form-field-tags">
                                        <select
                                            value={selectedTemplate}
                                            onChange={handleTemplateChange}
                                            className="form-select-tags"
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

                                {/* Tags Input */}
                                <div className="form-field-tags">
                                    <select
                                        value={selectedTags}
                                        onChange={handleTagChange}
                                        className="form-select-tags"
                                    >
                                        <option value="">
                                            {isLoadingTags ? 'Loading tags...' : 'Select by Tags'}
                                        </option>
                                        {availableTags.map((tag) => (
                                            <option key={tag.id} value={tag.id}>
                                                {tag.name}
                                                {tag.contactCount != null || tag.total_numbers != null
                                                    ? ` (${Number(tag.contactCount ?? tag.total_numbers ?? 0)} contacts)`
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Action Buttons Row */}
                                <div className="form-field-buttons-tags">
                                    <button
                                        type="button"
                                        className="btn-add-tags"
                                        onClick={() => setShowAddTagsModal(true)}
                                    >
                                        Add New Tags
                                    </button>
                                    <button type="button" className="btn-exclude-red">
                                        Exclude Numbers
                                    </button>
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
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
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
                                        value={messageText}
                                        onChange={(e) => setMessageText(e.target.value)}
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

                            {scheduleSuccessMsg && (
                                <div style={{ margin: '15px 0', padding: '14px 16px', backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', color: '#1e40af', fontSize: '14px', fontWeight: '500' }}>
                                    ⏰ {scheduleSuccessMsg}
                                </div>
                            )}

                            {/* Credit Indicator / Subscription Validity Badge */}
                            <div style={{ marginTop: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                    {creditsData?.isDaysBased ? 'Subscription Validity:' : 'Available Credits:'}
                                </span>
                                <CreditsBadge creditsData={creditsData} featureKey="tags" loading={isLoadingCredits} />
                            </div>

                            {/* Action Buttons */}
                            <div className="action-buttons-tags" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    type="submit"
                                    className="btn-send-now-tags"
                                    disabled={
                                        !selectedTemplate ||
                                        !selectedTags ||
                                        tagContactTotal === 0 ||
                                        isLoadingTagContacts ||
                                        isSendingCampaign ||
                                        isScheduling ||
                                        (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.tags === 0))
                                    }
                                >
                                    {isSendingCampaign ? 'Sending...' : 'Send Now'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-schedule-tags"
                                    onClick={handleOpenScheduleModal}
                                    disabled={
                                        !selectedTemplate ||
                                        !selectedTags ||
                                        tagContactTotal === 0 ||
                                        isLoadingTagContacts ||
                                        isSendingCampaign ||
                                        isScheduling ||
                                        (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.tags === 0))
                                    }
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
                            {isSendingCampaign && (
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

                            {(campaignError || campaignMessage || campaignSummary) && (
                                <div className="tag-campaign-status">
                                    {campaignError && <div className="tag-campaign-error">{campaignError}</div>}
                                    {campaignMessage && !campaignError && <div className="tag-campaign-success">{campaignMessage}</div>}
                                    {campaignSummary && (
                                        <div className="tag-campaign-summary">
                                            <span>Total: {campaignSummary.total}</span>
                                            <span>Success: {campaignSummary.sent}</span>
                                            <span>Failed: {campaignSummary.failed}</span>
                                        </div>
                                    )}
                                </div>
                            )}

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

                    {/* Right: Tag numbers preview + Phone Preview */}
                    <div className="send-by-tags-preview-col">
                        {selectedTags && (
                            <div className="tag-numbers-preview-card">
                                <div className="tag-numbers-preview-header">
                                    <div>
                                        <div className="tag-numbers-preview-label">Selected Tag</div>
                                        <div className="tag-numbers-preview-name">
                                            {selectedTagInfo?.name ||
                                                availableTags.find((t) => String(t.id) === String(selectedTags))?.name ||
                                                '—'}
                                        </div>
                                    </div>
                                    <div className="tag-numbers-preview-total-box">
                                        <div className="tag-numbers-preview-total-label">Total</div>
                                        <div className="tag-numbers-preview-total-value">
                                            {isLoadingTagContacts ? '…' : tagContactTotal}
                                        </div>
                                    </div>
                                </div>

                                {tagContactsError && (
                                    <p className="tag-numbers-preview-error">{tagContactsError}</p>
                                )}

                                {isLoadingTagContacts ? (
                                    <div className="tag-numbers-preview-loading">Loading entries…</div>
                                ) : tagContactTotal === 0 ? (
                                    <div className="tag-numbers-preview-empty">
                                        No chats or contacts found for this tag.
                                    </div>
                                ) : (
                                    <div className="tag-numbers-preview-list-wrap">
                                        <div className="tag-numbers-preview-list-title">
                                            Selected Chats/Contacts ({tagContactTotal})
                                        </div>
                                        <div className="tag-numbers-preview-list">
                                            {tagContacts.map((entry, idx) => {
                                                const name = entry.name || 'Unnamed chat'
                                                const phone = entry.phone || 'No phone available'
                                                const badge = entry.source === 'contact' ? 'Contact' : 'Chat'

                                                return (
                                                    <div key={`${entry.id || entry.phone || 'item'}-${idx}`} className="tag-numbers-preview-item">
                                                        <div className="tag-numbers-preview-avatar">{(name || 'C').charAt(0).toUpperCase()}</div>
                                                        <div className="tag-numbers-preview-item-content">
                                                            <div className="tag-numbers-preview-item-title">{name}</div>
                                                            <div className="tag-numbers-preview-item-meta">
                                                                <span className="tag-numbers-preview-badge">{badge}</span>
                                                                <span className="tag-numbers-preview-phone">{phone}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Right: Live WhatsApp Mobile Preview */}
                        <div className="campaign-preview-column" style={{ marginTop: '16px' }}>
                            <WhatsAppMobilePreview
                                template={selectedTemplateData}
                                messageText={getPreviewMessageText(messageText)}
                                customMediaUrl={selectedMediaUrl}
                                customCarouselMedia={selectedCarouselMedia}
                            />
                        </div>
                    </div>
                </div>

                <AddTagsModal
                    isOpen={showAddTagsModal}
                    onClose={() => setShowAddTagsModal(false)}
                    onSave={handleTagCreated}
                />

                <ScheduleModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setIsScheduleModalOpen(false)}
                    onConfirm={handleConfirmSchedule}
                    numbersCount={tagContactTotal}
                />
            </div>
        </div>
    )
}
