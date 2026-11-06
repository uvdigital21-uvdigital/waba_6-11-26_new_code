import React, { useState, useEffect, useRef } from 'react'
import api from '../services/api.js'
import { useTitle } from '../context/TitleContext.jsx'
import * as XLSX from 'xlsx'
import PhonePreview from '../components/PhonePreview.jsx'
import WhatsAppMobilePreview from '../components/WhatsAppMobilePreview.jsx'
import MediaHeaderUpload, { isTemplateMediaHeader } from '../components/MediaHeaderUpload.jsx'
import CreditsBadge from '../components/CreditsBadge.jsx'
import TemplateVariablesInput from '../components/TemplateVariablesInput.jsx'
import { ALL_COUNTRIES } from '../constants/metaConstants.js'
import './Campaigns.css'

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
                            <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0 }}>Schedule CSV Campaign</h3>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>Targeting {numbersCount} contact(s)</p>
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
                                background: isValid ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#94a3b8',
                                color: '#ffffff', cursor: isValid ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '13px',
                                boxShadow: isValid ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
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

// ---------- Main Component ----------
export default function SendCsv() {
    const { setTitle } = useTitle()
    const [fileName, setFileName] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)
    const [parsedRows, setParsedRows] = useState([])
    const [availableColumns, setAvailableColumns] = useState([
        { letter: 'A', index: 0, label: 'Column A' },
        { letter: 'B', index: 1, label: 'Column B' },
        { letter: 'C', index: 2, label: 'Column C' }
    ])

    const [formData, setFormData] = useState({
        template: '',
        messageText: '',
        country: 'India(+91)',
        mobileColumn: 'A',
        mediaColumn: 'NA'
    })
    const [isDragging, setIsDragging] = useState(false)
    const [templates, setTemplates] = useState([])
    const [templatesError, setTemplatesError] = useState(null)
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)
    const [selectedTemplateData, setSelectedTemplateData] = useState(null)
    const [isLoadingPreview, setIsLoadingPreview] = useState(false)
    const [activeAccountId, setActiveAccountId] = useState(null)
    const [senderNumbers, setSenderNumbers] = useState([])

    const [isSending, setIsSending] = useState(false)
    const [sendResult, setSendResult] = useState(null)
    const [sendError, setSendError] = useState('')

    // Synchronous guard against double-submission (double-click / accidental
    // double form-fire). React state (isSending) updates asynchronously, so
    // there is a small window where two clicks can both pass the isSending
    // check before the first re-render lands — this ref closes that window
    // immediately, with no re-render delay.
    const sendingRef = useRef(false)

    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [isScheduling, setIsScheduling] = useState(false)
    const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState('')
    const [scheduledCampaigns, setScheduledCampaigns] = useState([])

    const [variables, setVariables] = useState([])
    const [variableValues, setVariableValues] = useState({})

    const [selectedMediaUrl, setSelectedMediaUrl] = useState(null)
    const [selectedMediaFile, setSelectedMediaFile] = useState(null)
    const [selectedMediaBase64, setSelectedMediaBase64] = useState(null)
    const [selectedCarouselMedia, setSelectedCarouselMedia] = useState(null)

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
        setTitle('Send CSV Campaign')
        fetchMetaTemplates()
        fetchScheduledCampaigns()
        fetchCredits()
    }, [setTitle])

    const fetchScheduledCampaigns = async () => {
        try {
            const response = await api.get('/campaign/scheduled?type=csv', { silent: true })
            if (response.data && Array.isArray(response.data.data)) {
                const csvList = response.data.data.filter(sc =>
                    !sc.campaign_name || sc.campaign_name.toLowerCase().startsWith('csv')
                )
                setScheduledCampaigns(csvList)
            }
        } catch (err) {
            console.error('Failed to load scheduled campaigns:', err)
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

    const handleChange = (e) => {
        const { name, value } = e.target

        // When template changes, fetch full details with components & auto-populate message text
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

    const processUploadedFile = (file) => {
        if (!file) return
        setSelectedFile(file)
        setFileName(file.name)
        setSendResult(null)
        setSendError(null)
        setScheduleSuccessMsg(null)

        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result)
                const workbook = XLSX.read(data, { type: 'array' })
                const firstSheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[firstSheetName]
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

                if (!rawRows || rawRows.length === 0) {
                    setParsedRows([])
                    return
                }

                setParsedRows(rawRows)

                // Determine maximum columns in file
                let maxCols = 0
                rawRows.forEach(row => {
                    if (Array.isArray(row) && row.length > maxCols) {
                        maxCols = row.length
                    }
                })

                if (maxCols === 0) maxCols = 3

                // Generate column choices (A, B, C, D...)
                const cols = []
                const firstRow = rawRows[0] || []
                let defaultMobileCol = ''

                for (let i = 0; i < Math.max(maxCols, 3); i++) {
                    const letter = String.fromCharCode(65 + i)
                    const headerVal = firstRow[i] !== undefined && firstRow[i] !== null ? String(firstRow[i]).trim() : ''
                    const label = headerVal ? `${letter} (${headerVal})` : `Column ${letter}`
                    cols.push({ letter, index: i, label })

                    // Auto-detect phone/mobile column by header name
                    if (headerVal && !defaultMobileCol) {
                        const lowerHeader = headerVal.toLowerCase()
                        if (
                            lowerHeader.includes('mobile') ||
                            lowerHeader.includes('phone') ||
                            lowerHeader.includes('number') ||
                            lowerHeader.includes('contact') ||
                            lowerHeader.includes('cell') ||
                            lowerHeader.includes('wa') ||
                            lowerHeader.includes('whatsapp')
                        ) {
                            defaultMobileCol = letter
                        }
                    }
                }

                // If no header keyword matched, pick column with most numeric values
                if (!defaultMobileCol && cols.length > 0) {
                    let bestCol = cols[0].letter
                    let maxNumericCount = -1

                    cols.forEach(col => {
                        let numCount = 0
                        rawRows.forEach(row => {
                            if (Array.isArray(row) && row[col.index] !== undefined && row[col.index] !== null) {
                                const str = String(row[col.index]).trim()
                                const digits = str.replace(/[^0-9]/g, '')
                                if (!/[a-zA-Z]/.test(str) && digits.length >= 7) {
                                    numCount++
                                }
                            }
                        })
                        if (numCount > maxNumericCount) {
                            maxNumericCount = numCount
                            bestCol = col.letter
                        }
                    })

                    defaultMobileCol = bestCol
                }

                setAvailableColumns(cols)
                if (defaultMobileCol) {
                    setFormData(prev => ({ ...prev, mobileColumn: defaultMobileCol }))
                }
            } catch (err) {
                console.error('Error parsing file:', err)
                setSendError('Failed to parse CSV/Excel file. Please check the file format.')
            }
        }
        reader.readAsArrayBuffer(file)
    }

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            processUploadedFile(e.target.files[0])
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0]
            if (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
                processUploadedFile(file)
            } else {
                alert('Please upload a CSV or Excel file')
            }
        }
    }

    const extractPhoneNumbers = () => {
        if (!parsedRows || parsedRows.length === 0) return []

        const colLetter = formData.mobileColumn || 'A'
        const colObj = availableColumns.find(c => c.letter === colLetter)
        const colIndex = colObj ? colObj.index : (colLetter.charCodeAt(0) - 65)

        const countryDigits = formData.country ? formData.country.replace(/[^0-9]/g, '') : '91'

        const numbers = []
        parsedRows.forEach((row) => {
            if (!Array.isArray(row) || row[colIndex] === undefined || row[colIndex] === null) return

            const val = String(row[colIndex]).trim()
            if (!val) return

            // Skip cells containing alphabetic characters (e.g. 'name', 'harsh', 'number1', etc.)
            if (/[a-zA-Z]/.test(val)) {
                return
            }

            let digitsOnly = val.replace(/[^0-9]/g, '')
            if (!digitsOnly) return

            // Strip leading zero for 11-digit local entries (e.g., 09913847423 -> 9913847423)
            if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
                digitsOnly = digitsOnly.slice(1)
            }

            // Valid phone numbers must have between 7 and 15 digits
            if (digitsOnly.length < 7 || digitsOnly.length > 15) {
                return
            }

            let formattedNumber = digitsOnly
            if (countryDigits) {
                if (digitsOnly.length === 10) {
                    formattedNumber = `${countryDigits}${digitsOnly}`
                } else if (!digitsOnly.startsWith(countryDigits) && digitsOnly.length < 11) {
                    formattedNumber = `${countryDigits}${digitsOnly}`
                }
            }

            numbers.push(formattedNumber)
        })

        return numbers
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Synchronous guard — blocks a second click/submit that fires before
        // React has re-rendered with isSending = true. This is the actual
        // fix for the double-click race that caused campaigns to send twice.
        if (sendingRef.current) return
        sendingRef.current = true

        setSendError(null)
        setSendResult(null)
        setScheduleSuccessMsg(null)

        if (!formData.template) {
            alert('Please select an official template first.')
            sendingRef.current = false
            return
        }

        if (!selectedFile && parsedRows.length === 0) {
            alert('Please upload a CSV or Excel file containing phone numbers.')
            sendingRef.current = false
            return
        }

        const numbers = extractPhoneNumbers()
        if (numbers.length === 0) {
            alert(`No valid phone numbers found in Column ${formData.mobileColumn}. Please check your file.`)
            sendingRef.current = false
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
            const campaignName = `CSV Campaign ${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`
            const isCarousel = Boolean(selectedTemplateData?.components?.some(c => (c.type || '').toUpperCase() === 'CAROUSEL')) ||
                String(selectedTemplateData?.template_type || '').toLowerCase() === 'carousel' ||
                (Array.isArray(selectedTemplateData?.cards) && selectedTemplateData.cards.length > 0);

            // Unique per submit attempt. Sent to the backend so it can reject
            // an exact duplicate request even if this frontend guard is
            // somehow bypassed (e.g. a network-level retry).
            const idempotencyKey = (window.crypto && window.crypto.randomUUID)
                ? window.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`

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
                featureKey: 'csv',
                accountId: activeAccountId || undefined,
                background: true
            }, {
                headers: { 'Idempotency-Key': idempotencyKey },silent:true
            })

            setSendResult(response.data)
            if(response.data?.queued)window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'queued',name:campaignName,total:numbers.length,message:`${campaignName} will start sending to ${numbers.length} recipient(s) in about 2 seconds.`}}))
        } catch (err) {
            console.error('Campaign sending failed:', err)
            window.dispatchEvent(new CustomEvent('campaign-submit-status',{detail:{status:'error',message:err.response?.data?.message||err.message}}))
            if (err.response?.status === 409) {
                setSendError('This campaign was already submitted a moment ago — duplicate send blocked.')
            } else {
                const errorMsg = err.response?.data?.message || err.message || 'Failed to send campaign messages.'
                setSendError(errorMsg)
            }
        } finally {
            setIsSending(false)
            sendingRef.current = false
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

        if (!selectedFile && parsedRows.length === 0) {
            alert('Please upload a CSV or Excel file containing phone numbers.')
            return
        }

        const numbers = extractPhoneNumbers()
        if (numbers.length === 0) {
            alert(`No valid phone numbers found in Column ${formData.mobileColumn}. Please check your file.`)
            return
        }

        setIsScheduleModalOpen(true)
    }

    const handleConfirmSchedule = async (scheduledDateTime) => {
        const numbers = extractPhoneNumbers()
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
            const campaignName = `CSV Campaign ${new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}`
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
            <div className="csv-campaign-card">
                {/* Header */}
                <div className="csv-campaign-header">
                    <div className="csv-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                        </svg>
                    </div>
                    <h1>WAPP Message By CSV</h1>
                </div>

                {/* Main layout: form + phone preview side by side */}
                <div className="csv-main-layout">
                    {/* Left: Form */}
                    <div className="csv-form-col">
                        <form onSubmit={handleSubmit}>
                            {/* Template Selection Row */}
                            <div className="form-row">
                                {/* Template Dropdown */}
                                <div className="form-field">
                                    <label className="field-label">Template:</label>
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
                                    {!isLoadingTemplates && templates.length === 0 && !templatesError && (
                                        <div style={{ marginTop: '10px', fontSize: '13px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '4px' }}>
                                            <p style={{ margin: '0 0 5px 0' }}><strong>No approved templates found in Meta.</strong></p>
                                            <p style={{ margin: 0 }}>Create templates in your <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>WhatsApp Manager</a>. Once approved, click the refresh button above.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Media Link Column - Only show when template has a media header */}
                                {isTemplateMediaHeader(selectedTemplateData) && (
                                    <div className="form-field">
                                        <label className="field-label">
                                            Select Media Link Column(optional)
                                            <span className="help-link">Help</span>
                                        </label>
                                        <div className="select-wrapper">
                                            <select
                                                name="mediaColumn"
                                                value={formData.mediaColumn}
                                                onChange={handleChange}
                                                className="form-select"
                                            >
                                                <option value="NA">NA</option>
                                                {availableColumns.map((col) => (
                                                    <option key={col.letter} value={col.letter}>
                                                        {col.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* File Upload Section */}
                            <div className="upload-section">
                                <label className="section-label">
                                    Upload Number CSV/Excel File: (Max size 20MB)
                                </label>
                                <div
                                    className={`file-upload-area ${isDragging ? 'dragging' : ''} ${fileName ? 'has-file' : ''}`}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                >
                                    <div className="upload-content">
                                        <div className="upload-icon">📊</div>
                                        {fileName ? (
                                            <div>
                                                <p className="upload-text" style={{ color: '#10b981', fontWeight: '600', marginBottom: '4px' }}>{fileName}</p>
                                                {parsedRows.length > 0 && (
                                                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                                                        Loaded {parsedRows.length} rows ({extractPhoneNumbers().length} numbers ready)
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="upload-text">Drag &amp; Drop files(mobile numbers)</p>
                                        )}
                                        <label htmlFor="csv-upload" className="browse-link" style={{ marginTop: '8px' }}>
                                            {fileName ? 'Change File' : 'Browse Files'}
                                        </label>
                                        <input
                                            type="file"
                                            accept=".csv,.xls,.xlsx"
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                            id="csv-upload"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Column Selection */}
                            <div className="mobile-column-section">
                                <label className="section-label">Select Mobile Column</label>
                                <div className="mobile-column-row">
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
                                    <div className="select-wrapper">
                                        <select
                                            name="mobileColumn"
                                            value={formData.mobileColumn}
                                            onChange={handleChange}
                                            className="form-select"
                                        >
                                            {availableColumns.map((col) => (
                                                <option key={col.letter} value={col.letter}>
                                                    {col.label}
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
                                            value={formData.messageText || ''}
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
                                        value={formData.messageText || ''}
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
                                        <div style={{ marginTop: '10px', fontSize: '13px' }}>
                                            <strong style={{ color: '#b91c1c' }}>Failed numbers:</strong>
                                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#991b1b' }}>
                                                {sendResult.results.filter(r => !r.success).map((r, i) => (
                                                    <li key={i}>{r.phone}: {r.error}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Credit Indicator / Subscription Validity Badge */}
                            <div style={{ marginTop: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                    {creditsData?.isDaysBased ? 'Subscription Validity:' : 'Available Credits:'}
                                </span>
                                <CreditsBadge creditsData={creditsData} featureKey="csv" loading={isLoadingCredits} />
                            </div>

                            {/* Action Buttons */}
                            <div className="csv-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    type="submit"
                                    className="btn-send-now"
                                    disabled={isSending || isScheduling || (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.csv === 0))}
                                >
                                    {isSending ? 'Sending...' : 'Send Now'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-schedule"
                                    onClick={handleOpenScheduleModal}
                                    disabled={isSending || isScheduling || (creditsData?.isDaysBased ? creditsData.isExpired : (creditsData && !creditsData.isUnlimited && creditsData.features?.csv === 0))}
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
            </div>

            {/* Schedule Modal */}
            <ScheduleModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                onConfirm={handleConfirmSchedule}
                numbersCount={extractPhoneNumbers().length}
            />
        </div>
    )
}
