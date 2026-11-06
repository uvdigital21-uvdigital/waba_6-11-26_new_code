import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import api from '../services/api.js'
import { useTitle } from '../context/TitleContext.jsx'
import { API_BASE_URL, getImageUrl } from '../config.js'
import { ALL_COUNTRIES } from '../constants/metaConstants.js'
import WhatsAppMobilePreview from '../components/WhatsAppMobilePreview.jsx'
import MediaHeaderUpload, { isTemplateMediaHeader } from '../components/MediaHeaderUpload.jsx'
import CreditsBadge from '../components/CreditsBadge.jsx'
import TemplateVariablesInput from '../components/TemplateVariablesInput.jsx'

// ---------- Schedule Modal Component ----------
function ScheduleModal({ isOpen, onClose, onConfirm, numbersCount }) {
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

    const [scheduledDateTime, setScheduledDateTime] = useState(getDefaultDateTime())
    const [timeRemainingText, setTimeRemainingText] = useState('')
    const [isValid, setIsValid] = useState(true)

    useEffect(() => {
        const updateText = () => {
            if (!scheduledDateTime) {
                setTimeRemainingText('')
                setIsValid(false)
                return
            }
            const target = new Date(scheduledDateTime).getTime()
            const now = Date.now()
            const diff = target - now
            if (isNaN(target) || diff <= 0) {
                setTimeRemainingText('Scheduled time must be in the future')
                setIsValid(false)
                return
            }

            setIsValid(true)
            const minutes = Math.floor(diff / 60000)
            const hours = Math.floor(minutes / 60)
            const days = Math.floor(hours / 24)

            if (days > 0) {
                const remHours = hours % 24
                setTimeRemainingText(`Executes in ~${days} day(s) and ${remHours} hour(s)`)
            } else if (hours > 0) {
                const remMins = minutes % 60
                setTimeRemainingText(`Executes in ~${hours} hour(s) and ${remMins} min(s)`)
            } else {
                setTimeRemainingText(`Executes in ~${minutes} minute(s)`)
            }
        }
        updateText()
        const timer = setInterval(updateText, 15000)
        return () => clearInterval(timer)
    }, [scheduledDateTime])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!isValid) return
        onConfirm(scheduledDateTime)
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '16px'
        }} onClick={onClose}>
            <div style={{
                background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '480px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>

                {/* Modal Header */}
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>⏰</span>
                        <div>
                            <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0 }}>Schedule Quick Broadcast</h3>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>Targeting {numbersCount} recipient(s)</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer' }}>×</button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                            Select Date & Time (Local Time):
                        </label>
                        <input
                            type="datetime-local"
                            value={scheduledDateTime}
                            onChange={(e) => setScheduledDateTime(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1',
                                fontSize: '15px', fontWeight: '600', color: '#0f172a', outline: 'none'
                            }}
                            required
                        />
                    </div>

                    {timeRemainingText && (
                        <div style={{
                            padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: '600',
                            backgroundColor: isValid ? '#f0fdf4' : '#fef2f2',
                            color: isValid ? '#166534' : '#991b1b',
                            border: `1px solid ${isValid ? '#bbf7d0' : '#fca5a5'}`
                        }}>
                            {isValid ? '⏳ ' : '⚠️ '}{timeRemainingText}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid}
                            style={{
                                padding: '10px 22px', borderRadius: '8px', border: 'none',
                                background: isValid ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : '#94a3b8',
                                color: '#ffffff', cursor: isValid ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '13px',
                                boxShadow: isValid ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none'
                            }}
                        >
                            Confirm Schedule Date
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ---------- Live Countdown Timer Component ----------
function CampaignCountdownTimer({ scheduledAt, onExpire }) {
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

// Helper function to sanitize phone numbers input:
// - Removes all non-digit text, words, and special characters
// - Removes country dial codes (e.g. +91, 91, +1, +44) and leading zeros
// - Leaves only clean mobile numbers (one per line)
export const sanitizeNumbersInput = (text, country = 'India(+91)') => {
    if (!text) return ''

    const dialMatch = (country || '').match(/\+(\d+)/)
    const dialCode = dialMatch ? dialMatch[1] : '91'

    const cleanSingleNumber = (rawDigits) => {
        let num = rawDigits.replace(/\D/g, '')
        if (!num) return ''
        if (num.startsWith('0') && num.length === 11) {
            num = num.slice(1)
        }
        if (dialCode && num.startsWith(dialCode) && num.length === (dialCode.length + 10)) {
            num = num.slice(dialCode.length)
        }
        return num
    }

    const lines = text.split(/[\r\n,;]+/)
    const result = []

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue

        const lineDigits = line.replace(/\D/g, '')
        if (!lineDigits) continue

        if (lineDigits.length <= 13) {
            const cleaned = cleanSingleNumber(lineDigits)
            if (cleaned) result.push(cleaned)
        } else {
            // Line might contain multiple numbers or text with numbers
            const words = line.split(/\s+/)
            let foundWord = false
            for (const w of words) {
                const wDigits = w.replace(/\D/g, '')
                if (wDigits.length >= 7) {
                    const cleaned = cleanSingleNumber(wDigits)
                    if (cleaned) {
                        result.push(cleaned)
                        foundWord = true
                    }
                }
            }
            if (!foundWord) {
                const matches = lineDigits.match(/\d{10,12}/g)
                if (matches) {
                    matches.forEach(m => result.push(cleanSingleNumber(m)))
                } else {
                    result.push(cleanSingleNumber(lineDigits))
                }
            }
        }
    }

    return result.join('\n')
}

import './Campaigns.css'

export default function SendQuick() {
    const { setTitle } = useTitle()
    const [formData, setFormData] = useState({
        template: '',
        messageText: '',
        campaignName: '',
        country: 'India(+91)',
        numbers: ''
    })

    const [showPreview, setShowPreview] = useState(false)
    const [templates, setTemplates] = useState([])
    const [selectedTemplateData, setSelectedTemplateData] = useState(null)
    const [templatesError, setTemplatesError] = useState(null)
    const [templateButtons, setTemplateButtons] = useState([])
    const [selectedMediaUrl, setSelectedMediaUrl] = useState(null)
    const [selectedMediaFile, setSelectedMediaFile] = useState(null)
    const [selectedMediaBase64, setSelectedMediaBase64] = useState(null)
    const [selectedCarouselMedia, setSelectedCarouselMedia] = useState(null)
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
    const [isSending, setIsSending] = useState(false)
    const [result, setResult] = useState(null)
    const [queueNotice, setQueueNotice] = useState(null)
    const [activeAccountId, setActiveAccountId] = useState(null)
    const [creditsData, setCreditsData] = useState(null)
    const [isLoadingCredits, setIsLoadingCredits] = useState(true)
    const [senderNumbers, setSenderNumbers] = useState([])

    const [variables, setVariables] = useState([])
    const [variableValues, setVariableValues] = useState({})
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [isScheduling, setIsScheduling] = useState(false)
    const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState('')
    const [scheduledCampaigns, setScheduledCampaigns] = useState([])

    const dispatchedMap = useRef({})

    useEffect(() => {
        setTitle('Send Quick Campaign')
        fetchMetaTemplates()
        fetchCredits()
        fetchScheduledCampaigns()

        const scheduleInterval = setInterval(fetchScheduledCampaigns, 30000)

        const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '')
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true
        })

        const activeOrgId = localStorage.getItem('org_id') || 1
        socket.on('connect', () => {
            socket.emit('join_organization', activeOrgId)
        })

        const handleStatusUpdate = (data) => {
            if (!data || !data.wamid) return
            const rawWamid = String(data.wamid).trim()
            const cleanWamid = rawWamid.replace(/^wamid\./i, '')
            const phone = dispatchedMap.current[rawWamid] || dispatchedMap.current[cleanWamid]

            if (phone) {
                if (data.status === 'failed') {
                    setResult(prev => {
                        if (!prev) return prev
                        const exists = prev.failedNumbers.some(f => f.phone === phone)
                        if (exists) return prev
                        const errReason = data.error?.message || data.error?.title || 'Message undeliverable (Number switched off / inactive on WhatsApp)'
                        return {
                            ...prev,
                            sent: Math.max(0, prev.sent - 1),
                            failed: prev.failed + 1,
                            failedNumbers: [...prev.failedNumbers, { phone, error: errReason }]
                        }
                    })
                } else if (data.status === 'delivered' || data.status === 'read') {
                    setResult(prev => {
                        if (!prev) return prev
                        return {
                            ...prev,
                            delivered: (prev.delivered || 0) + 1
                        }
                    })
                }
            }
        }

        socket.on('message_status_updated', handleStatusUpdate)

        return () => {
            clearInterval(scheduleInterval)
            socket.off('message_status_updated', handleStatusUpdate)
            socket.disconnect()
        }
    }, [setTitle])

    const fetchScheduledCampaigns = async () => {
        try {
            const response = await api.get('/campaign/scheduled?type=quick', { silent: true })
            if (response.data && Array.isArray(response.data.data)) {
                setScheduledCampaigns(response.data.data)
            }
        } catch (err) {
            console.error('Failed to load scheduled quick campaigns:', err)
        }
    }

    const handleCancelSchedule = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this scheduled broadcast?')) return
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
        } catch (_) {
        } finally {
            setIsLoadingCredits(false)
        }
    }

    const fetchMetaTemplates = async () => {
        setIsLoadingTemplates(true)
        setTemplatesError(null)
        try {
            const searchParams = new URLSearchParams(window.location.search)
            const accId = searchParams.get('account_id') || localStorage.getItem('active_wa_account_id') || ''
            if (accId) setActiveAccountId(accId)
            const url = accId ? `/meta-templates?account_id=${accId}` : '/meta-templates'

            const response = await api.get(url)
            const list = Array.isArray(response.data) ? response.data : (response.data?.data || [])
            const approvedList = list.filter(t => !t.status || String(t.status).toUpperCase() === 'APPROVED')
            setTemplates(approvedList)

            // Fetch all connected numbers for dropdown
            try {
                const numRes = await api.get('/numbers?limit=100')
                const nums = numRes.data?.data || numRes.data?.numbers || numRes.data?.whatsapp_accounts || []
                setSenderNumbers(nums)
                if (nums.length > 0 && !accId) {
                    setActiveAccountId(String(nums[0].id))
                    localStorage.setItem('active_wa_account_id', String(nums[0].id))
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
        
        // Refetch templates for new account
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

    const handleChange = (e) => {
        const { name, value } = e.target
        if (name === 'template') {
            const tObj = templates.find(t => t.name === value)
            const bodyComp = tObj?.components?.find(c => (c.type || '').toUpperCase() === 'BODY')
            const bodyText = bodyComp?.text || tObj?.text || ''

            // Extract body variables like {{1}}, {{2}}, {{3}}
            const bodyMatches = bodyText.match(/\{\{(\d+)\}\}/g) || []
            const varNums = [...new Set(bodyMatches.map(m => m.replace(/\D/g, '')))].sort((a, b) => Number(a) - Number(b))

            const initialVals = {}
            varNums.forEach(v => {
                initialVals[v] = ''
            })

            // Extract buttons
            const btnComp = tObj?.components?.find(c => (c.type || '').toUpperCase() === 'BUTTONS')
            const btns = btnComp?.buttons || []

            setFormData(prev => ({ ...prev, template: value, messageText: bodyText }))
            setSelectedTemplateData(tObj || null)
            setSelectedMediaUrl(null)
            setSelectedMediaFile(null)
            setSelectedMediaBase64(null)
            setSelectedCarouselMedia(null)
            setVariables(varNums)
            setVariableValues(initialVals)
            setTemplateButtons(btns)

            // Asynchronously fetch enriched template details to ensure header media is fully resolved
            if (value) {
                api.get(`/meta-templates/${encodeURIComponent(value)}`)
                    .then(res => {
                        if (res.data) {
                            setSelectedTemplateData(prev => {
                                if (prev && prev.name === value) {
                                    return {
                                        ...prev,
                                        ...res.data,
                                        header_media_url: res.data.header_media_url || prev.header_media_url,
                                        components: res.data.components || prev.components
                                    }
                                }
                                return prev
                            })
                        }
                    })
                    .catch(() => {})
            }
        } else if (name === 'country') {
            const sanitizedNums = sanitizeNumbersInput(formData.numbers, value)
            setFormData(prev => ({ ...prev, country: value, numbers: sanitizedNums }))
        } else if (name === 'numbers') {
            const endsWithNewline = value.endsWith('\n')
            const cleaned = sanitizeNumbersInput(value, formData.country)
            setFormData(prev => ({
                ...prev,
                numbers: cleaned + (endsWithNewline && cleaned && !cleaned.endsWith('\n') ? '\n' : '')
            }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const handleNumbersPaste = (e) => {
        e.preventDefault()
        const pastedText = e.clipboardData ? e.clipboardData.getData('text') : ''
        if (!pastedText) return

        const currentVal = formData.numbers
        const textarea = e.target
        const start = textarea.selectionStart || 0
        const end = textarea.selectionEnd || 0
        const before = currentVal.substring(0, start)
        const after = currentVal.substring(end)

        const rawCombined = before + (before && !before.endsWith('\n') ? '\n' : '') + pastedText + (after ? '\n' + after : '')
        const cleaned = sanitizeNumbersInput(rawCombined, formData.country)
        setFormData(prev => ({ ...prev, numbers: cleaned }))
    }

    const handleNumbersBlur = () => {
        if (!formData.numbers) return
        const cleaned = sanitizeNumbersInput(formData.numbers, formData.country)
        setFormData(prev => ({ ...prev, numbers: cleaned }))
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

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.campaignName.trim()) return alert('Campaign Name is required.')
        if (!formData.template) return alert('Official Template is required.')
        if (!formData.numbers.trim()) return alert('At least one phone number is required.')

        // Check if required variables are filled
        for (const v of variables) {
            if (!variableValues[v] || !variableValues[v].trim()) {
                const proceed = window.confirm(`Variable {{${v}}} is empty. Do you want to continue sending with default placeholder?`)
                if (!proceed) return
            }
        }

        // Parse and clean numbers (remove +, spaces, dashes, etc.)
        const rawNumbers = formData.numbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n !== '')
        if (rawNumbers.length === 0) return alert('Please provide valid phone numbers.')

        // Extract the country code dial prefix (e.g. "91" from "India(+91)")
        const countryMatch = formData.country.match(/\+(\d+)/)
        const dialCode = countryMatch ? countryMatch[1] : ''

        const cleanedNumbers = []
        const invalidNumbers = []

        for (const raw of rawNumbers) {
            let cleaned = raw.replace(/\D/g, '')
            if (cleaned.startsWith('0') && cleaned.length > 10) {
                cleaned = cleaned.replace(/^0+/, '')
            }

            if (dialCode) {
                // 10-digit phone number is always a local subscriber number, even if it starts with "91" (e.g. 9154958910)
                if (cleaned.length === 10) {
                    cleanedNumbers.push(dialCode + cleaned)
                } else if (cleaned.startsWith(dialCode) && cleaned.length === (dialCode.length + 10)) {
                    // Already prefixed with country code (e.g. 919154958910)
                    cleanedNumbers.push(cleaned)
                } else if (cleaned.startsWith(dialCode) && cleaned.length >= 11 && cleaned.length <= 15) {
                    cleanedNumbers.push(cleaned)
                } else if (cleaned.length >= 7 && cleaned.length <= 12) {
                    cleanedNumbers.push(dialCode + cleaned)
                } else {
                    invalidNumbers.push(raw)
                }
            } else {
                if (cleaned.length >= 7 && cleaned.length <= 15) {
                    cleanedNumbers.push(cleaned)
                } else {
                    invalidNumbers.push(raw)
                }
            }
        }

        if (invalidNumbers.length > 0) {
            return alert(`The following phone numbers are invalid or do not match the selected country (${formData.country}):\n\n${invalidNumbers.join('\n')}\n\nPlease check the country code and try again.`)
        }

        // Find language code for the selected template
        const selectedTemplateData = templates.find(t => t.name === formData.template)
        const languageCode = selectedTemplateData ? selectedTemplateData.language : 'en_US'

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

        const campaignTitle = formData.campaignName?.trim() || `Quick Broadcast - ${formData.template}`
        setQueueNotice({name:campaignTitle,total:cleanedNumbers.length,status:'starting'})
        setIsSending(true)
        setResult(null)

        try {
            const isCarousel = Boolean(selectedTemplateData?.components?.some(c => (c.type || '').toUpperCase() === 'CAROUSEL')) ||
                String(selectedTemplateData?.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(selectedTemplateData?.cards) && selectedTemplateData.cards.length > 0)

            const response = await api.post('/campaign/send', {
                campaignName: campaignTitle,
                template: formData.template,
                country: formData.country,
                numbers: cleanedNumbers,
                languageCode: languageCode,
                components: outboundComponents.length > 0 ? outboundComponents : undefined,
                customMediaUrl: isCarousel ? undefined : (selectedMediaBase64 || selectedMediaUrl || undefined),
                customCarouselMedia: selectedCarouselMedia || undefined,
                accountId: activeAccountId || undefined,
                featureKey: 'quick',
                background: true
            },{silent:true})

            const resData = response.data
            if (resData?.queued) {
                setResult({status:'queued',total:cleanedNumbers.length,sent:0,delivered:0,failed:0,failedNumbers:[],message:resData.message,campaignName:campaignTitle})
                window.dispatchEvent(new CustomEvent('campaign-submit-status',{
                    detail:{status:'queued',name:campaignTitle,total:cleanedNumbers.length,message:`${campaignTitle} will start sending to ${cleanedNumbers.length} recipient(s) in about 2 seconds.`}
                }))
                setFormData(prev=>({...prev,numbers:'',campaignName:''}))
                return
            }
            const resultsList = Array.isArray(resData?.results) ? resData.results : []

            resultsList.forEach(r => {
                if (r.messageId) {
                    dispatchedMap.current[String(r.messageId).trim()] = r.phone
                    dispatchedMap.current[String(r.messageId).replace(/^wamid\./i, '')] = r.phone
                }
            })

            const failedList = resultsList
                .filter(r => !r.success)
                .map(r => ({ phone: r.phone, error: r.error || 'Failed' }))

            setResult({
                status: 'completed',
                total: cleanedNumbers.length,
                sent: resData.sent ?? (cleanedNumbers.length - failedList.length),
                delivered: 0,
                failed: resData.failed ?? failedList.length,
                failedNumbers: failedList
            })

            if (failedList.length === 0) {
                setFormData({ ...formData, numbers: '', campaignName: '' })
            }
        } catch (error) {
            const errorMessage=error.response?.data?.message||error.message||'Campaign could not be started.'
            setQueueNotice({name:campaignTitle,total:cleanedNumbers.length,status:'error',message:errorMessage})
            setTimeout(()=>setQueueNotice(null),8000)
            setResult({
                status: 'error',
                total: cleanedNumbers.length,
                sent: 0,
                delivered: 0,
                failed: cleanedNumbers.length,
                failedNumbers: [{ phone: 'All', error: error.response?.data?.message || error.message }]
            })
        } finally {
            setIsSending(false)
            fetchCredits()
        }
    }

    const handleOpenScheduleModal = () => {
        setResult(null)
        setScheduleSuccessMsg('')

        if (!formData.template) {
            alert('Please select an official template first.')
            return
        }

        const cleanedNumbers = formData.numbers
            .split(/[\n,]+/)
            .map(n => n.trim().replace(/^\+/, '').replace(/\s+/g, ''))
            .filter(n => n.length >= 7)

        if (cleanedNumbers.length === 0) {
            alert('Please enter at least one valid phone number in the Numbers box.')
            return
        }

        setIsScheduleModalOpen(true)
    }

    const handleConfirmSchedule = async (scheduledDateTime) => {
        const rawNumbers = formData.numbers.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0)
        const cleanedNumbers = []
        const dialMatch = formData.country ? formData.country.match(/\+(\d+)/) : null
        const dialCode = dialMatch ? dialMatch[1] : ''

        for (const raw of rawNumbers) {
            let cleaned = raw.replace(/\D/g, '')
            if (cleaned.startsWith('0') && cleaned.length > 10) {
                cleaned = cleaned.replace(/^0+/, '')
            }
            if (dialCode) {
                if (cleaned.length === 10) {
                    cleanedNumbers.push(dialCode + cleaned)
                } else if (cleaned.startsWith(dialCode) && cleaned.length === (dialCode.length + 10)) {
                    cleanedNumbers.push(cleaned)
                } else if (cleaned.startsWith(dialCode) && cleaned.length >= 11 && cleaned.length <= 15) {
                    cleanedNumbers.push(cleaned)
                } else if (cleaned.length >= 7 && cleaned.length <= 12) {
                    cleanedNumbers.push(dialCode + cleaned)
                }
            } else {
                if (cleaned.length >= 7) {
                    cleanedNumbers.push(cleaned)
                }
            }
        }

        if (cleanedNumbers.length === 0) {
            alert('Please enter at least one valid phone number.')
            return
        }

        setIsScheduling(true)
        setScheduleSuccessMsg('')
        setResult(null)

        const templateLang = selectedTemplateData?.language || templates.find(t => t.name === formData.template)?.language || 'en_US'

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
            const defaultName = `Quick Campaign ${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`
            const campaignName = formData.campaignName?.trim()
                ? (formData.campaignName.trim().toLowerCase().startsWith('quick') ? formData.campaignName.trim() : `Quick Campaign (${formData.campaignName.trim()})`)
                : defaultName
            const isCarousel = Boolean(selectedTemplateData?.components?.some(c => (c.type || '').toUpperCase() === 'CAROUSEL')) ||
                String(selectedTemplateData?.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(selectedTemplateData?.cards) && selectedTemplateData.cards.length > 0)

            const response = await api.post('/campaign/schedule', {
                campaignName,
                template: formData.template,
                languageCode: templateLang,
                country: formData.country,
                numbers: cleanedNumbers,
                components: outboundComponents.length > 0 ? outboundComponents : undefined,
                variables: variableValues,
                customMediaUrl: isCarousel ? undefined : (selectedMediaBase64 || selectedMediaUrl || undefined),
                customCarouselMedia: selectedCarouselMedia || undefined,
                scheduledAt: scheduledDateTime
            })

            setScheduleSuccessMsg(response.data?.message || 'Quick campaign scheduled successfully!')
            setIsScheduleModalOpen(false)
            fetchScheduledCampaigns()
        } catch (err) {
            console.error('Failed to schedule quick campaign:', err)
            alert(err.response?.data?.message || err.message || 'Failed to schedule campaign.')
        } finally {
            setIsScheduling(false)
        }
    }

    return (
        <div className="dashboard-content">
            {queueNotice&&<div style={{position:'fixed',top:20,right:20,zIndex:10000,width:'min(430px,calc(100vw - 32px))',padding:'16px 18px',borderRadius:'12px',background:queueNotice.status==='error'?'#fef2f2':'#eff6ff',border:`1px solid ${queueNotice.status==='error'?'#f87171':'#60a5fa'}`,color:queueNotice.status==='error'?'#991b1b':'#1e40af',boxShadow:'0 14px 36px rgba(15,23,42,.22)',display:'flex',gap:'12px',alignItems:'flex-start'}}><span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:30,height:30,borderRadius:'50%',background:queueNotice.status==='error'?'#dc2626':'#2563eb',color:'#fff',fontSize:18,flexShrink:0}}>{queueNotice.status==='starting'?'↻':queueNotice.status==='error'?'!':'✓'}</span><div style={{flex:1}}><strong style={{display:'block',fontSize:15,marginBottom:4}}>{queueNotice.status==='starting'?'Campaign sending is starting…':queueNotice.status==='error'?'Campaign could not start':'Campaign queued successfully'}</strong><div style={{fontSize:14,lineHeight:1.45}}>{queueNotice.status==='error'?queueNotice.message:<><strong>{queueNotice.name}</strong> {queueNotice.status==='starting'?'is being submitted':`will start sending to ${queueNotice.total} recipient(s) in about 2 seconds`}. You can continue using the application.</>}</div></div><button type="button" onClick={()=>setQueueNotice(null)} style={{border:0,background:'transparent',color:'inherit',fontSize:20,cursor:'pointer',padding:0}}>×</button></div>}
            <div className="quick-campaign-card">
                {/* Header with WhatsApp Icon */}
                <div className="quick-campaign-header">
                    <div className="whatsapp-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                            <path d="M19.007 4.93A9.873 9.873 0 0 0 12.008 2c-5.45 0-9.885 4.437-9.888 9.889A9.856 9.856 0 0 0 3.63 17.15l-1.587 5.8 5.937-1.557a9.88 9.88 0 0 0 4.73 1.206h.004c5.449 0 9.883-4.437 9.887-9.889a9.854 9.854 0 0 0-2.894-6.98ZM12.008 20.09h-.004a8.09 8.09 0 0 1-4.13-1.127l-.296-.176-3.064.803.818-2.99-.193-.307a8.082 8.082 0 0 1-1.24-4.51c0-4.469 3.637-8.106 8.108-8.106a8.094 8.094 0 0 1 5.733 2.378 8.092 8.092 0 0 1 2.373 5.737c-.003 4.47-3.64 8.108-8.105 8.108Zm4.573-6.248c-.25-.125-1.48-.73-1.708-.813-.228-.083-.393-.125-.56.125-.165.25-.642.813-.787.98-.145.166-.29.187-.54.062-.25-.125-1.056-.39-2.01-1.242-.743-.663-1.245-1.48-1.39-1.73-.146-.25-.016-.386.11-.51.112-.113.25-.292.374-.438.124-.146.166-.25.25-.417.083-.166.04-.312-.02-.437-.063-.125-.56-1.354-.768-1.854-.203-.488-.41-.422-.56-.43-.144-.008-.31-.008-.477-.008-.166 0-.435.062-.663.312-.228.25-.87.854-.87 2.083 0 1.23.896 2.417 1.02 2.583.125.167 1.763 2.693 4.27 3.774.597.257 1.063.41 1.426.525.6.19 1.147.163 1.579.098.482-.072 1.48-.604 1.688-1.187.208-.583.208-1.083.146-1.188-.063-.104-.229-.166-.479-.291z" />
                        </svg>
                    </div>
                    <h1>Quick WAPP Message</h1>
                </div>

                <div className="campaign-page-layout">
                    <div className="campaign-form-column">
                        <form onSubmit={handleSubmit}>
                            {/* Form Fields Row */}
                            <div className="form-row">
                                {/* Template Dropdown */}
                                <div className="form-field">
                                    <label className="field-label">Template:</label>
                                    <select
                                        id="template"
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

                                    {/* Helpful Message if no templates or error */}
                                    {templatesError && (
                                        <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '5px' }}>
                                            Error: {templatesError}
                                        </p>
                                    )}
                                    {!isLoadingTemplates && templates.length === 0 && !templatesError && (
                                        <div style={{ marginTop: '12px', fontSize: '13px', color: '#1e293b', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', padding: '14px', borderRadius: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                                <span style={{ fontSize: '18px' }}>ℹ️</span>
                                                <div>
                                                    <p style={{ margin: '0 0 4px 0', fontWeight: '600', color: '#0369a1', fontSize: '14px' }}>
                                                        No Meta WhatsApp Account Connected
                                                    </p>
                                                    <p style={{ margin: '0 0 10px 0', color: '#334155', lineHeight: '1.4' }}>
                                                        No WhatsApp Business Account details found for your account. Please enter your Meta WABA ID, Phone Number ID, and Access Token to connect your Facebook page templates.
                                                    </p>
                                                    <a
                                                        href="/setting/manage-numbers"
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            backgroundColor: '#2563eb',
                                                            color: '#ffffff',
                                                            padding: '8px 14px',
                                                            borderRadius: '6px',
                                                            textDecoration: 'none',
                                                            fontWeight: '600',
                                                            fontSize: '12px',
                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                        }}
                                                    >
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <line x1="12" y1="5" x2="12" y2="19" />
                                                            <line x1="5" y1="12" x2="19" y2="12" />
                                                        </svg>
                                                        Enter Details & Connect Account
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Campaign Name */}
                                <div className="form-field">
                                    <label className="field-label">Campaign Name</label>
                                    <input
                                        type="text"
                                        name="campaignName"
                                        value={formData.campaignName}
                                        onChange={handleChange}
                                        placeholder="enter text"
                                        className="form-input"
                                    />
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

                            {/* Numbers Textarea */}
                            <div className="numbers-section" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label className="field-label" style={{ margin: 0 }}>Numbers</label>
                                    {formData.numbers.trim() && (
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                            {formData.numbers.split(/[\n,]+/).filter(n => n.trim()).length} Recipient(s)
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    name="numbers"
                                    value={formData.numbers}
                                    onChange={handleChange}
                                    onPaste={handleNumbersPaste}
                                    onBlur={handleNumbersBlur}
                                    placeholder="Enter phone numbers here (one per line or comma-separated, without country code)..."
                                    rows="4"
                                    className="form-textarea"
                                />
                                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                                    ℹ️ Only numbers are accepted. Text, special characters, and country codes (+91) are automatically removed.
                                </p>
                            </div>

                            {/* Media & Message Section */}
                            {isTemplateMediaHeader(selectedTemplateData) ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', marginBottom: '16px' }}>
                                    {/* Left Column: Upload Media */}
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

                                    {/* Right Column: Message */}
                                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column' }}>
                                        <label className="field-label" style={{ marginBottom: '8px', fontWeight: '700', color: '#334155' }}>Message</label>
                                        <textarea
                                            name="messageText"
                                            value={formData.messageText}
                                            onChange={handleChange}
                                            rows="6"
                                            className="form-textarea"
                                            style={{ flex: 1, resize: 'vertical' }}
                                            readOnly
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="numbers-section" style={{ marginTop: '16px', marginBottom: '16px' }}>
                                    <label className="field-label">Message</label>
                                    <textarea
                                        name="messageText"
                                        value={formData.messageText}
                                        onChange={handleChange}

                                        rows="4"
                                        className="form-textarea"
                                        readOnly
                                    />
                                </div>
                            )}

                            {/* Dynamic Variable Inputs with History & Auto-Suggestion */}
                            <TemplateVariablesInput
                                variables={variables}
                                variableValues={variableValues}
                                onVariableChange={handleVariableChange}
                            />

                            {/* Template Buttons Preview */}
                            {templateButtons.length > 0 && (
                                <div style={{ marginTop: '16px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                                    {templateButtons.map((btn, idx) => (
                                        <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '8px', fontSize: '13px' }}>
                                            <span style={{ fontWeight: '700', color: '#1e293b' }}>
                                                {btn.type === 'PHONE_NUMBER' ? '📞' : btn.type === 'URL' ? '🌐' : '💬'} {btn.text}
                                            </span>
                                            {(btn.phone_number || btn.url) && (
                                                <span style={{ color: '#64748b', fontSize: '12px', borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                                                    {btn.phone_number || btn.url}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Credit Indicator / Subscription Validity Badge */}
                            <div style={{ marginTop: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                    {creditsData?.isDaysBased ? 'Subscription Validity:' : 'Available Credits:'}
                                </span>
                                <CreditsBadge creditsData={creditsData} featureKey="quick" loading={isLoadingCredits} />
                            </div>

                            {/* Action Buttons */}
                            <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    type="submit"
                                    className="btn-send-now"
                                    disabled={isSending || isScheduling || (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.quick === 0))}
                                >
                                    {isSending ? 'Starting campaign…' : queueNotice?.status==='queued' ? 'Queued ✓' : 'Send Now'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-schedule"
                                    onClick={handleOpenScheduleModal}
                                    disabled={isSending || isScheduling || (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.quick === 0))}
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

                            {/* Schedule Success Message */}
                            {scheduleSuccessMsg && (
                                <div style={{ marginTop: '16px', padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '8px', color: '#047857', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>✅</span>
                                    <span>{scheduleSuccessMsg}</span>
                                </div>
                            )}

                            {/* Progress & Result Display */}
                            {isSending && (
                                <div className="campaign-progress" style={{ marginTop: '20px' }}>
                                    <p style={{ marginBottom: '8px', fontWeight: 'bold', color: '#10b981' }}>Sending in progress, please wait...</p>
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

                            {result?.status==='queued'&&<div style={{marginTop:20,padding:'14px 16px',borderRadius:10,background:'#eff6ff',border:'1px solid #93c5fd',color:'#1d4ed8',fontWeight:600}}>⚡ Campaign accepted and queued for high-speed sending. Sending starts in 2 seconds. Live completion notification will appear once finished.</div>}
                            {result && result.status === 'completed' && (
                                <div className="campaign-result" style={{ marginTop: '20px' }}>
                                    <div style={{
                                        padding: '16px',
                                        backgroundColor: result.failed > 0 ? '#fef2f2' : (result.delivered > 0 ? '#f0fdf4' : '#f0fdf4'),
                                        color: result.failed > 0 ? '#991b1b' : '#166534',
                                        borderRadius: '8px',
                                        border: `1px solid ${result.failed > 0 ? '#fca5a5' : '#86efac'}`
                                    }}>
                                        <h3 style={{ margin: '0 0 10px 0', fontSize: '17px', fontWeight: '700' }}>
                                            {result.failed > 0
                                                ? `⚠️ Delivery Alert: ${result.failed} Recipient(s) Failed`
                                                : (result.delivered > 0 ? '✅ Message Delivered Successfully' : '🚀 Message Dispatched to WhatsApp')}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginBottom: result.failed > 0 ? '12px' : '0' }}>
                                            <span><strong>Total:</strong> {result.total}</span>
                                            <span style={{ color: '#059669' }}><strong>Dispatched:</strong> {result.sent}</span>
                                            {result.delivered > 0 && (
                                                <span style={{ color: '#047857' }}><strong>Delivered:</strong> {result.delivered}</span>
                                            )}
                                            {result.failed > 0 && (
                                                <span style={{ color: '#dc2626' }}><strong>Failed:</strong> {result.failed}</span>
                                            )}
                                        </div>
                                        {result.failed > 0 && result.failedNumbers && result.failedNumbers.length > 0 && (
                                            <div style={{
                                                backgroundColor: '#fff',
                                                border: '1px solid #fed7d7',
                                                borderRadius: '6px',
                                                padding: '10px 14px',
                                                fontSize: '13px',
                                                color: '#b91c1c'
                                            }}>
                                                <strong>Failure Reason from Meta:</strong>
                                                <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
                                                    {result.failedNumbers.map((fn, idx) => (
                                                        <li key={idx}><strong>{fn.phone}:</strong> {fn.error}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Scheduled Campaigns List */}
                            {scheduledCampaigns.length > 0 && (
                                <div style={{ marginTop: '25px', padding: '16px 20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>🗓️</span> Upcoming Scheduled Campaigns ({scheduledCampaigns.length})
                                    </h3>
                                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #0f766e' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#0f766e', color: '#ffffff' }}>
                                                    <th style={{ padding: '10px 14px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}>CAMPAIGN</th>
                                                    <th style={{ padding: '10px 14px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}>TEMPLATE</th>
                                                    <th style={{ padding: '10px 14px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}>TOTAL NUMBERS</th>
                                                    <th style={{ padding: '10px 14px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}>SCHEDULED FOR</th>
                                                    <th style={{ padding: '10px 14px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}>SENDS IN</th>
                                                    <th style={{ padding: '10px 14px', fontWeight: '700', fontSize: '12px', letterSpacing: '0.5px' }}>ACTION</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {scheduledCampaigns.map((sc, idx) => (
                                                    <tr key={sc.id} style={{ borderBottom: idx === scheduledCampaigns.length - 1 ? 'none' : '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                        <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1e293b' }}>{sc.campaign_name}</td>
                                                        <td style={{ padding: '12px 14px', color: '#334155' }}>{sc.template_name}</td>
                                                        <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '600' }}>{sc.total_numbers}</td>
                                                        <td style={{ padding: '12px 14px', color: '#334155' }}>
                                                            {new Date(sc.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                        </td>
                                                        <td style={{ padding: '12px 14px' }}>
                                                            <CampaignCountdownTimer scheduledAt={sc.scheduled_at} onExpire={fetchScheduledCampaigns} />
                                                        </td>
                                                        <td style={{ padding: '12px 14px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCancelSchedule(sc.id)}
                                                                style={{ padding: '4px 12px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
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

                    {/* Right Column: Live Mobile Preview Frame */}
                    <div className="campaign-preview-column">
                        <WhatsAppMobilePreview
                            template={selectedTemplateData}
                            messageText={getPreviewMessageText(formData.messageText)}
                            customMediaUrl={selectedMediaUrl}
                            customCarouselMedia={selectedCarouselMedia}
                        />
                    </div>
                </div>

                {/* Schedule Modal */}
                <ScheduleModal
                    isOpen={isScheduleModalOpen}
                    onClose={() => setIsScheduleModalOpen(false)}
                    onConfirm={handleConfirmSchedule}
                    numbersCount={formData.numbers.split(/[\n,]+/).map(n => n.trim()).filter(Boolean).length || 1}
                />
            </div>
        </div>
    )
}
