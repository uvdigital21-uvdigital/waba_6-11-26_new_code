import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTitle } from '../context/TitleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import './Template.css'

import { API_BASE_URL } from '../config.js'
import { ALL_LANGUAGES } from '../constants/metaConstants.js'

const API_BASE = API_BASE_URL

const BUTTON_TYPES = [
    { value: 'CALL_TO_ACTION', label: 'Call to action' },
    { value: 'URL_LINK', label: 'URL Link' },
    { value: 'QUICK_REPLY', label: 'Quick reply' },
    { value: 'COPY_CODE', label: 'Copy Code' },
    { value: 'FLOW', label: 'Flow' },
    { value: 'CATALOG', label: 'Catalog' },
]

const MAX_BUTTONS = 10
const MAX_BUTTON_TEXT = 25

export default function AddOfficialTemplate() {
    const navigate = useNavigate()
    const { id: paramId } = useParams()
    const [searchParams] = useSearchParams()
    const editId = paramId || searchParams.get('id')

    const { setTitle } = useTitle()
    const { user } = useAuth()
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        message: '',
        category: 'UTILITY',
        templateType: 'text',
        language: 'en',
        footer: '',
        buttons: []
    })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [variableCount, setVariableCount] = useState(0)
    const [variableSamples, setVariableSamples] = useState({})
    const messageRef = useRef(null)
    const mediaInputRef = useRef(null)
    const [selectionStart, setSelectionStart] = useState(0)
    const [showButtonDropdown, setShowButtonDropdown] = useState(false)
    const buttonDropdownRef = useRef(null)

    const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
    const [mediaFileName, setMediaFileName] = useState('')
    const [mediaType, setMediaType] = useState('image')

    const [cards, setCards] = useState([
        { id: 1, headerMedia: '', body: 'Card 1 Details', mediaFileName: '', mediaPreviewUrl: '', mediaType: 'image', actionType: 'QUICK_REPLY', actionLabel: 'View Details', actionValue: '', buttons: [{ type: 'QUICK_REPLY', text: 'View Details' }] },
        { id: 2, headerMedia: '', body: 'Card 2 Details', mediaFileName: '', mediaPreviewUrl: '', mediaType: 'image', actionType: 'QUICK_REPLY', actionLabel: 'View Details', actionValue: '', buttons: [{ type: 'QUICK_REPLY', text: 'View Details' }] }
    ])

    // Dynamic connected number / user display name state
    const [accountName, setAccountName] = useState(() => {
        try {
            const stored = localStorage.getItem('active_wa_account_name')
            if (stored) return stored
            const userStr = localStorage.getItem('wa_dashboard_user')
            if (userStr) {
                const u = JSON.parse(userStr)
                return u.company_name || u.name || u.username || 'Official WhatsApp Account'
            }
        } catch (_) { }
        return 'Official WhatsApp Account'
    })

    useEffect(() => {
        const token = localStorage.getItem('wa_dashboard_token')
        const selectedId = localStorage.getItem('active_wa_account_id')
        if (token) {
            fetch(`${API_BASE}/numbers`, {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    const list = data.numbers || data.data || data.whatsapp_accounts || []
                    if (list.length > 0) {
                        const match = selectedId ? list.find(a => String(a.id) === String(selectedId)) || list[0] : list[0]
                        const name = match.verified_name || match.name || match.display_phone_number || match.wa_number
                        if (name) {
                            setAccountName(name)
                            localStorage.setItem('active_wa_account_name', name)
                        }
                    }
                })
                .catch(() => { })
        }
    }, [])

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('wa_dashboard_token')
        return token ? { Authorization: `Bearer ${token}` } : {}
    }, [])

    useEffect(() => {
        if (editId) {
            setTitle('Edit Official Template')
            // Load existing template
            fetch(`${API_BASE}/templates/${editId}`, {
                headers: getAuthHeaders()
            })
                .then(res => res.json())
                .then(data => {
                    if (data?.template) {
                        const t = data.template
                        setNewTemplate({
                            name: t.name || t.template || '',
                            message: t.message || '',
                            category: t.category || 'UTILITY',
                            templateType: t.template_type || (t.header_media_url ? 'media' : 'text'),
                            language: t.language || 'en',
                            footer: t.footer || '',
                            buttons: Array.isArray(t.buttons)
                                ? t.buttons.map(b => ({
                                    ...b,
                                    id: b.id || Date.now() + Math.random(),
                                    urlType: (b.urlType || b.url_type || 'STATIC').toUpperCase()
                                }))
                                : []
                        })
                        if (t.header_media_url) {
                            setMediaPreviewUrl(t.header_media_url.startsWith('http') ? t.header_media_url : `${API_BASE}${t.header_media_url}`)
                            setMediaType(t.media_type || 'image')
                        }
                        if (Array.isArray(t.cards) && t.cards.length > 0) {
                            const normalizedCards = t.cards.map((c, i) => {
                                let cardBody = c.body || `Card ${i + 1}`;
                                let cardMedia = c.headerMedia || c.media_url || '';
                                let cardBtns = Array.isArray(c.buttons) ? c.buttons : [];
                                let detectedFormat = c.mediaType || 'image';

                                if (c.components) {
                                    const bComp = c.components.find(comp => (comp.type || '').toUpperCase() === 'BODY');
                                    const hComp = c.components.find(comp => (comp.type || '').toUpperCase() === 'HEADER');
                                    const btnComp = c.components.find(comp => (comp.type || '').toUpperCase() === 'BUTTONS');
                                    if (bComp?.text) cardBody = bComp.text;
                                    // Prefer our persisted local media. Meta header_handle values are
                                    // often opaque upload handles and are not displayable image URLs.
                                    if (!cardMedia && hComp?.example?.header_handle?.[0]) cardMedia = hComp.example.header_handle[0];
                                    else if (hComp?.media_url) cardMedia = hComp.media_url;
                                    if (hComp?.format) detectedFormat = hComp.format.toLowerCase();
                                    if (cardBtns.length === 0 && btnComp?.buttons) cardBtns = btnComp.buttons;
                                }

                                if (typeof cardMedia === 'string' && (cardMedia.includes('.mp4') || cardMedia.includes('video'))) {
                                    detectedFormat = 'video';
                                }

                                const previewUrl = cardMedia
                                    ? (cardMedia.startsWith('http') || cardMedia.startsWith('data:')
                                        ? cardMedia
                                        : `${API_BASE.replace('/api', '')}${cardMedia.startsWith('/') ? '' : '/'}${cardMedia}`)
                                    : '';

                                const normalizedButtons = (Array.isArray(cardBtns) ? cardBtns : []).map(button => ({
                                    ...button,
                                    phoneNumber: button.phoneNumber || button.phone_number || ''
                                }));
                                const firstButton = normalizedButtons[0] || { type: 'QUICK_REPLY', text: '' };
                                const actionType = firstButton.type === 'URL_LINK' ? 'URL' : firstButton.type === 'CALL_TO_ACTION' ? 'PHONE_NUMBER' : (firstButton.type || 'QUICK_REPLY');
                                return {
                                    id: c.id || Date.now() + i,
                                    body: cardBody,
                                    headerMedia: cardMedia,
                                    mediaFileName: cardMedia ? cardMedia.split('/').pop().split('?')[0] : '',
                                    mediaPreviewUrl: previewUrl,
                                    mediaType: detectedFormat,
                                    actionType,
                                    actionLabel: firstButton.text || 'View Details',
                                    actionValue: actionType === 'URL' ? (firstButton.url || '') : actionType === 'PHONE_NUMBER' ? (firstButton.phoneNumber || firstButton.phone_number || '') : '',
                                    buttons: normalizedButtons
                                };
                            });
                            setCards(normalizedCards);
                        }
                    }
                })
                .catch(err => console.error('Failed to load template for edit:', err))
        } else {
            setTitle('Add Official Template')
        }
    }, [editId, setTitle, getAuthHeaders])

    const detectedVariables = useMemo(() => {
        const msg = newTemplate.message || ''
        const matches = msg.match(/\{\{(\d+)\}\}/g) || []
        const nums = [...new Set(matches.map(m => m.replace(/\D/g, '')))].sort((a, b) => Number(a) - Number(b))
        return nums
    }, [newTemplate.message])

    const updateSelectionStart = () => {
        if (messageRef.current) {
            setSelectionStart(messageRef.current.selectionStart)
        }
    }

    const wrapSelection = (prefix, suffix, defaultText = '') => {
        const textarea = messageRef.current
        if (!textarea) return
        const start = textarea.selectionStart ?? 0
        const end = textarea.selectionEnd ?? 0
        const currentMessage = newTemplate.message || ''
        const selectedText = currentMessage.substring(start, end)
        const textToWrap = selectedText || defaultText
        const replacement = `${prefix}${textToWrap}${suffix}`
        const newMessage = currentMessage.substring(0, start) + replacement + currentMessage.substring(end)

        if (newMessage.length <= 1024) {
            setNewTemplate(prev => ({ ...prev, message: newMessage }))
            setTimeout(() => {
                textarea.focus()
                if (selectedText) {
                    textarea.setSelectionRange(start, start + replacement.length)
                } else {
                    textarea.setSelectionRange(start + prefix.length, start + prefix.length + textToWrap.length)
                }
            }, 0)
        }
    }

    const handleAddVariable = () => {
        let nextVar = 1
        if (detectedVariables.length > 0) {
            nextVar = Math.max(...detectedVariables.map(Number)) + 1
        }

        const textarea = messageRef.current
        if (!textarea) return
        const start = textarea.selectionStart ?? 0
        const end = textarea.selectionEnd ?? 0
        const currentMessage = newTemplate.message || ''

        const prevChar = start > 0 ? currentMessage[start - 1] : ''
        const nextChar = end < currentMessage.length ? currentMessage[end] : ''
        const leadSpace = (prevChar && !/\s/.test(prevChar)) ? ' ' : ''
        const trailSpace = (nextChar && !/\s/.test(nextChar)) ? ' ' : ' '

        const varText = `${leadSpace}{{${nextVar}}}${trailSpace}`
        const newMessage = currentMessage.substring(0, start) + varText + currentMessage.substring(end)

        if (newMessage.length <= 1024) {
            setNewTemplate(prev => ({ ...prev, message: newMessage }))
            setVariableSamples(prev => ({ ...prev, [nextVar]: prev[nextVar] || '' }))
            setTimeout(() => {
                textarea.focus()
                textarea.setSelectionRange(start + varText.length, start + varText.length)
            }, 0)
        }
    }

    const handleBold = () => wrapSelection('*', '*', 'bold text')
    const handleItalic = () => wrapSelection('_', '_', 'italic text')
    const handleStrike = () => wrapSelection('~', '~', 'strikethrough')
    const handleUnderline = () => wrapSelection('<u>', '</u>', 'underlined text')

    const handleTemplateNameChange = (val) => {
        // Enforce lowercase only, replace any space or whitespace with underscore, allow only a-z, 0-9, and _
        const formatted = (val || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        setNewTemplate(prev => ({ ...prev, name: formatted }))
    }

    const [mediaFile, setMediaFile] = useState(null)
    const [mediaBase64, setMediaBase64] = useState('')
    const [mediaMimeType, setMediaMimeType] = useState('')
    const [mediaFileError, setMediaFileError] = useState('')

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024      // 5 MB
    const MAX_VIDEO_SIZE = 16 * 1024 * 1024     // 16 MB
    const MAX_DOC_SIZE = 50 * 1024 * 1024       // 50 MB

    const validateMediaFile = (file) => {
        if (!file) return { valid: false, error: 'No file selected.' }
        const isVideo = file.type?.startsWith('video/')
        const isDoc = file.type === 'application/pdf' || (!isVideo && !file.type?.startsWith('image/'))

        if (isVideo) {
            if (file.size > MAX_VIDEO_SIZE) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
                return {
                    valid: false,
                    error: `Video size exceeds maximum limit of 16 MB (Selected: ${sizeMb} MB). Template cannot be saved.`
                }
            }
        } else if (isDoc) {
            if (file.size > MAX_DOC_SIZE) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
                return {
                    valid: false,
                    error: `Document size exceeds maximum limit of 50 MB (Selected: ${sizeMb} MB). Template cannot be saved.`
                }
            }
        } else {
            // Image
            if (file.size > MAX_IMAGE_SIZE) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
                return {
                    valid: false,
                    error: `Image size exceeds maximum limit of 5 MB (Selected: ${sizeMb} MB). Template cannot be saved.`
                }
            }
        }
        return { valid: true, error: null }
    }

    const handleMediaFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const check = validateMediaFile(file)
        if (!check.valid) {
            setMediaFileError(check.error)
            setError(check.error)
            setMediaFile(null)
            setMediaFileName('')
            setMediaPreviewUrl('')
            setMediaBase64('')
            if (e.target) e.target.value = ''
            return
        }

        setMediaFileError('')
        setError('')
        setMediaFile(file)
        setMediaFileName(file.name)
        const isVideo = file.type?.startsWith('video/')
        const isDoc = file.type === 'application/pdf' || (!isVideo && !file.type?.startsWith('image/'))
        setMediaMimeType(file.type || (isVideo ? 'video/mp4' : 'image/png'))
        const url = URL.createObjectURL(file)
        setMediaPreviewUrl(url)

        const reader = new FileReader()
        reader.onloadend = () => {
            setMediaBase64(reader.result)
        }
        reader.readAsDataURL(file)

        if (isVideo) setMediaType('video')
        else if (isDoc) setMediaType('document')
        else setMediaType('image')
    }

    const handleMediaDrop = (e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (!file) return

        const check = validateMediaFile(file)
        if (!check.valid) {
            setMediaFileError(check.error)
            setError(check.error)
            setMediaFile(null)
            setMediaFileName('')
            setMediaPreviewUrl('')
            setMediaBase64('')
            if (mediaInputRef.current) mediaInputRef.current.value = ''
            return
        }

        setMediaFileError('')
        setError('')
        setMediaFile(file)
        setMediaFileName(file.name)
        const isVideo = file.type?.startsWith('video/')
        const isDoc = file.type === 'application/pdf' || (!isVideo && !file.type?.startsWith('image/'))
        setMediaMimeType(file.type || (isVideo ? 'video/mp4' : 'image/png'))
        const url = URL.createObjectURL(file)
        setMediaPreviewUrl(url)

        const reader = new FileReader()
        reader.onloadend = () => {
            setMediaBase64(reader.result)
        }
        reader.readAsDataURL(file)

        if (isVideo) setMediaType('video')
        else if (isDoc) setMediaType('document')
        else setMediaType('image')
    }

    const handleCardMediaSelect = (cardId, e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const isVideo = file.type?.startsWith('video/')
        if (isVideo && file.size > MAX_VIDEO_SIZE) {
            const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
            setError(`Card video size exceeds maximum limit of 16 MB. (Selected: ${sizeMb} MB). Template cannot be saved.`)
            if (e.target) e.target.value = ''
            return
        }
        if (!isVideo && file.size > MAX_IMAGE_SIZE) {
            const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
            setError(`Card image size exceeds maximum limit of 5 MB. (Selected: ${sizeMb} MB). Template cannot be saved.`)
            if (e.target) e.target.value = ''
            return
        }

        setError('')
        const mime = file.type || (isVideo ? 'video/mp4' : 'image/png')
        const previewUrl = URL.createObjectURL(file)

        const reader = new FileReader()
        reader.onloadend = () => {
            const dataUrl = reader.result
            setCards(prevCards => prevCards.map(c => {
                if (c.id === cardId) {
                    return {
                        ...c,
                        headerMedia: dataUrl,
                        mediaBase64: dataUrl,
                        mediaFile: file,
                        mediaFileName: file.name,
                        mediaMimeType: mime,
                        mediaPreviewUrl: previewUrl,
                        mediaType: isVideo ? 'video' : 'image'
                    }
                }
                return c
            }))
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveCardMedia = (cardId) => {
        setCards(prevCards => prevCards.map(c => {
            if (c.id === cardId) {
                return {
                    ...c,
                    headerMedia: '',
                    mediaBase64: '',
                    mediaFile: null,
                    mediaFileName: '',
                    mediaMimeType: '',
                    mediaPreviewUrl: '',
                    mediaType: 'image'
                }
            }
            return c
        }))
    }

    const handleAddCard = () => {
        if (cards.length >= 10) return
        setCards([
            ...cards,
            { id: Date.now() + Math.random(), headerMedia: '', body: `Card ${cards.length + 1} Details`, mediaFileName: '', mediaPreviewUrl: '', mediaType: 'image', actionType: 'QUICK_REPLY', actionLabel: 'View Details', actionValue: '', buttons: [{ type: 'QUICK_REPLY', text: 'View Details' }] }
        ])
    }

    const handleRemoveCard = (id) => {
        if (cards.length <= 2) {
            alert('Meta requires a minimum of 2 cards for a carousel template.')
            return
        }
        setCards(cards.filter(c => c.id !== id))
    }

    const handleCardChange = (id, field, value) => {
        setCards(prevCards => prevCards.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

    // Update a specific field on a specific button within a card
    const handleCardButtonChange = (cardId, btnIdx, field, value) => {
        setCards(prevCards => prevCards.map(card => {
            if (card.id !== cardId) return card
            const updatedBtns = card.buttons.map((btn, i) =>
                i === btnIdx ? { ...btn, [field]: value } : btn
            )
            return { ...card, buttons: updatedBtns }
        }))
    }

    // Add a new button row to a card (max 2 per Meta spec)
    const handleAddCardButton = (cardId) => {
        setCards(prevCards => prevCards.map(card => {
            if (card.id !== cardId) return card
            if ((card.buttons || []).length >= 2) return card
            return {
                ...card,
                buttons: [...(card.buttons || []), { type: 'QUICK_REPLY', text: '' }]
            }
        }))
    }

    // Remove a specific button from a card
    const handleRemoveCardButton = (cardId, btnIdx) => {
        setCards(prevCards => prevCards.map(card => {
            if (card.id !== cardId) return card
            const updated = (card.buttons || []).filter((_, i) => i !== btnIdx)
            return { ...card, buttons: updated.length > 0 ? updated : [{ type: 'QUICK_REPLY', text: '' }] }
        }))
    }

    // Legacy single-button change handler (kept for compatibility, updates buttons[0])
    const handleCardActionChange = (id, field, value) => {
        setCards(prevCards => prevCards.map(card => {
            if (card.id !== id) return card
            const buttons = [...(card.buttons || [{ type: 'QUICK_REPLY', text: '' }])]
            if (field === 'actionType') {
                buttons[0] = { ...buttons[0], type: value }
            } else if (field === 'actionLabel') {
                buttons[0] = { ...buttons[0], text: value }
            } else if (field === 'actionValue') {
                const t = buttons[0].type || 'QUICK_REPLY'
                buttons[0] = { ...buttons[0], ...(t === 'URL' || t === 'URL_LINK' ? { url: value } : { phoneNumber: value }) }
            }
            return { ...card, buttons, actionType: buttons[0].type, actionLabel: buttons[0].text, actionValue: buttons[0].url || buttons[0].phoneNumber || '' }
        }))
    }

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (buttonDropdownRef.current && !buttonDropdownRef.current.contains(e.target)) {
                setShowButtonDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') setShowButtonDropdown(false)
        }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [])

    const handleSelectButtonType = (type) => {
        const defaultTextMap = {
            'CALL_TO_ACTION': 'Call Now',
            'URL_LINK':       'Visit Now',
        }
        const newBtn = {
            id: Date.now() + Math.random(),
            type: type,
            text: defaultTextMap[type] || '',
            phoneNumber: '',
            url: '',
            urlType: 'STATIC',
            couponCode: '',
            flowId: '',
            catalogId: '',
        }
        setNewTemplate({
            ...newTemplate,
            buttons: [...newTemplate.buttons, newBtn]
        })
        setShowButtonDropdown(false)
    }

    const handleRemoveButton = (id) => {
        setNewTemplate({
            ...newTemplate,
            buttons: newTemplate.buttons.filter(b => b.id !== id)
        })
    }

    const handleButtonChange = (id, field, value) => {
        setNewTemplate({
            ...newTemplate,
            buttons: newTemplate.buttons.map(b =>
                b.id === id ? { ...b, [field]: value } : b
            )
        })
    }

    const handleCreateTemplate = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        const rawName = (newTemplate.name || '').trim().toLowerCase()
        const nameToSubmit = rawName.replace(/[^a-z0-9_]/g, '_')
        if (!nameToSubmit) {
            setError('Template name is required')
            return
        }

        const validNameRegex = /^[a-z0-9_]+$/
        if (!validNameRegex.test(nameToSubmit)) {
            setError('Invalid template name. Meta requires lowercase letters, numbers, and underscores only (e.g. order_confirmation_1)')
            return
        }

        if (!newTemplate.message || !newTemplate.message.trim()) {
            setError('Body message content is required')
            return
        }

        // Auto format button phone numbers to E.164 (+91 format)
        const sanitizedButtons = newTemplate.buttons.map(btn => {
            if (btn.type === 'CALL_TO_ACTION' || btn.type === 'PHONE_NUMBER') {
                let pNum = (btn.phoneNumber || '').trim().replace(/[^\d+]/g, '')
                if (pNum && !pNum.startsWith('+')) {
                    if (pNum.length === 10) pNum = '+91' + pNum
                    else pNum = '+' + pNum
                }
                return { ...btn, phoneNumber: pNum || '+919876543210' }
            }
            return btn
        })

        // Validate media file limits before submission
        if (newTemplate.templateType === 'media' && mediaFile) {
            const check = validateMediaFile(mediaFile)
            if (!check.valid) {
                setError(check.error)
                setMediaFileError(check.error)
                return
            }
        }

        // Validate carousel cards media limits before submission
        if (newTemplate.templateType === 'carousel' && Array.isArray(cards)) {
            const normalizeCardButtonType = (type) => {
                const value = String(type || 'QUICK_REPLY').toUpperCase()
                if (value === 'URL_LINK') return 'URL'
                if (value === 'CALL_TO_ACTION') return 'PHONE_NUMBER'
                return value
            }
            const firstButtonSchema = (cards[0]?.buttons || []).slice(0, 2).map(btn => normalizeCardButtonType(btn.type))

            for (let i = 0; i < cards.length; i++) {
                const c = cards[i]
                const buttonSchema = (c.buttons || []).slice(0, 2).map(btn => normalizeCardButtonType(btn.type))
                const hasSameButtons = buttonSchema.length === firstButtonSchema.length && buttonSchema.every((type, index) => type === firstButtonSchema[index])
                if (!hasSameButtons) {
                    setError(`Card #${i + 1} must have the same number and types of buttons as Card #1. Meta requires identical button structure on every carousel card. No button was copied automatically.`)
                    return
                }
                for (let buttonIndex = 0; buttonIndex < (c.buttons || []).length; buttonIndex++) {
                    const button = c.buttons[buttonIndex]
                    const buttonType = normalizeCardButtonType(button.type)
                    if (buttonType === 'URL' && !(button.url || button.actionValue || '').trim()) {
                        setError(`Card #${i + 1}, Button #${buttonIndex + 1}: enter the exact website URL or change/remove the URL button. No default website will be added.`)
                        return
                    }
                }
                if (c.mediaFile) {
                    const isVideo = c.mediaType === 'video' || (c.mediaMimeType && c.mediaMimeType.startsWith('video/'))
                    if (isVideo && c.mediaFile.size > MAX_VIDEO_SIZE) {
                        const sizeMb = (c.mediaFile.size / (1024 * 1024)).toFixed(1)
                        setError(`Card #${i + 1} video size exceeds 16 MB limit (${sizeMb} MB). Template cannot be saved.`)
                        return
                    }
                    if (!isVideo && c.mediaFile.size > MAX_IMAGE_SIZE) {
                        const sizeMb = (c.mediaFile.size / (1024 * 1024)).toFixed(1)
                        setError(`Card #${i + 1} image size exceeds 5 MB limit (${sizeMb} MB). Template cannot be saved.`)
                        return
                    }
                }
            }
        }

        // Clean carousel cards to avoid sending duplicate base64 bloat
        const cleanedCards = (newTemplate.templateType === 'carousel' ? cards : []).map((c, idx) => {
            const isVideo = c.mediaType === 'video' || (c.mediaMimeType && c.mediaMimeType.startsWith('video/'))
            // Serialize ALL buttons for this card
            const cardButtons = (c.buttons || []).map(btn => {
                const t = btn.type || 'QUICK_REPLY'
                const b = { type: t, text: btn.text || '' }
                if (t === 'URL' || t === 'URL_LINK') b.url = btn.url || btn.actionValue || ''
                if (t === 'PHONE_NUMBER' || t === 'CALL_TO_ACTION') {
                    let pNum = (btn.phoneNumber || btn.actionValue || '').replace(/[^\d+]/g, '')
                    if (pNum && !pNum.startsWith('+')) pNum = '+91' + pNum
                    b.phoneNumber = pNum || '+919876543210'
                }
                return b
            })
            return {
                id: c.id || idx + 1,
                body: (c.body || `Card ${idx + 1}`).trim(),
                headerMedia: c.headerMedia || c.mediaBase64 || '',
                mediaBase64: c.mediaBase64 || (c.headerMedia && c.headerMedia.startsWith('data:') ? c.headerMedia : ''),
                mediaType: isVideo ? 'video' : 'image',
                mediaFileName: c.mediaFileName || (isVideo ? `card_${idx + 1}.mp4` : `card_${idx + 1}.png`),
                mediaMimeType: c.mediaMimeType || (isVideo ? 'video/mp4' : 'image/png'),
                actionType: cardButtons[0]?.type || 'QUICK_REPLY',
                actionLabel: cardButtons[0]?.text || 'View Details',
                actionValue: cardButtons[0]?.url || cardButtons[0]?.phoneNumber || '',
                buttons: cardButtons
            }
        })

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('templateName', nameToSubmit)
            formData.append('name', nameToSubmit)
            formData.append('templateType', newTemplate.templateType)
            formData.append('language', newTemplate.language || 'en_US')
            formData.append('category', newTemplate.category || 'UTILITY')
            formData.append('headerFormat', newTemplate.templateType === 'media' ? mediaType.toUpperCase() : 'NONE')
            formData.append('headerText', '')
            formData.append('message', newTemplate.message)
            formData.append('footer', newTemplate.footer || '')
            formData.append('buttons', JSON.stringify(sanitizedButtons))
            formData.append('cards', JSON.stringify(cleanedCards))

            if (newTemplate.templateType === 'media' && mediaFile) {
                formData.append('mediaFile', mediaFile)
            }
            if (mediaBase64) {
                formData.append('mediaBase64', mediaBase64)
                formData.append('mediaMimeType', mediaMimeType)
                formData.append('mediaFileName', mediaFileName)
            }

            if (editId) {
                formData.append('isEdit', 'true')
                formData.append('editId', editId)
            }

            formData.append('variableSamples', JSON.stringify(variableSamples))

            const authHeaders = getAuthHeaders()
            const res = await fetch(`${API_BASE}/meta/templates/create`, {
                method: 'POST',
                headers: { ...authHeaders },
                body: formData
            })

            const resText = await res.text()
            let data = null
            try {
                data = JSON.parse(resText)
            } catch (jsonErr) {
                if (res.status === 413) {
                    throw new Error('Upload file size exceeds server limits. Please upload a smaller video or image (under 25MB).')
                }
                throw new Error(resText && resText.length < 200 ? resText : `Server returned error (${res.status} ${res.statusText || 'Error'})`)
            }

            if (!res.ok || !data?.success) {
                throw new Error(data?.message || 'Failed to submit template to Meta')
            }

            setSuccess(`✅ ${data.message}`)
            setTimeout(() => {
                navigate('/template/manage')
            }, 1500)
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const renderFormattedMessage = (msg, samples = {}) => {
        if (!msg) return ''
        let html = msg
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u style="text-decoration: underline;">$1</u>')
            .replace(/\*([^*\n\r]+?)\*/g, '<strong>$1</strong>')
            .replace(/_([^_\n\r]+?)_/g, '<em>$1</em>')
            .replace(/~([^~\n\r]+?)~/g, '<del>$1</del>')
            .replace(/```([^`\n\r]+?)```/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;font-family:monospace;">$1</code>')
            .replace(/\{\{(\d+)\}\}/g, (match, p1) => {
                const sampleVal = samples && samples[p1] && samples[p1].trim() ? samples[p1].trim() : null
                if (sampleVal) {
                    return `<span class="preview-variable-filled" style="color: #0369a1; font-weight: 700; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; border: 1px solid #bae6fd;">${sampleVal}</span>`
                }
                return `<span class="preview-variable" style="color: #1e40af; font-weight: 700; background: #dbeafe; padding: 2px 6px; border-radius: 4px; border: 1px solid #bfdbfe;">{{${p1}}}</span>`
            })
        return html
    }

    const getButtonPreviewLabel = (btn) => {
        switch (btn.type) {
            case 'CALL_TO_ACTION': return 'Call'
            case 'URL_LINK': return 'Website'
            case 'QUICK_REPLY': return 'Quick Reply'
            case 'COPY_CODE': return 'Copy Code'
            case 'FLOW': return 'Flow'
            case 'CATALOG': return 'View Catalog'
            default: return 'Button'
        }
    }

    const getButtonPreviewText = (btn) => {
        return btn.text || getButtonPreviewLabel(btn)
    }

    const getButtonPreviewIcon = (btn) => {
        switch (btn.type) {
            case 'CALL_TO_ACTION':
                return (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.37 2 2 0 0 1 3.6 1.16h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                )
            case 'URL_LINK':
                return (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                )
            case 'QUICK_REPLY':
                return (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                    </svg>
                )
            case 'COPY_CODE':
                return (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                )
            default:
                return (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                )
        }
    }

    return (
        <>
            <div className="official-template-page">
                {error && (
                    <div className="error-banner" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>⚠️ {error}</div>
                        {(error.includes('deleted') || error.includes('already exists') || error.includes('content')) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 500 }}>
                                    Tip: Meta blocks re-using a recently deleted name. Click to auto-generate a new name:
                                </span>
                                <button
                                    type="button"
                                    style={{
                                        background: '#0284c7',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 10px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                        const cleanBase = (newTemplate.name || 'my_template').replace(/_v\d+$/, '')
                                        setNewTemplate({ ...newTemplate, name: `${cleanBase}_v${Math.floor(Math.random() * 900 + 100)}` })
                                        setError('')
                                    }}
                                >
                                    ⚡ Change Name Automatically
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {success && <div className="success-banner" style={{ marginBottom: 16 }}>{success}</div>}

                <div className="template-form-header">
                    <div className="header-left-section">
                        <div className="header-icon-wrapper">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </div>
                        <h1 className="template-form-title" style={{ color: '#ffffff' }}>Official WABA Template</h1>
                    </div>
                    <div className="header-right-section">
                        <button className="btn-manage-templates" onClick={() => navigate('/template/manage')}>
                            Manage Templates
                        </button>
                    </div>
                </div>

                <div className="template-form-body">
                    <div className="template-form-left">
                        <div className="template-form-card">
                            <h2 className="template-section-title">Template:</h2>

                            <div className="template-fields-row">
                                <div className="template-field-group">
                                    <label className="template-field-label">Template Name:</label>
                                    <input
                                        type="text"
                                        className="template-field-input"
                                        placeholder="eg. my_template_1"
                                        value={newTemplate.name}
                                        onChange={(e) => handleTemplateNameChange(e.target.value)}
                                        onPaste={(e) => {
                                            e.preventDefault()
                                            const text = e.clipboardData.getData('text') || ''
                                            const formatted = text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
                                            const current = newTemplate.name || ''
                                            const start = e.target.selectionStart || 0
                                            const end = e.target.selectionEnd || 0
                                            const nextVal = current.substring(0, start) + formatted + current.substring(end)
                                            handleTemplateNameChange(nextVal)
                                        }}
                                        required
                                    />

                                </div>
                                <div className="template-field-group">
                                    <label className="template-field-label">Template Type:</label>
                                    <select
                                        className="template-field-select"
                                        value={newTemplate.templateType}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, templateType: e.target.value })}
                                    >
                                        <option value="text">Standard (text only)</option>
                                        <option value="media">Media and interactive</option>
                                        <option value="carousel">Carousel</option>
                                    </select>
                                </div>
                                <div className="template-field-group">
                                    <label className="template-field-label">Select Language:</label>
                                    <select
                                        className="template-field-select"
                                        value={newTemplate.language}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, language: e.target.value })}
                                    >
                                        {ALL_LANGUAGES.map((lang) => (
                                            <option key={lang.value} value={lang.value}>
                                                {lang.label} ({lang.value})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="template-field-group">
                                    <label className="template-field-label">Select Category:</label>
                                    <select
                                        className="template-field-select"
                                        value={newTemplate.category}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                    >
                                        <option value="MARKETING">Marketing</option>
                                        <option value="UTILITY">Utility</option>
                                        <option value="AUTHENTICATION">Authentication</option>
                                    </select>
                                </div>
                            </div>

                            {newTemplate.templateType === 'media' && (
                                <div className="media-message-row">
                                    <div className="media-upload-card">
                                        <div className="media-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '10px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>Sample Media:</span>

                                            </div>
                                        </div>
                                        <div
                                            className="media-drop-zone"
                                            onClick={() => mediaInputRef.current?.click()}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDrop={handleMediaDrop}
                                        >
                                            <input
                                                type="file"
                                                ref={mediaInputRef}
                                                style={{ display: 'none' }}
                                                accept="image/*,video/*,application/pdf"
                                                onChange={handleMediaFileSelect}
                                            />
                                            {mediaPreviewUrl ? (
                                                <div className="media-preview-container">
                                                    {mediaType === 'video' ? (
                                                        <video src={mediaPreviewUrl} className="media-preview-element" controls />
                                                    ) : mediaType === 'document' ? (
                                                        <div className="doc-preview-badge">📄 {mediaFileName || 'Document.pdf'}</div>
                                                    ) : (
                                                        <img src={mediaPreviewUrl} alt="Media Preview" className="media-preview-element" />
                                                    )}
                                                    <button type="button" className="btn-remove-media" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMediaPreviewUrl('');
                                                        setMediaFile(null);
                                                        setMediaBase64('');
                                                        setMediaFileName('');
                                                        setMediaFileError('');
                                                        if (mediaInputRef.current) mediaInputRef.current.value = '';
                                                    }}>Remove</button>
                                                </div>
                                            ) : (
                                                <div className="drop-zone-content">
                                                    <div className="drop-zone-text">Drag & Drop media file or <span>Browse</span></div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>
                                                        Limits: Image up to 5 MB &nbsp;•&nbsp; Video up to 16 MB &nbsp;•&nbsp; Document up to 50 MB
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {mediaFileError && (
                                            <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#b91c1c', fontSize: '12px', fontWeight: 600, borderTop: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span>⚠️</span>
                                                <span>{mediaFileError}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="message-box-wrapper" style={{ marginBottom: 0 }}>
                                        <div className="message-header-row">
                                            <span className="message-label-red">Message(Max 1024 Characters)</span>
                                            <div className="message-toolbar">
                                                <button type="button" className="toolbar-btn btn-blue" onClick={handleAddVariable} title="Add Variable">Add Variable</button>
                                                <button type="button" className="toolbar-btn" onClick={handleBold} title="Bold (*text*)"><b>B</b></button>
                                                <button type="button" className="toolbar-btn" onClick={handleItalic} title="Italic (_text_)"><i>I</i></button>
                                                <button type="button" className="toolbar-btn" onClick={handleStrike} title="Strikethrough (~text~)"><s>S</s></button>
                                                <button type="button" className="toolbar-btn" onClick={handleUnderline} title="Underline (<u>text</u>)"><u>U</u></button>
                                            </div>
                                        </div>
                                        <textarea
                                            ref={messageRef}
                                            className="template-message-textarea"
                                            placeholder="Enter variable names inside {{ }}. eg, {{1}}, {{2}}, etc..."
                                            value={newTemplate.message}
                                            onChange={(e) => {
                                                if (e.target.value.length <= 1024) {
                                                    setNewTemplate({ ...newTemplate, message: e.target.value })
                                                }
                                            }}
                                            onClick={updateSelectionStart}
                                            onKeyUp={updateSelectionStart}
                                            rows="7"
                                            style={{ minHeight: '160px' }}
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {newTemplate.templateType !== 'media' && (
                                <div className="message-box-wrapper">
                                    <div className="message-header-row">
                                        <span className="message-label-red">Message(Max 1024 Characters)</span>
                                        <div className="message-toolbar">
                                            <button type="button" className="toolbar-btn btn-blue" onClick={handleAddVariable} title="Add Variable">Add Variable</button>
                                            <button type="button" className="toolbar-btn" onClick={handleBold} title="Bold (*text*)"><b>B</b></button>
                                            <button type="button" className="toolbar-btn" onClick={handleItalic} title="Italic (_text_)"><i>I</i></button>
                                            <button type="button" className="toolbar-btn" onClick={handleStrike} title="Strikethrough (~text~)"><s>S</s></button>
                                            <button type="button" className="toolbar-btn" onClick={handleUnderline} title="Underline (<u>text</u>)"><u>U</u></button>
                                        </div>
                                    </div>
                                    <textarea
                                        ref={messageRef}
                                        className="template-message-textarea"
                                        placeholder={newTemplate.templateType === 'carousel' ? 'Enter variable names inside {{ }}. eg, {{1}}, {{2}}, etc...' : 'Enter your message here...'}
                                        value={newTemplate.message}
                                        onChange={(e) => {
                                            if (e.target.value.length <= 1024) {
                                                setNewTemplate({ ...newTemplate, message: e.target.value })
                                            }
                                        }}
                                        onClick={updateSelectionStart}
                                        onKeyUp={updateSelectionStart}
                                        rows="7"
                                        style={{ minHeight: '160px' }}
                                        required
                                    />
                                </div>
                            )}

                            {/* Variable Sample Content Fields (Auto-displayed whenever variables like {{1}}, {{2}} are present) */}
                            {detectedVariables.length > 0 && (
                                <div className="template-variables-sample-card">
                                    <div className="variables-sample-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '16px' }}>📝</span>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#0f766e' }}>
                                                    Variable Fields ({detectedVariables.length} variable{detectedVariables.length > 1 ? 's' : ''} detected)
                                                </h4>
                                                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                                                    Enter sample values for each variable to preview in live mobile and submit to Meta.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="variables-sample-grid">
                                        {detectedVariables.map((v) => (
                                            <div key={v} className="variable-sample-field">
                                                <label className="variable-sample-label">
                                                    Sample value for <span className="var-pill-label">{`{{${v}}}`}</span>:
                                                </label>
                                                <input
                                                    type="text"
                                                    className="template-field-input variable-sample-input"
                                                    placeholder={`e.g. Sample value for {{${v}}}`}
                                                    value={variableSamples[v] || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setVariableSamples(prev => ({
                                                            ...prev,
                                                            [v]: val
                                                        }))
                                                    }}
                                                    maxLength={100}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {newTemplate.templateType === 'carousel' && (
                                <div className="carousel-cards-section">
                                    <div className="carousel-cards-header">
                                        <span className="cards-section-label">Cards:</span>
                                        <button type="button" className="btn-add-card-blue" onClick={handleAddCard}>
                                            + Add Card
                                        </button>
                                    </div>
                                    {cards.length > 0 && (
                                        <div className="carousel-cards-list">
                                            {cards.map((card, idx) => (
                                                <div key={card.id} className="carousel-card-item" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                                                    <div className="card-item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>🃏 Card #{idx + 1}</span>
                                                            <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0284c7', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>CAROUSEL ITEM</span>
                                                        </div>
                                                        {cards.length > 2 && (
                                                            <button
                                                                type="button"
                                                                className="btn-remove-card"
                                                                onClick={() => handleRemoveCard(card.id)}
                                                                style={{
                                                                    background: '#fee2e2',
                                                                    color: '#dc2626',
                                                                    border: '1px solid #fca5a5',
                                                                    borderRadius: '6px',
                                                                    padding: '4px 10px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}
                                                            >
                                                                🗑️ Delete Card
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="card-fields-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {/* Card Header Media */}
                                                        <div className="card-field">
                                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                                                                Card Image / Video Header:
                                                            </label>
                                                            {card.mediaPreviewUrl || card.headerMedia ? (
                                                                <div style={{
                                                                    marginTop: 6,
                                                                    borderRadius: 6,
                                                                    border: '1px solid #e2e8f0',
                                                                    padding: 6,
                                                                    background: '#ffffff',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 10
                                                                }}>
                                                                    {(card.mediaType === 'video' || (card.headerMedia && (card.headerMedia.includes('.mp4') || card.headerMedia.includes('video')))) ? (
                                                                        <div style={{ position: 'relative', width: 50, height: 50, background: '#0f172a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                                                            <video src={card.mediaPreviewUrl || card.headerMedia} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                                                                            <div style={{ position: 'absolute', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '9px', pointerEvents: 'none' }}>▶</div>
                                                                        </div>
                                                                    ) : (
                                                                        <img
                                                                            src={card.mediaPreviewUrl || card.headerMedia}
                                                                            alt="Card preview"
                                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                                            style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                                                                        />
                                                                    )}
                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                            {(card.mediaType === 'video' || (card.headerMedia && (card.headerMedia.includes('.mp4') || card.headerMedia.includes('video')))) ? '🎬 Video Attached' : `📷 ${card.mediaFileName || 'Image attached'}`}
                                                                        </div>
                                                                        <div style={{ fontSize: '11px', color: '#64748b' }}>Attached to Card #{idx + 1}</div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                                                                        onClick={() => handleRemoveCardMedia(card.id)}
                                                                    >
                                                                        Remove Media
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                                    <label style={{
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: 6,
                                                                        padding: '8px 14px',
                                                                        background: '#e0f2fe',
                                                                        color: '#0284c7',
                                                                        border: '1px dashed #0284c7',
                                                                        borderRadius: 6,
                                                                        fontSize: '12px',
                                                                        fontWeight: 600,
                                                                        cursor: 'pointer'
                                                                    }}>
                                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                                            <circle cx="8.5" cy="8.5" r="1.5" />
                                                                            <polyline points="21 15 16 10 5 21" />
                                                                        </svg>
                                                                        Import Image / Video (image: 5 MB | video: 16 MB)
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*,video/*"
                                                                            style={{ display: 'none' }}
                                                                            onChange={(e) => handleCardMediaSelect(card.id, e)}
                                                                        />
                                                                    </label>
                                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>or paste URL:</span>
                                                                    <input
                                                                        type="text"
                                                                        className="template-field-input"
                                                                        placeholder="https://... (Optional URL)"
                                                                        value={card.headerMedia && !card.headerMedia.startsWith('data:') ? card.headerMedia : ''}
                                                                        onChange={(e) => handleCardChange(card.id, 'headerMedia', e.target.value)}
                                                                        style={{ flex: 1, minWidth: 140 }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Card Body Text */}
                                                        <div className="card-field">
                                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>
                                                                Card Body Text:
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="template-field-input"
                                                                placeholder={`Enter unique text for Card #${idx + 1}`}
                                                                value={card.body}
                                                                onChange={(e) => handleCardChange(card.id, 'body', e.target.value)}
                                                            />
                                                        </div>

                                                        {/* Card Buttons – multi-button (Meta allows up to 2 per carousel card) */}
                                                        <div className="card-field">
                                                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>
                                                                Card Action Button(s) <span style={{ fontWeight: 400, color: '#64748b' }}>(What happens when user clicks):</span>
                                                            </label>

                                                            {/* Render each button row */}
                                                            {(card.buttons || []).map((btn, btnIdx) => {
                                                                const bType = btn.type || 'QUICK_REPLY'
                                                                return (
                                                                    <div key={btnIdx} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                                                                        {/* Row header: badge + remove */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 8px', borderRadius: 20 }}>
                                                                                Button {btnIdx + 1}
                                                                            </span>
                                                                            {(card.buttons || []).length > 1 && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveCardButton(card.id, btnIdx)}
                                                                                    title="Remove this button"
                                                                                    style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '16px', cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
                                                                                >✕</button>
                                                                            )}
                                                                        </div>

                                                                        {/* Button fields */}
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, marginBottom: (bType === 'QUICK_REPLY') ? 0 : 8 }}>
                                                                            {/* Label – most important, shown first and wider */}
                                                                            <input
                                                                                type="text"
                                                                                className="template-field-input"
                                                                                placeholder={`Button label (e.g. View Details, Buy Now, Call Us)`}
                                                                                value={btn.text || ''}
                                                                                onChange={(e) => handleCardButtonChange(card.id, btnIdx, 'text', e.target.value)}
                                                                                style={{ fontSize: '12px', fontWeight: 500 }}
                                                                                maxLength={25}
                                                                            />
                                                                            {/* Type selector */}
                                                                            <select
                                                                                className="template-field-input"
                                                                                value={bType}
                                                                                onChange={(e) => handleCardButtonChange(card.id, btnIdx, 'type', e.target.value)}
                                                                                style={{ fontSize: '12px' }}
                                                                            >
                                                                                <option value="QUICK_REPLY">💬 Quick Reply</option>
                                                                                <option value="URL">🔗 Visit Website</option>
                                                                                <option value="PHONE_NUMBER">📞 Call Number</option>
                                                                            </select>
                                                                        </div>

                                                                        {/* URL or Phone field – only when needed */}
                                                                        {(bType === 'URL' || bType === 'URL_LINK') && (
                                                                            <input
                                                                                type="text"
                                                                                className="template-field-input"
                                                                                placeholder="https://example.com/product"
                                                                                value={btn.url || ''}
                                                                                onChange={(e) => handleCardButtonChange(card.id, btnIdx, 'url', e.target.value)}
                                                                                style={{ fontSize: '12px', width: '100%' }}
                                                                            />
                                                                        )}
                                                                        {(bType === 'PHONE_NUMBER' || bType === 'CALL_TO_ACTION') && (
                                                                            <input
                                                                                type="text"
                                                                                className="template-field-input"
                                                                                placeholder="+919876543210"
                                                                                value={btn.phoneNumber || ''}
                                                                                onChange={(e) => handleCardButtonChange(card.id, btnIdx, 'phoneNumber', e.target.value)}
                                                                                style={{ fontSize: '12px', width: '100%' }}
                                                                            />
                                                                        )}
                                                                        {bType === 'QUICK_REPLY' && (
                                                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: 4 }}>Tapping this button will send the label text as a chat reply.</div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}

                                                            {/* "+ Add Another Button" row — shown below existing buttons if under limit */}
                                                            {(card.buttons || []).length < 2 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAddCardButton(card.id)}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '9px',
                                                                        background: '#f0fdf4',
                                                                        color: '#16a34a',
                                                                        border: '2px dashed #86efac',
                                                                        borderRadius: 8,
                                                                        fontSize: '12px',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        gap: 6,
                                                                        letterSpacing: '0.01em'
                                                                    }}
                                                                >
                                                                    ＋ Add Another Button
                                                                </button>
                                                            ) : (
                                                                <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '6px 0' }}>
                                                                    ✓ Max 2 buttons per carousel card (Meta limit reached)
                                                                </div>
                                                            )}
                                                        </div>

                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {newTemplate.templateType !== 'carousel' && (
                                <div className="template-btns-section">
                                    <div className="template-btns-header-row">
                                        <label className="buttons-label-cb">Buttons: (Optional)</label>
                                        {newTemplate.buttons.length < MAX_BUTTONS && (
                                            <div className="btn-add-button-wrapper" ref={buttonDropdownRef}>
                                                <button
                                                    type="button"
                                                    className="btn-add-button-green"
                                                    onClick={() => setShowButtonDropdown(!showButtonDropdown)}
                                                >
                                                    Add Button
                                                </button>
                                                {showButtonDropdown && (
                                                    <div className="btn-type-dropdown">
                                                        {BUTTON_TYPES.map((bt) => (
                                                            <div
                                                                key={bt.value}
                                                                className="btn-type-dropdown-item"
                                                                onClick={() => handleSelectButtonType(bt.value)}
                                                            >
                                                                {bt.label}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {newTemplate.buttons.length > 0 && (
                                        <div className="template-buttons-list-inline">
                                            {newTemplate.buttons.map((btn) => (
                                                <div key={btn.id} className="template-btn-inline-row">
                                                    {btn.type === 'CALL_TO_ACTION' && (
                                                        <>
                                                            <span className="btn-inline-type-label">Call to Action:</span>
                                                            <input
                                                                type="text"
                                                                className="btn-inline-text-pill btn-pill-purple"
                                                                placeholder="Call Now"
                                                                value={btn.text || ''}
                                                                maxLength={MAX_BUTTON_TEXT}
                                                                onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="btn-inline-extra-input"
                                                                placeholder="+91XXXXXXXXXX"
                                                                value={btn.phoneNumber || ''}
                                                                onChange={(e) => {
                                                                    // Strip everything except digits and a leading +
                                                                    const raw = e.target.value
                                                                    const cleaned = (raw.startsWith('+') ? '+' : '') + raw.replace(/\D/g, '')
                                                                    handleButtonChange(btn.id, 'phoneNumber', cleaned)
                                                                }}
                                                                onPaste={(e) => {
                                                                    e.preventDefault()
                                                                    const pasted = e.clipboardData.getData('text') || ''
                                                                    // Auto-clean pasted number: keep leading + and digits only
                                                                    const cleaned = (pasted.trimStart().startsWith('+') ? '+' : '') + pasted.replace(/\D/g, '')
                                                                    handleButtonChange(btn.id, 'phoneNumber', cleaned)
                                                                }}
                                                            />
                                                            <button type="button" className="btn-inline-delete" onClick={() => handleRemoveButton(btn.id)}>Delete</button>
                                                        </>
                                                    )}
                                                    {btn.type === 'URL_LINK' && (
                                                        <>
                                                            <span className="btn-inline-type-label">URL Type:</span>
                                                            <select
                                                                className="btn-inline-select"
                                                                value={(btn.urlType || 'STATIC').toUpperCase()}
                                                                onChange={(e) => handleButtonChange(btn.id, 'urlType', e.target.value.toUpperCase())}
                                                            >
                                                                <option value="STATIC">Static</option>
                                                                <option value="DYNAMIC">Dynamic</option>
                                                            </select>
                                                            <input
                                                                type="text"
                                                                className="btn-inline-text-pill btn-pill-teal"
                                                                placeholder="Visit Now"
                                                                value={btn.text || ''}
                                                                maxLength={MAX_BUTTON_TEXT}
                                                                onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                            />
                                                            <input
                                                                type="text"
                                                                className="btn-inline-extra-input"
                                                                placeholder={(btn.urlType || 'STATIC').toUpperCase() === 'DYNAMIC' ? 'https://example.com/order/{{1}}' : 'https://example.com'}
                                                                value={btn.url || ''}
                                                                onChange={(e) => handleButtonChange(btn.id, 'url', e.target.value)}
                                                            />
                                                            <button type="button" className="btn-inline-delete" onClick={() => handleRemoveButton(btn.id)}>Delete</button>
                                                        </>
                                                    )}
                                                    {btn.type === 'QUICK_REPLY' && (
                                                        <>
                                                            <span className="btn-inline-type-label">Quick Reply:</span>
                                                            <input
                                                                type="text"
                                                                className="btn-inline-text-pill btn-pill-orange"
                                                                placeholder="Quick Reply Text"
                                                                value={btn.text || ''}
                                                                maxLength={MAX_BUTTON_TEXT}
                                                                onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                            />
                                                            <button type="button" className="btn-inline-delete" onClick={() => handleRemoveButton(btn.id)}>Delete</button>
                                                        </>
                                                    )}
                                                    {btn.type === 'COPY_CODE' && (
                                                        <>
                                                            <span className="btn-inline-type-label">Copy Code:</span>
                                                            <input
                                                                type="text"
                                                                className="btn-inline-text-pill btn-pill-purple"
                                                                placeholder="Copy Code"
                                                                value={btn.text || ''}
                                                                maxLength={MAX_BUTTON_TEXT}
                                                                onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                            />
                                                            <button type="button" className="btn-inline-delete" onClick={() => handleRemoveButton(btn.id)}>Delete</button>
                                                        </>
                                                    )}
                                                    {btn.type === 'FLOW' && (
                                                        <>
                                                            <span className="btn-inline-type-label">Flow:</span>
                                                            <input
                                                                type="text"
                                                                className="btn-inline-text-pill btn-pill-teal"
                                                                placeholder="Open Flow"
                                                                value={btn.text || ''}
                                                                maxLength={MAX_BUTTON_TEXT}
                                                                onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                            />
                                                            <button type="button" className="btn-inline-delete" onClick={() => handleRemoveButton(btn.id)}>Delete</button>
                                                        </>
                                                    )}
                                                    {btn.type === 'CATALOG' && (
                                                        <>
                                                            <span className="btn-inline-type-label">Catalog:</span>
                                                            <input
                                                                type="text"
                                                                className="btn-inline-text-pill btn-pill-orange"
                                                                placeholder="View Catalog"
                                                                value={btn.text || ''}
                                                                maxLength={MAX_BUTTON_TEXT}
                                                                onChange={(e) => handleButtonChange(btn.id, 'text', e.target.value)}
                                                            />
                                                            <button type="button" className="btn-inline-delete" onClick={() => handleRemoveButton(btn.id)}>Delete</button>
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="footer-input-group">
                                <span className="footer-input-label">Footer(Optional)</span>
                                <input
                                    type="text"
                                    className="footer-input-field"
                                    value={newTemplate.footer}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, footer: e.target.value })}
                                />
                            </div>

                            <div className="template-save-btn-row">
                                <button
                                    className="btn-save-template-blue"
                                    onClick={handleCreateTemplate}
                                    disabled={!newTemplate.name || !newTemplate.message || submitting}
                                >
                                    {submitting ? 'Saving...' : 'Save Template'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="template-form-right">
                        <div className="phone-mockup-wrapper">
                            <div className="phone-mockup">
                                <div className="phone-notch" />
                                <div className="phone-screen">
                                    {/* Phone Status Bar */}
                                    <div className="wa-status-bar">
                                        <div className="wa-status-time">11:36 AM</div>
                                        <div className="wa-status-icons">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <rect x="2" y="16" width="3" height="4" rx="0.5" />
                                                <rect x="7" y="12" width="3" height="8" rx="0.5" />
                                                <rect x="12" y="8" width="3" height="12" rx="0.5" />
                                                <rect x="17" y="4" width="3" height="16" rx="0.5" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* WhatsApp Header */}
                                    <div className="wa-chat-header" style={{ padding: '8px 12px' }}>
                                        <div className="wa-header-left">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M19 12H5M12 19l-7-7 7-7" />
                                            </svg>
                                        </div>
                                        <div className="wa-header-center" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginLeft: '6px', minWidth: 0 }}>
                                            <div className="wa-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0f766e', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', flexShrink: 0 }}>
                                                {(accountName || 'O').charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span className="wa-contact-name" style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {accountName}
                                                    </span>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#00a884" style={{ flexShrink: 0 }}>
                                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                                    </svg>
                                                </div>
                                                <span style={{ fontSize: '10px', color: '#a7f3d0', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    Official Business Account • Online
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="wa-chat-area">
                                        {(newTemplate.message || mediaPreviewUrl) && (
                                            <div className="wa-message-bubble wa-message-received">
                                                {newTemplate.templateType === 'media' && mediaPreviewUrl && (
                                                    <div className="wa-bubble-media-preview" style={{ marginBottom: 6 }}>
                                                        {mediaType === 'video' ? (
                                                            <video src={mediaPreviewUrl} style={{ width: '100%', borderRadius: 4 }} controls />
                                                        ) : mediaType === 'document' ? (
                                                            <div
                                                                className="wa-document-preview"
                                                                title={mediaFileName || 'Document.pdf'}
                                                            >
                                                                <span className="wa-document-preview-icon" aria-hidden="true">📄</span>
                                                                <span className="wa-document-preview-name">{mediaFileName || 'Document.pdf'}</span>
                                                            </div>
                                                        ) : (
                                                            <img src={mediaPreviewUrl} alt="Header Media" style={{ width: '100%', borderRadius: 6, maxHeight: 130, objectFit: 'contain', backgroundColor: '#f1f5f9', display: 'block' }} />
                                                        )}
                                                    </div>
                                                )}
                                                <div
                                                    className="wa-bubble-text"
                                                    dangerouslySetInnerHTML={{ __html: renderFormattedMessage(newTemplate.message || 'Preview of Message', variableSamples) }}
                                                />
                                                {newTemplate.footer && <div className="wa-bubble-footer">{newTemplate.footer}</div>}
                                                <div className="wa-bubble-time">03:50 PM</div>
                                            </div>
                                        )}

                                        {newTemplate.templateType === 'carousel' && cards.length > 0 && (
                                            <div className="wa-carousel-preview-list" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 0' }}>
                                                {cards.map((c, i) => (
                                                    <div key={c.id} style={{ minWidth: 140, maxWidth: 160, background: '#ffffff', borderRadius: 8, padding: 8, border: '1px solid #cbd5e1', fontSize: '11px', flexShrink: 0 }}>
                                                        <div style={{ height: 85, background: '#0f172a', borderRadius: 4, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', overflow: 'hidden', position: 'relative' }}>
                                                            {c.mediaPreviewUrl || c.headerMedia ? (
                                                                c.mediaType === 'video' ? (
                                                                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000000' }}>
                                                                        <video src={c.mediaPreviewUrl || c.headerMedia} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                                                                        <div style={{ position: 'absolute', background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '9px', pointerEvents: 'none' }}>▶</div>
                                                                    </div>
                                                                ) : (
                                                                    <img src={c.mediaPreviewUrl || c.headerMedia} alt={`Card ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                )
                                                            ) : (
                                                                <span>{c.mediaType === 'video' ? '🎬 Video' : '🖼 Image'} #{i + 1}</span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                                                            {c.body || `Card ${i + 1} Text`}
                                                        </div>
                                                        {/* Render ALL buttons for this card */}
                                                        {(c.buttons || []).map((btn, bIdx) => (
                                                            <div
                                                                key={bIdx}
                                                                style={{
                                                                    background: '#f8fafc',
                                                                    border: '1px solid #e2e8f0',
                                                                    borderRadius: 4,
                                                                    padding: '4px 6px',
                                                                    textAlign: 'center',
                                                                    color: '#00a884',
                                                                    fontWeight: 600,
                                                                    fontSize: '10px',
                                                                    marginBottom: bIdx < (c.buttons || []).length - 1 ? 3 : 0,
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }}
                                                            >
                                                                {btn.type === 'URL' || btn.type === 'URL_LINK' ? '🔗 ' : btn.type === 'PHONE_NUMBER' || btn.type === 'CALL_TO_ACTION' ? '📞 ' : '💬 '}
                                                                {btn.text || `Button ${bIdx + 1}`}
                                                            </div>
                                                        ))}

                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {newTemplate.templateType !== 'carousel' && newTemplate.buttons.length > 0 && (
                                            <div className="wa-preview-btn-group">
                                                {newTemplate.buttons.map((btn) => (
                                                    <div key={btn.id} className="wa-preview-btn-item">
                                                        <span className="wa-preview-btn-icon">{getButtonPreviewIcon(btn)}</span>
                                                        <span className="wa-preview-btn-text">{getButtonPreviewText(btn)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
