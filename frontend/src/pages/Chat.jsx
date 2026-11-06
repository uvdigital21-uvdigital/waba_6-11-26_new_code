import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext.jsx'
import { useTitle } from '../context/TitleContext.jsx'
import { API_BASE_URL } from '../config.js'
import { getTags, getChatTags, assignTagsToChat, removeTagFromChat } from '../services/tagService.js'
import './Chat.css'

function AttachmentRenderer({ message, resolveMediaUrl }) {
    const [failed, setFailed] = useState(false)
    const source = resolveMediaUrl(message.mediaUrl)
    const fileName = message.fileName || message.rawPayload?.fileName || 'Attachment'
    const mime = String(message.mimeType || message.rawPayload?.mimeType || '').toLowerCase()
    const type = String(message.mediaType || message.messageType || message.type || '').toLowerCase()
    const identity = `${fileName} ${message.mediaUrl || ''}`.toLowerCase()
    const isImage = type === 'image' || mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(identity)
    const isVideo = type === 'video' || mime.startsWith('video/') || /\.(mp4|webm|mov|m4v|3gp)(\?|$)/i.test(identity)
    const isAudio = type === 'audio' || mime.startsWith('audio/') || /\.(mp3|wav|ogg|aac|m4a|amr)(\?|$)/i.test(identity)
    const isPdf = mime === 'application/pdf' || /\.pdf(\?|$)/i.test(identity)
    const icon = isImage ? '📷' : isVideo ? '🎥' : isAudio ? '🎵' : isPdf ? '📕' : '📄'

    if (!message.mediaUrl || failed) return <div className="attachment-fallback">{icon}<span><strong>{fileName}</strong><small>Media unavailable</small></span></div>
    if (!source) return <div className="attachment-fallback">{icon}<span><strong>{fileName}</strong><small>Loading attachment…</small></span></div>
    if (isImage) return <img className="chat-attachment-image" src={source} alt={fileName} style={{ minHeight: '120px', aspectRatio: '16/9' }} onError={() => setFailed(true)} />
    if (isVideo) return <div className="chat-attachment-block" style={{ minHeight: '140px' }}><video className="chat-attachment-video" src={source} controls playsInline preload="metadata" style={{ minHeight: '120px', aspectRatio: '16/9' }} onError={() => setFailed(true)} /><div className="attachment-file-name">🎥 {fileName}</div></div>
    if (isAudio) return <div className="chat-attachment-block"><div className="attachment-file-name">🎵 {fileName}</div><audio className="chat-attachment-audio" src={source} controls preload="metadata" onError={() => setFailed(true)} /></div>
    if (isPdf) return <div className="chat-attachment-block chat-pdf-card"><iframe className="chat-pdf-preview" src={`${source}#toolbar=0&navpanes=0`} title={fileName} /><div className="attachment-file-name">📕 {fileName}</div><a className="attachment-open-link" href={source} target="_blank" rel="noopener noreferrer">Open PDF</a></div>
    return <a className="chat-document-card" href={source} target="_blank" rel="noopener noreferrer"><span className="document-icon">📄</span><span><strong>{fileName}</strong><small>{mime || 'Document'} · Open or download</small></span></a>
}

export default function Chat() {
    const { user, token } = useAuth()
    const { setTitle } = useTitle()
    const [conversations, setConversations] = useState([])
    const [selectedChat, setSelectedChat] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [officialNumber, setOfficialNumber] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [showNewChatModal, setShowNewChatModal] = useState(false)
    const [newChatPhone, setNewChatPhone] = useState('')
    const [newChatName, setNewChatName] = useState('')
    const [startingChat, setStartingChat] = useState(false)
    const [availableTemplates, setAvailableTemplates] = useState([])
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [attachedFile, setAttachedFile] = useState(null)
    const [showHeaderDropdown, setShowHeaderDropdown] = useState(false)
    const [showAddTagsModal, setShowAddTagsModal] = useState(false)
    const [showUserInfoModal, setShowUserInfoModal] = useState(false)
    const [showDetailsModal, setShowDetailsModal] = useState(false)
    const [showInChatSearch, setShowInChatSearch] = useState(false)
    const [inChatSearchText, setInChatSearchText] = useState('')
    const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('wa_chat_sound') !== 'false')
    const [toastMessage, setToastMessage] = useState('')
    const [availableTags, setAvailableTags] = useState([])
    const [contactTags, setContactTags] = useState([])
    const [tagSearchQuery, setTagSearchQuery] = useState('')
    const [selectedTagIds, setSelectedTagIds] = useState([])
    const [loadingTags, setLoadingTags] = useState(false)
    const [loadingContactTags, setLoadingContactTags] = useState(false)
    const [savingTags, setSavingTags] = useState(false)
    const [sendError, setSendError] = useState('')
    const [isWindowOpen, setIsWindowOpen] = useState(true)
    const [secureMediaUrls, setSecureMediaUrls] = useState({})
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [messagesError, setMessagesError] = useState(null)
    const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false)
    const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
    const messagesEndRef = useRef(null)
    const headerDropdownRef = useRef(null)
    const emojiPickerRef = useRef(null)
    const templateDropdownRef = useRef(null)
    const fileInputRef = useRef(null)
    const messageInputRef = useRef(null)
    const tagInputRef = useRef(null)
    const tagModalRef = useRef(null)

    const showToast = (msg) => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(''), 4000)
    }

    const playNotificationChime = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            if (!AudioCtx) return
            const ctx = new AudioCtx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1) // A5
            gain.gain.setValueAtTime(0.15, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.35)
        } catch (e) {
            console.warn('Audio chime error:', e)
        }
    }

    const handleToggleSound = () => {
        const next = !soundEnabled
        setSoundEnabled(next)
        localStorage.setItem('wa_chat_sound', String(next))
        setShowHeaderDropdown(false)
        if (next) playNotificationChime()
        showToast(next ? '🔔 Notification sound enabled' : '🔕 Notification sound muted')
    }

    const handleExportChat = () => {
        setShowHeaderDropdown(false)
        if (!selectedChat || messages.length === 0) {
            showToast('No messages available to export.')
            return
        }
        const lines = messages.map(m => {
            const isSent = m.sender === 'bot' || m.direction === 'outgoing'
            const senderName = isSent ? 'Official WhatsApp Business' : (selectedChat.name || selectedChat.phone)
            const timeStr = m.timestamp ? new Date(m.timestamp).toLocaleString() : ''
            return `[${timeStr}] ${senderName}: ${m.text || ''}`
        })
        const fileContent = `WhatsApp Chat Transcript with ${selectedChat.name || selectedChat.phone}\nExported on: ${new Date().toLocaleString()}\n------------------------------------------------------------\n\n` + lines.join('\n')
        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `WhatsApp_Chat_${(selectedChat.name || selectedChat.phone || 'export').replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showToast('📁 Chat transcript exported successfully!')
    }

    const handleAddToOptOut = async () => {
        setShowHeaderDropdown(false)
        if (!selectedChat?.phone) return
        try {
            const res = await fetch(`${API_BASE_URL}/blacklist`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mobile: selectedChat.phone,
                    reason: 'Manual Opt-out requested from Live Chat'
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Failed to add contact to Opt-Out.')
            showToast(`🚫 +${selectedChat.phone} added to Opt-Out / Blacklist.`)
        } catch (err) {
            showToast(err.message || 'Failed to add contact to Opt-Out.')
        }
    }

    const handleViewAllChat = () => {
        setShowHeaderDropdown(false)
        setInChatSearchText('')
        setShowInChatSearch(false)
        daysFilterRef.current = 'all'
        setDaysFilter('all')
        loadConversations(false, 'all', 1)
        if (selectedChat?.id) {
            loadMessages(selectedChat.id)
            showToast('📜 Loaded complete conversation history.')
        }
    }

    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
    const [chatToDelete, setChatToDelete] = useState(null)
    const [deletingChat, setDeletingChat] = useState(false)

    const handleDeleteChat = (conv) => {
        setShowHeaderDropdown(false)
        const target = conv || selectedChat
        if (!target) return
        setChatToDelete(target)
        setShowDeleteConfirmModal(true)
    }

    const confirmDeleteChat = async () => {
        if (!chatToDelete) return
        setDeletingChat(true)
        try {
            const targetId = chatToDelete.id || chatToDelete.phone
            const res = await fetch(`${API_BASE_URL}/chat/conversations/${targetId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || 'Failed to delete chat')

            showToast(`🗑️ Chat with ${chatToDelete.name || chatToDelete.phone} deleted successfully.`)

            // Remove from local state
            setConversations(prev => prev.filter(c => c.id !== chatToDelete.id && c.phone !== chatToDelete.phone))

            // If current active chat was deleted, clear active view and abort all in-flight requests
            if (selectedChat?.id === chatToDelete.id || selectedChat?.phone === chatToDelete.phone) {
                if (activeMessageAbortControllerRef.current) {
                    try { activeMessageAbortControllerRef.current.abort() } catch (_) { }
                }
                if (olderMessageAbortControllerRef.current) {
                    try { olderMessageAbortControllerRef.current.abort() } catch (_) { }
                }
                if (silentMessageAbortControllerRef.current) {
                    try { silentMessageAbortControllerRef.current.abort() } catch (_) { }
                }
                messageRequestIdRef.current++
                olderMessageRequestIdRef.current++
                currentMessagesChatIdRef.current = null
                loadingOlderMessagesRef.current = false
                pollingMessagesInFlightRef.current = false
                isPrependingOlderRef.current = false
                oldestCursorRef.current = null
                scrollAnchorRef.current = null
                setLoadingOlderMessages(false)
                setHasMoreOlderMessages(false)
                setSelectedChat(null)
                setMessages([])
            }
            setShowDeleteConfirmModal(false)
            setChatToDelete(null)
        } catch (err) {
            console.error('Failed to delete chat:', err)
            showToast(err.message || 'Failed to delete chat. Please try again.')
        } finally {
            setDeletingChat(false)
        }
    }

    const [daysFilter, setDaysFilter] = useState('150')
    const daysFilterRef = useRef('150')
    const searchQueryRef = useRef('')
    const [conversationPage, setConversationPage] = useState(1)
    const [hasMoreConversations, setHasMoreConversations] = useState(false)
    const [loadingMoreConversations, setLoadingMoreConversations] = useState(false)
    const conversationRequestVersionRef = useRef(0)
    const loadedPageRef = useRef(1)
    const conversationQueryKeyRef = useRef('')
    const conversationInFlightRef = useRef(false)
    const currentMessagesChatIdRef = useRef(null)
    const messageRequestIdRef = useRef(0)
    const activeMessageAbortControllerRef = useRef(null)
    const isForegroundMessageLoadingRef = useRef(false)
    const searchMountedRef = useRef(false)
    const lastSelectedChatIdRef = useRef(null)
    const oldestCursorRef = useRef(null)
    const loadingOlderMessagesRef = useRef(false)
    const isPrependingOlderRef = useRef(false)
    const scrollAnchorRef = useRef(null)
    const olderMessageAbortControllerRef = useRef(null)
    const olderMessageRequestIdRef = useRef(0)
    const messagesContainerRef = useRef(null)
    const pollingConversationsInFlightRef = useRef(false)
    const pollingMessagesInFlightRef = useRef(false)
    const silentMessageAbortControllerRef = useRef(null)
    const pollingFailureCountRef = useRef(0)
    const lastSyncTimeRef = useRef(Date.now())
    const pollingTimerRef = useRef(null)
    const socketConnectedRef = useRef(false)

    const [tagFilter, setTagFilter] = useState('')
    const selectedChatRef = useRef(selectedChat)
    useEffect(() => {
        selectedChatRef.current = selectedChat
    }, [selectedChat])

    // Handle clicking outside the header dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (headerDropdownRef.current && !headerDropdownRef.current.contains(event.target)) {
                setShowHeaderDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    useEffect(() => {
        setTitle('Chat')
    }, [setTitle])

    // Load initial conversations & setup Socket.IO connection
    useEffect(() => {
        loadConversations()

        // Socket.IO server endpoint (strip /api if present)
        const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '')
        const socket = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
        })

        socket.on('connect', () => {
            console.log('⚡ Connected to Chat Socket.IO server')
            socketConnectedRef.current = true
            const orgId = user?.organization_id || user?.organizationId || user?.org_id || 1
            if (orgId) {
                socket.emit('join_organization', orgId)
                console.log(`⚡ Joined Socket organization room: organization:${orgId}`)
            }
        })

        socket.on('disconnect', () => {
            console.log('🔌 Disconnected from Chat Socket.IO server')
            socketConnectedRef.current = false
        })

        // Listen for new real-time messages
        socket.on('new_message', (msg) => {
            const msgPhone = msg.phone || msg.phone_number || ''
            const msgText = msg.text || msg.message || msg.message_text || ''
            const msgConvId = msg.conversationId || msg.conversation_id

            console.log(`[WA SOCKET RECEIVE] traceId=${msg.traceId || 'socket'} conversation_id=${msgConvId} message_id=${msg.id || msg.wamid} text=${msgText}`)

            const msgPhone10 = msgPhone ? String(msgPhone).replace(/\D/g, '').slice(-10) : ''
            const selectedPhone10 = selectedChatRef.current?.phone ? String(selectedChatRef.current.phone).replace(/\D/g, '').slice(-10) : ''
            const isForCurrentChat = selectedChatRef.current && (
                Number(msgConvId) === Number(selectedChatRef.current.id) ||
                (msgPhone10 && selectedPhone10 && msgPhone10 === selectedPhone10)
            )
            const isIncomingMsg = msg.direction === 'incoming' || msg.sender === 'contact'
            if (isIncomingMsg && soundEnabled) {
                playNotificationChime()
            }

            // If message belongs to currently open conversation, append it instantly
            if (isForCurrentChat) {
                setMessages((prev) => {
                    const exists = prev.some(m => (msg.wamid && m.wamid === msg.wamid) || (msg.id && m.id === msg.id))
                    if (exists) return prev
                    const formattedMsg = {
                        ...msg,
                        id: msg.id || Date.now(),
                        text: msgText,
                        phone: msgPhone,
                        sender: msg.sender || (msg.direction === 'outgoing' ? 'bot' : 'contact'),
                        direction: msg.direction || (msg.sender === 'contact' ? 'incoming' : 'outgoing'),
                        timestamp: msg.timestamp || new Date().toISOString(),
                    }
                    return [...prev, formattedMsg]
                })
                if (isIncomingMsg) {
                    setIsWindowOpen(true)
                }
                console.log('✔ Chat Updated: Success (Message bubble appended)')
            }

            // Update conversation list item and move to top
            setConversations((prevConvs) => {
                const convIndex = prevConvs.findIndex(c =>
                    Number(c.id) === Number(msgConvId) ||
                    (msgPhone10 && c.phone && String(c.phone).replace(/\D/g, '').slice(-10) === msgPhone10)
                )

                if (convIndex !== -1) {
                    const existingConv = prevConvs[convIndex]
                    const existingPhone10 = existingConv.phone ? String(existingConv.phone).replace(/\D/g, '').slice(-10) : ''
                    const isCurrentlyOpen = selectedChatRef.current && (
                        (existingConv.id && Number(selectedChatRef.current.id) === Number(existingConv.id)) ||
                        (selectedPhone10 && existingPhone10 && selectedPhone10 === existingPhone10) ||
                        (msgPhone10 && selectedPhone10 && msgPhone10 === selectedPhone10)
                    )
                    const updatedConv = {
                        ...existingConv,
                        lastMessage: msgText,
                        lastMessageTime: msg.timestamp || new Date().toISOString(),
                        unreadCount: isCurrentlyOpen ? 0 : (isIncomingMsg ? (existingConv.unreadCount || 0) + 1 : existingConv.unreadCount),
                        hasReplied: existingConv.hasReplied || (isIncomingMsg ? 1 : 0),
                    }
                    if (isCurrentlyOpen && isIncomingMsg) {
                        markChatAsRead(selectedChatRef.current)
                    }
                    const rest = prevConvs.filter((_, idx) => idx !== convIndex)
                    console.log('✔ Chat Updated: Success (Moved conversation to top)')
                    return [updatedConv, ...rest]
                } else {
                    // Add new conversation to sidebar for any message
                    const isCurrentlyOpen = selectedChatRef.current && (
                        (selectedChatRef.current.id && Number(selectedChatRef.current.id) === Number(msgConvId)) ||
                        (msgPhone10 && selectedPhone10 && msgPhone10 === selectedPhone10)
                    )
                    const newConvItem = {
                        id: Number(msgConvId),
                        name: msg.contactName || msg.name || (msgPhone ? `+${msgPhone}` : 'WhatsApp User'),
                        phone: msgPhone,
                        lastMessage: msgText,
                        lastMessageTime: msg.timestamp || new Date().toISOString(),
                        unreadCount: isCurrentlyOpen ? 0 : (isIncomingMsg ? 1 : 0),
                        hasReplied: isIncomingMsg ? 1 : 0,
                        instanceId: msg.instanceId || msg.instance_id || 'default'
                    }
                    if (isCurrentlyOpen) {
                        markChatAsRead(selectedChatRef.current)
                    }
                    console.log('✔ Chat Updated: Success (Conversation added to sidebar)')
                    return [newConvItem, ...prevConvs]
                }
            })
        })

        // Listen for conversation updates (re-ordering, unread count changes, etc.)
        socket.on('conversation_updated', (updatedConv) => {
            console.log('🔄 Real-time conversation_updated:', updatedConv)
            setConversations((prevConvs) => {
                const updatePhone10 = updatedConv.phone ? String(updatedConv.phone).replace(/\D/g, '').slice(-10) : ''
                const selectedPhone10 = selectedChatRef.current?.phone ? String(selectedChatRef.current.phone).replace(/\D/g, '').slice(-10) : ''
                const convIndex = prevConvs.findIndex(c =>
                    (updatedConv.id && Number(c.id) === Number(updatedConv.id)) ||
                    (updatePhone10 && c.phone && String(c.phone).replace(/\D/g, '').slice(-10) === updatePhone10)
                )

                if (convIndex !== -1) {
                    const existingConv = prevConvs[convIndex]
                    const existingPhone10 = existingConv.phone ? String(existingConv.phone).replace(/\D/g, '').slice(-10) : ''
                    const isCurrentlyOpen = selectedChatRef.current && (
                        (existingConv.id && Number(selectedChatRef.current.id) === Number(existingConv.id)) ||
                        (selectedPhone10 && existingPhone10 && selectedPhone10 === existingPhone10) ||
                        (updatePhone10 && selectedPhone10 && updatePhone10 === selectedPhone10)
                    )
                    const merged = {
                        ...existingConv,
                        ...updatedConv,
                        unreadCount: isCurrentlyOpen ? 0 : updatedConv.unreadCount,
                        hasReplied: existingConv.hasReplied || (updatedConv.hasReplied ? 1 : 0),
                    }
                    const rest = prevConvs.filter((_, idx) => idx !== convIndex)
                    return [merged, ...rest]
                } else {
                    return [updatedConv, ...prevConvs]
                }
            })
        })

        // Listen for real-time status updates (sent -> delivered -> read)
        socket.on('message_status_updated', ({ wamid, status, conversationId }) => {
            console.log(`✓ Real-time status update: ${wamid} -> ${status}`)
            if (wamid) {
                setMessages((prev) =>
                    prev.map(m => m.wamid === wamid ? { ...m, status } : m)
                )
            }
        })

        // Listen for real-time conversation deletion
        socket.on('conversation_deleted', (data) => {
            if (data?.id) {
                setConversations(prev => prev.filter(c => Number(c.id) !== Number(data.id) && c.phone !== data.phone))
                if (selectedChatRef.current && (Number(selectedChatRef.current.id) === Number(data.id) || selectedChatRef.current.phone === data.phone)) {
                    setSelectedChat(null)
                    setMessages([])
                }
            }
        })

        // Silent background sync timer (every 4s) ensuring instant delivery even if socket/webhook delays
        const syncTimer = setInterval(() => {
            if (!conversationInFlightRef.current && !isForegroundMessageLoadingRef.current) {
                loadConversations(true)
                // Silent background sync with overlap guards, failure backoff, and tab visibility/focus throttling
                const executeSync = async () => {
                    if (typeof navigator !== 'undefined' && !navigator.onLine) return
                    lastSyncTimeRef.current = Date.now()

                    // 1. Sync conversations if not already in-flight and not foreground loading
                    if (!conversationInFlightRef.current && !pollingConversationsInFlightRef.current && !isForegroundMessageLoadingRef.current) {
                        try {
                            await loadConversations(true)
                            pollingFailureCountRef.current = 0
                        } catch (err) {
                            console.warn('[Sync] Background conversations poll error:', err?.message)
                            pollingFailureCountRef.current++
                        }
                    }
                    if (selectedChatRef.current?.id && !isForegroundMessageLoadingRef.current) {
                        loadMessages(selectedChatRef.current.id, true)

                        // 2. Sync messages for selected chat if open, not in-flight and not foreground loading
                        const activeChatId = selectedChatRef.current?.id
                        if (activeChatId && !isForegroundMessageLoadingRef.current && !pollingMessagesInFlightRef.current) {
                            try {
                                await loadMessages(activeChatId, true)
                                pollingFailureCountRef.current = 0
                            } catch (err) {
                                if (err?.name !== 'AbortError') {
                                    console.warn('[Sync] Background messages poll error:', err?.message)
                                    pollingFailureCountRef.current++
                                }
                            }
                        }
                    }, 4000)
    }

        // Adaptive polling scheduler: adjusts interval based on tab visibility, focus, socket state, and errors
        const scheduleNextPoll = () => {
        if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current)
            pollingTimerRef.current = null
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) return

        let interval = 10000 // 10s default when active and visible
        const isVisible = typeof document !== 'undefined' ? !document.hidden : true
        const isFocused = typeof document !== 'undefined' && document.hasFocus ? document.hasFocus() : true

        if (!isVisible) {
            interval = 60000 // 60s when tab is hidden in background
        } else if (!isFocused) {
            interval = 20000 // 20s when visible but window is blurred
        } else if (!socketConnectedRef.current) {
            interval = 6000 // 6s fallback when Socket.IO disconnected
        }

        // Exponential backoff on consecutive network/server errors
        if (pollingFailureCountRef.current > 0) {
            const backoff = Math.min(60000, interval * Math.pow(1.5, Math.min(pollingFailureCountRef.current, 5)))
            interval = Math.round(backoff)
        }

        pollingTimerRef.current = setTimeout(async () => {
            await executeSync()
            scheduleNextPoll()
        }, interval)
    }

    // Start initial adaptive poll
    scheduleNextPoll()

    // Visibility & focus change handlers for instant recovery on tab return
    const handleVisibilityChange = () => {
        if (typeof document !== 'undefined' && !document.hidden) {
            const elapsed = Date.now() - lastSyncTimeRef.current
            if (elapsed >= 8000) {
                executeSync()
            }
        }
        scheduleNextPoll()
    }

    const handleFocus = () => {
        const elapsed = Date.now() - lastSyncTimeRef.current
        if (elapsed >= 8000) {
            executeSync()
        }
        scheduleNextPoll()
    }

    const handleBlur = () => {
        scheduleNextPoll()
    }

    const handleOnline = () => {
        pollingFailureCountRef.current = 0
        executeSync()
        scheduleNextPoll()
    }

    const handleOffline = () => {
        if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current)
            pollingTimerRef.current = null
        }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
        clearInterval(syncTimer)
        if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current)
            pollingTimerRef.current = null
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('focus', handleFocus)
        window.removeEventListener('blur', handleBlur)
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        socket.disconnect()
        socketConnectedRef.current = false
        if (activeMessageAbortControllerRef.current) {
            try { activeMessageAbortControllerRef.current.abort() } catch (_) { }
        }
        if (olderMessageAbortControllerRef.current) {
            try { olderMessageAbortControllerRef.current.abort() } catch (_) { }
        }
        if (silentMessageAbortControllerRef.current) {
            try { silentMessageAbortControllerRef.current.abort() } catch (_) { }
        }
        messageRequestIdRef.current++
        olderMessageRequestIdRef.current++
        currentMessagesChatIdRef.current = null
        pollingConversationsInFlightRef.current = false
        pollingMessagesInFlightRef.current = false
    }
}, [token])

// Helper to mark conversation as read in state & on server
const markChatAsRead = async (chat) => {
    if (!chat) return
    const targetId = chat.id || chat.phone
    if (!targetId) return

    const chatPhone10 = chat.phone ? String(chat.phone).replace(/\D/g, '').slice(-10) : ''

    // 1. Immediately zero unreadCount in conversations list
    setConversations(prev =>
        prev.map(c => {
            const cPhone10 = c.phone ? String(c.phone).replace(/\D/g, '').slice(-10) : ''
            const isMatch = (chat.id && c.id && Number(c.id) === Number(chat.id)) ||
                (chatPhone10 && cPhone10 && chatPhone10 === cPhone10)
            return isMatch ? { ...c, unreadCount: 0 } : c
        })
    )

    // 2. Clear unreadCount on selectedChat object
    setSelectedChat(prev => {
        if (!prev) return prev
        const prevPhone10 = prev.phone ? String(prev.phone).replace(/\D/g, '').slice(-10) : ''
        const isMatch = (chat.id && prev.id && Number(prev.id) === Number(chat.id)) ||
            (chatPhone10 && prevPhone10 && chatPhone10 === prevPhone10)
        return isMatch ? { ...prev, unreadCount: 0 } : prev
    })

    // 3. Post to backend to mark read in database
    try {
        await fetch(`${API_BASE_URL}/chat/conversations/${targetId}/read`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
    } catch (err) {
        console.error('Failed to mark conversation read on server:', err)
    }
}

const handleSelectChat = (conv) => {
    if (!conv) return
    const updatedChat = { ...conv, unreadCount: 0 }
    const chatId = conv.id || conv.phone
    lastSelectedChatIdRef.current = chatId

    // Invalidate in-flight older requests and reset pagination cursors
    // Invalidate in-flight older requests and silent polling, and reset pagination cursors
    if (olderMessageAbortControllerRef.current) {
        try { olderMessageAbortControllerRef.current.abort() } catch (_) { }
    }
    if (silentMessageAbortControllerRef.current) {
        try { silentMessageAbortControllerRef.current.abort() } catch (_) { }
    }
    olderMessageRequestIdRef.current++
    loadingOlderMessagesRef.current = false
    pollingMessagesInFlightRef.current = false
    setLoadingOlderMessages(false)
    setHasMoreOlderMessages(false)
    oldestCursorRef.current = null
    scrollAnchorRef.current = null
    isPrependingOlderRef.current = false

    setSelectedChat(updatedChat)
    markChatAsRead(updatedChat)
    if (chatId) {
        loadMessages(chatId, false)
    }
}

// Load messages and clear unread count when a chat is selected
useEffect(() => {
    if (selectedChat) {
        const chatId = selectedChat.id || selectedChat.phone
        if (chatId && lastSelectedChatIdRef.current !== chatId) {
            lastSelectedChatIdRef.current = chatId
            loadMessages(chatId, false)
        }
        markChatAsRead(selectedChat)
    }
}, [selectedChat?.id, selectedChat?.phone])

useEffect(() => {
    if (!selectedChat?.id) {
        setContactTags([])
        setSelectedTagIds([])
        return
    }
    loadContactTags(selectedChat.id)
}, [selectedChat?.id])

useEffect(() => {
    if (!showAddTagsModal) return

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            setShowAddTagsModal(false)
        }
        if (event.key === 'Enter' && tagSearchQuery.trim()) {
            const filteredTags = (availableTags || []).filter((tag) => tag && String(tag.name || '').toLowerCase().includes((tagSearchQuery || '').toLowerCase()))
            const firstSelectable = filteredTags.find((tag) => tag?.id && !(selectedTagIds || []).includes(Number(tag.id)))
            if (firstSelectable) {
                event.preventDefault()
                handleToggleSelectedTag(firstSelectable.id)
            }
        }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
}, [showAddTagsModal, availableTags, selectedTagIds, tagSearchQuery])

useEffect(() => {
    if (showAddTagsModal) {
        setTimeout(() => tagInputRef.current?.focus(), 50)
    }
}, [showAddTagsModal])

// Synchronously restore scroll position after React commits prepended older messages
useLayoutEffect(() => {
    if (scrollAnchorRef.current && messagesContainerRef.current) {
        const { prevScrollHeight, prevScrollTop } = scrollAnchorRef.current
        const container = messagesContainerRef.current
        const heightDiff = container.scrollHeight - prevScrollHeight
        container.scrollTop = prevScrollTop + heightDiff
        scrollAnchorRef.current = null
    }
}, [messages])

// Auto-scroll to bottom when new messages arrive (unless prepending older messages)
useEffect(() => {
    if (isPrependingOlderRef.current) {
        isPrependingOlderRef.current = false
        return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])

const deduplicateConversations = (convs) => {
    if (!Array.isArray(convs)) return []
    const activeChat = selectedChatRef.current
    const activePhone10 = activeChat?.phone ? String(activeChat.phone).replace(/\D/g, '').slice(-10) : ''
    const map = new Map()
    for (const c of convs) {
        const cPhone10 = c.phone ? String(c.phone).replace(/\D/g, '').slice(-10) : ''
        const key = String(c.id || `${c.whatsapp_account_id || c.whatsappAccountId || c.instanceId || 'unassigned'}:${c.phone}`)
        const isCurrentlyOpen = activeChat && (
            (activeChat.id && c.id && Number(activeChat.id) === Number(c.id)) ||
            (activePhone10 && cPhone10 && activePhone10 === cPhone10)
        )
        const item = isCurrentlyOpen ? { ...c, unreadCount: 0 } : c

        if (!map.has(key)) {
            map.set(key, item)
        } else {
            const existing = map.get(key)
            const existingTime = new Date(existing.lastMessageTime || 0).getTime()
            const currentTime = new Date(c.lastMessageTime || 0).getTime()
            if (currentTime >= existingTime) {
                map.set(key, { ...existing, ...item, unreadCount: isCurrentlyOpen ? 0 : item.unreadCount })
            } else if (isCurrentlyOpen) {
                map.set(key, { ...existing, unreadCount: 0 })
            }
        }
    }
    return Array.from(map.values()).sort((a, b) =>
        new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime()
    )
}

const loadAvailableTags = async () => {
    setLoadingTags(true)
    try {
        const data = await getTags()
        const list = Array.isArray(data?.tags) ? data.tags : (Array.isArray(data) ? data : [])
        setAvailableTags(list)
    } catch (err) {
        console.error('Failed to load tags:', err)
        setAvailableTags([])
    } finally {
        setLoadingTags(false)
    }
}

const loadContactTags = async (chatId) => {
    if (!chatId) {
        setContactTags([])
        setSelectedTagIds([])
        return
    }

    setLoadingContactTags(true)
    try {
        const data = await getChatTags(chatId)
        const tags = Array.isArray(data?.tags) ? data.tags : (Array.isArray(data) ? data : [])
        setContactTags(tags)
        setSelectedTagIds(tags.map((tag) => Number(tag?.id)).filter(Boolean))
    } catch (err) {
        console.error('Failed to load chat tags:', err)
        setContactTags([])
        setSelectedTagIds([])
    } finally {
        setLoadingContactTags(false)
    }
}

const handleOpenAddTagsModal = async () => {
    setTagSearchQuery('')
    setShowAddTagsModal(true)
    await Promise.all([
        loadAvailableTags(),
        loadContactTags(selectedChat?.id),
    ])
}

useEffect(() => {
    const handleTagsUpdated = () => {
        loadAvailableTags()
        if (selectedChat?.id) {
            loadContactTags(selectedChat.id)
        }
    }

    window.addEventListener('tags:updated', handleTagsUpdated)
    return () => window.removeEventListener('tags:updated', handleTagsUpdated)
}, [selectedChat?.id])

const handleToggleSelectedTag = (tagId) => {
    if (!tagId) return
    const numericId = Number(tagId)
    setSelectedTagIds((prev) => {
        const current = Array.isArray(prev) ? prev : []
        if (current.includes(numericId)) {
            return current.filter((id) => Number(id) !== numericId)
        }
        return [...current, numericId]
    })
}

const handleSaveTags = async () => {
    if (!selectedChat?.id) {
        showToast('Please select a chat first.')
        return
    }

    const normalizedSelectedIds = [...new Set((selectedTagIds || []).map((id) => Number(id)).filter(Boolean))]
    const currentTagIds = new Set((contactTags || []).map((tag) => Number(tag?.id)).filter(Boolean))
    const toAdd = normalizedSelectedIds.filter((id) => !currentTagIds.has(id))
    const toRemove = (contactTags || []).filter((tag) => tag?.id && !normalizedSelectedIds.includes(Number(tag.id)))

    setSavingTags(true)
    try {
        if (toAdd.length > 0) {
            await assignTagsToChat(selectedChat.id, toAdd)
        }

        if (toRemove.length > 0) {
            await Promise.all(toRemove.map(async (tag) => {
                await removeTagFromChat(selectedChat.id, tag.id)
            }))
        }

        await loadContactTags(selectedChat.id)
        setShowAddTagsModal(false)
        setTagSearchQuery('')
        showToast('🏷️ Tags updated successfully.')
    } catch (err) {
        showToast('Failed to update tags: ' + (err.message || 'Error'))
    } finally {
        setSavingTags(false)
    }
}

const handleRemoveAssignedTag = async (tagId) => {
    if (!selectedChat?.id || !tagId) return

    try {
        await removeTagFromChat(selectedChat.id, tagId)
        await loadContactTags(selectedChat.id)
        showToast('🏷️ Tag removed.')
    } catch (err) {
        showToast('Failed to remove tag: ' + (err.message || 'Error'))
    }
}

// Paginated conversation loading. Only page 1 is refreshed by the 4-second poll.
// A request version prevents an old filter's response overwriting a newer selection.
const loadConversations = async (silent = false, daysOverride = null, page = 1) => {
    if (page > 1 && conversationInFlightRef.current) return
    if (silent && page === 1 && pollingConversationsInFlightRef.current) return
    if (page > 1) {
        if (!hasMoreConversations) return
        conversationInFlightRef.current = true
        setLoadingMoreConversations(true)
    } else if (!silent) {
        setLoading(true)
    } else {
        pollingConversationsInFlightRef.current = true
    }
    const requestedVersion = ++conversationRequestVersionRef.current
    try {
        const searchParams = new URLSearchParams(window.location.search)
        const activeId = searchParams.get('account_id') || localStorage.getItem('active_wa_account_id') || ''
        const targetDays = daysOverride !== null ? daysOverride : daysFilterRef.current
        const query = searchQueryRef.current.trim()
        const key = `${activeId}|${targetDays}|${query}`
        if (page > 1 && key !== conversationQueryKeyRef.current) return
        const params = new URLSearchParams({ days: targetDays, page: String(page), limit: '100' })
        if (activeId) params.set('account_id', activeId)
        if (query) params.set('search', query)
        const res = await fetch(`${API_BASE_URL}/chat/conversations?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error(`Could not load conversations (${res.status})`)
        const data = await res.json()
        if (requestedVersion !== conversationRequestVersionRef.current) return
        const rows = Array.isArray(data.conversations) ? data.conversations : []
        if (page === 1) {
            const sameQuery = conversationQueryKeyRef.current === key
            conversationQueryKeyRef.current = key
            if (!silent || !sameQuery) {
                loadedPageRef.current = 1
                setConversationPage(1)
            }
            // Preserve already-loaded older pages while polling, but reset on filter/search change.
            setConversations(prev => deduplicateConversations(
                sameQuery && silent
                    ? [...rows, ...prev]
                    : rows
            ))
        } else {
            loadedPageRef.current = page
            setConversationPage(page)
            setConversations(prev => deduplicateConversations([...prev, ...rows]))
        }
        const total = Number(data.total)
        if (!(page === 1 && silent && loadedPageRef.current > 1)) {
            setHasMoreConversations(Number.isFinite(total)
                ? page * Number(data.limit || 100) < total
                : rows.length === 100)
        }
        if (data.officialNumber) setOfficialNumber(data.officialNumber)
        else if (page === 1) fetchDashboardPhone()
    } catch (err) {
        console.error('Failed to load conversations:', err)
        if (!silent) showToast(err.message || 'Unable to load conversations')
    } finally {
        if (page > 1) {
            conversationInFlightRef.current = false
            setLoadingMoreConversations(false)
        } else if (!silent) setLoading(false)
    } else if (!silent) {
        setLoading(false)
    } else {
        pollingConversationsInFlightRef.current = false
    }
}
    }

// LOAD_ALL_OLDER_CONVERSATIONS_V1
// One click loads every remaining page for the selected account/filter.
const loadAllOlderConversations = async () => {
    if (conversationInFlightRef.current || !hasMoreConversations) return

    conversationInFlightRef.current = true
    setLoadingMoreConversations(true)

    const searchParams = new URLSearchParams(window.location.search)
    const activeId = searchParams.get('account_id') || localStorage.getItem('active_wa_account_id') || ''
    const targetDays = daysFilterRef.current
    const query = searchQueryRef.current.trim()
    const key = `${activeId}|${targetDays}|${query}`

    let page = loadedPageRef.current + 1
    const limit = 100

    try {
        while (conversationQueryKeyRef.current === key) {
            const params = new URLSearchParams({
                days: targetDays,
                page: String(page),
                limit: String(limit)
            })

            if (activeId) params.set('account_id', activeId)
            if (query) params.set('search', query)

            const res = await fetch(
                `${API_BASE_URL}/chat/conversations?${params}`,
                { headers: { Authorization: `Bearer ${token}` } }
            )

            if (!res.ok) {
                throw new Error(`Could not load conversations (${res.status})`)
            }

            const data = await res.json()

            // Do not mix conversations after account/search/filter changes.
            const currentSearchParams = new URLSearchParams(window.location.search)
            const currentAccount = currentSearchParams.get('account_id') || localStorage.getItem('active_wa_account_id') || ''

            if (
                conversationQueryKeyRef.current !== key ||
                currentAccount !== activeId
            ) break

            const rows = Array.isArray(data.conversations)
                ? data.conversations
                : []

            setConversations(prev =>
                deduplicateConversations([...prev, ...rows])
            )

            loadedPageRef.current = page
            setConversationPage(page)

            const total = Number(data.total)
            const more = typeof data.hasMore === 'boolean'
                ? data.hasMore
                : Number.isFinite(total)
                    ? page * limit < total
                    : rows.length === limit

            setHasMoreConversations(more)

            if (!more) break

            page++
        }
    } catch (err) {
        console.error('Failed to load older conversations:', err)
        showToast(err.message || 'Could not load all older conversations')
    } finally {
        conversationInFlightRef.current = false
        setLoadingMoreConversations(false)
    }
}

// Keep the latest search/filter available to the original socket and polling effect.
useEffect(() => {
    searchQueryRef.current = searchQuery
    if (!searchMountedRef.current) {
        searchMountedRef.current = true
        return
    }
    const timer = setTimeout(() => {
        conversationRequestVersionRef.current++
        conversationQueryKeyRef.current = ''
        setHasMoreConversations(false)
        loadConversations(false, daysFilterRef.current, 1)
    }, 250)
    return () => clearTimeout(timer)
}, [searchQuery])

const fetchDashboardPhone = async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
            const dashData = await res.json()
            if (dashData.company?.phone && dashData.company.phone !== '-') {
                setOfficialNumber(dashData.company.phone)
            }
        }
    } catch (e) {
        console.error('Failed to fetch dashboard phone:', e)
    }
}

useEffect(() => {
    // Fetch approved templates for direct sending
    const fetchTemplates = async () => {
        try {
            const activeId = localStorage.getItem('active_wa_account_id') || ''
            const url = activeId ? `${API_BASE_URL}/meta-templates?account_id=${activeId}` : `${API_BASE_URL}/meta-templates`
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` },
            })
            if (res.ok) {
                const data = await res.json()
                const rawList = Array.isArray(data) ? data : (data.templates || data.data || [])
                const list = Array.isArray(rawList) ? rawList : []
                const approvedList = list.filter(t => !t.status || String(t.status).toUpperCase() === 'APPROVED')
                setAvailableTemplates(approvedList)
            }
        } catch (err) {
            console.error('Failed to fetch templates in chat:', err)
        }
    }
    fetchTemplates()
}, [token])

const loadMessages = async (conversationId, silent = false) => {
    if (!conversationId) return

    // If background polling fires while a foreground fetch is active, skip it
    if (silent && isForegroundMessageLoadingRef.current) return
    // If background polling fires while a foreground fetch or another poll is active, skip it
    if (silent && (isForegroundMessageLoadingRef.current || pollingMessagesInFlightRef.current)) return

    // If this is an explicit foreground fetch, abort any previous in-flight fetch and reset states
    if (!silent) {
        if (activeMessageAbortControllerRef.current) {
            try {
                activeMessageAbortControllerRef.current.abort()
            } catch (_) { }
        }
        if (olderMessageAbortControllerRef.current) {
            try {
                olderMessageAbortControllerRef.current.abort()
            } catch (_) { }
        }
        if (silentMessageAbortControllerRef.current) {
            try {
                silentMessageAbortControllerRef.current.abort()
            } catch (_) { }
        }
        olderMessageRequestIdRef.current++
        loadingOlderMessagesRef.current = false
        pollingMessagesInFlightRef.current = false
        isPrependingOlderRef.current = false
        oldestCursorRef.current = null
        scrollAnchorRef.current = null
        setLoadingOlderMessages(false)
        setHasMoreOlderMessages(false)

        activeMessageAbortControllerRef.current = new AbortController()
        isForegroundMessageLoadingRef.current = true
        setLoadingMessages(true)
        setMessagesError(null)
        setMessages([])
    } else {
        pollingMessagesInFlightRef.current = true
        if (silentMessageAbortControllerRef.current) {
            try { silentMessageAbortControllerRef.current.abort() } catch (_) { }
        }
        silentMessageAbortControllerRef.current = new AbortController()
    }

    const currentRequestId = ++messageRequestIdRef.current
    currentMessagesChatIdRef.current = conversationId
    const signal = !silent && activeMessageAbortControllerRef.current ? activeMessageAbortControllerRef.current.signal : undefined
    const signal = silent
        ? silentMessageAbortControllerRef.current?.signal
        : activeMessageAbortControllerRef.current?.signal

    try {
        const res = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
            const url = silent
                ? `${API_BASE_URL}/chat/messages/${conversationId}?silent=1`
                : `${API_BASE_URL}/chat/messages/${conversationId}`

            const res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal
                })

            // Guard against stale response if another request was initiated
            if(messageRequestIdRef.current !== currentRequestId) return
        if (String(currentMessagesChatIdRef.current) !== String(conversationId)) return

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            if (!silent) {
                setMessagesError(data.message || `Failed to load messages (${res.status})`)
            }
            return
        }

        const data = await res.json()
        if (messageRequestIdRef.current !== currentRequestId) return
        if (String(currentMessagesChatIdRef.current) !== String(conversationId)) return

        const fetchedMessages = Array.isArray(data.messages) ? data.messages : []
        setMessages((prev) => {
            if (silent && prev.length === fetchedMessages.length && prev.length > 0) {
                const lastPrevId = prev[prev.length - 1].id || prev[prev.length - 1].wamid
                const lastDataId = fetchedMessages[fetchedMessages.length - 1].id || fetchedMessages[fetchedMessages.length - 1].wamid
                if (lastPrevId === lastDataId) return prev
                if (!silent) {
                    return fetchedMessages
                }
                return fetchedMessages
                if (!prev || prev.length === 0) {
                    return fetchedMessages
                }
                if (fetchedMessages.length === 0) {
                    return prev
                }

                // Smart merge: update message statuses and append new messages without wiping older history
                const prevMap = new Map()
                for (let i = 0; i < prev.length; i++) {
                    const m = prev[i]
                    const k = String(m.id || m.wamid || `idx_${i}`)
                    prevMap.set(k, { item: m, index: i })
                }

                let hasChanges = false
                const updatedList = [...prev]
                const newToAppend = []

                for (const fetched of fetchedMessages) {
                    const k = String(fetched.id || fetched.wamid || '')
                    if (k && prevMap.has(k)) {
                        const { item: existing, index } = prevMap.get(k)
                        if (existing.status !== fetched.status || existing.text !== fetched.text || existing.mediaUrl !== fetched.mediaUrl) {
                            updatedList[index] = { ...existing, ...fetched }
                            hasChanges = true
                        }
                    } else {
                        newToAppend.push(fetched)
                        hasChanges = true
                    }
                }

                if (!hasChanges) {
                    return prev
                }

                if (newToAppend.length > 0) {
                    return [...updatedList, ...newToAppend]
                }
                return updatedList
            })

        // Store pagination cursor and older records availability
        setHasMoreOlderMessages(Boolean(data.hasMoreOlder))
        if (data.oldestCursor) {
            oldestCursorRef.current = data.oldestCursor
        } else if (fetchedMessages.length > 0) {
            oldestCursorRef.current = { id: fetchedMessages[0].id, timestamp: fetchedMessages[0].timestamp }
        } else {
            oldestCursorRef.current = null
            // Store pagination cursor and older records availability (do not overwrite older cursor during background poll)
            if (!silent || !oldestCursorRef.current) {
                setHasMoreOlderMessages(Boolean(data.hasMoreOlder))
                if (data.oldestCursor) {
                    oldestCursorRef.current = data.oldestCursor
                } else if (fetchedMessages.length > 0) {
                    oldestCursorRef.current = { id: fetchedMessages[0].id, timestamp: fetchedMessages[0].timestamp }
                } else {
                    oldestCursorRef.current = null
                }
            }

            if (data.isWindowOpen !== undefined) {
                setIsWindowOpen(Boolean(data.isWindowOpen))
            }
            if (!silent) {
                setMessagesError(null)
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                return
            }
            console.error('Failed to load messages:', err)
            if (messageRequestIdRef.current === currentRequestId && !silent) {
                setMessagesError(err.message || 'Network error while loading messages')
            }
        } finally {
            if (messageRequestIdRef.current === currentRequestId && !silent) {
                if (silent) {
                    pollingMessagesInFlightRef.current = false
                } else if (messageRequestIdRef.current === currentRequestId) {
                    isForegroundMessageLoadingRef.current = false
                    setLoadingMessages(false)
                }
            }
        }

        const loadOlderMessages = async () => {
            if (!selectedChat?.id || loadingOlderMessagesRef.current || !hasMoreOlderMessages) return
            const container = messagesContainerRef.current
            if (!container) return

            const oldest = oldestCursorRef.current
            if (!oldest || !oldest.id || !oldest.timestamp) return

            loadingOlderMessagesRef.current = true
            setLoadingOlderMessages(true)

            // Cancel any in-flight older-messages request and increment request sequence
            if (olderMessageAbortControllerRef.current) {
                try { olderMessageAbortControllerRef.current.abort() } catch (_) { }
            }
            const currentOlderReqId = ++olderMessageRequestIdRef.current
            const abortController = new AbortController()
            olderMessageAbortControllerRef.current = abortController

            // Capture scroll anchor metrics before fetching
            const prevScrollHeight = container.scrollHeight
            const prevScrollTop = container.scrollTop

            try {
                const params = new URLSearchParams({
                    limit: '50',
                    before_id: String(oldest.id),
                    before_ts: String(oldest.timestamp)
                })

                const res = await fetch(`${API_BASE_URL}/chat/messages/${selectedChat.id}?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: abortController.signal
                })

                if (olderMessageRequestIdRef.current !== currentOlderReqId) return
                if (String(currentMessagesChatIdRef.current) !== String(selectedChat.id)) return

                if (!res.ok) throw new Error('Failed to load older messages')
                const data = await res.json()

                if (olderMessageRequestIdRef.current !== currentOlderReqId) return
                if (String(currentMessagesChatIdRef.current) !== String(selectedChat.id)) return

                const olderBatch = Array.isArray(data.messages) ? data.messages : []
                if (olderBatch.length > 0) {
                    isPrependingOlderRef.current = true
                    scrollAnchorRef.current = { prevScrollHeight, prevScrollTop }

                    if (data.oldestCursor) {
                        oldestCursorRef.current = data.oldestCursor
                    } else {
                        oldestCursorRef.current = { id: olderBatch[0].id, timestamp: olderBatch[0].timestamp }
                    }
                    setHasMoreOlderMessages(Boolean(data.hasMoreOlder))

                    setMessages((prev) => {
                        const existingIds = new Set(prev.map(m => String(m.id || m.wamid)))
                        const filteredOlder = olderBatch.filter(m => !existingIds.has(String(m.id || m.wamid)))
                        return [...filteredOlder, ...prev]
                    })
                } else {
                    setHasMoreOlderMessages(false)
                }
            } catch (err) {
                if (err.name === 'AbortError') return
                console.error('Failed to load older messages:', err)
            } finally {
                if (olderMessageRequestIdRef.current === currentOlderReqId) {
                    loadingOlderMessagesRef.current = false
                    setLoadingOlderMessages(false)
                }
            }
        }

        const handleMessagesScroll = (e) => {
            const container = e.currentTarget
            if (container.scrollTop < 60 && hasMoreOlderMessages && !loadingOlderMessagesRef.current) {
                loadOlderMessages()
            }
        }

        const handleStartNewChat = async (e) => {
            e.preventDefault()
            if (!newChatPhone.trim() || startingChat) return

            setStartingChat(true)
            try {
                const activeId = localStorage.getItem('active_wa_account_id') || ''
                const res = await fetch(`${API_BASE_URL}/chat/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        phone: newChatPhone.trim(),
                        name: newChatName.trim(),
                        accountId: activeId || undefined
                    }),
                })

                const data = await res.json()
                if (res.ok && data.conversation) {
                    setNewChatPhone('')
                    setNewChatName('')
                    setShowNewChatModal(false)
                    setSelectedChat(data.conversation)
                    setMessages([])
                    await loadConversations()
                    await loadMessages(data.conversation.id)
                } else {
                    alert(data.message || 'Failed to start conversation')
                }
            } catch (err) {
                alert('Failed to start conversation: ' + err.message)
            } finally {
                setStartingChat(false)
            }
        }

        const EMOJI_LIST = [
            '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐',
            '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪',
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
            '🔥', '⭐', '🌟', '✨', '💥', '💯', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎯', '🚀', '💡', '📞', '📱', '💬', '📧', '🛒', '🛍️', '📦', '💰', '💳', '🏷️', '📅', '⏰', '📍', '📌', '💼', '📢', '🔔', '📣', '🎂', '🍰', '☕', '🍵', '✅', '❌', '⚠️', 'ℹ️'
        ]

        const handleEmojiClick = (emoji) => {
            setNewMessage(prev => prev + emoji)
            if (messageInputRef.current) {
                messageInputRef.current.focus()
            }
        }

        const handleFileSelect = (e) => {
            const file = e.target.files?.[0]
            if (!file) return

            if (file.size > 15 * 1024 * 1024) {
                alert('File size exceeds 15MB limit.')
                return
            }

            const reader = new FileReader()
            reader.onload = (event) => {
                setAttachedFile({
                    file,
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    base64: event.target.result,
                    previewUrl: file.type?.startsWith('image/') ? event.target.result : null
                })
            }
            reader.readAsDataURL(file)
            e.target.value = ''
        }

        const sendMessage = async (e) => {
            if (e) e.preventDefault()
            if ((!newMessage.trim() && !attachedFile) || !selectedChat || sending) return

            const messageText = newMessage.trim()
            const currentAttached = attachedFile

            setSending(true)
            setSendError('')
            setNewMessage('')
            setAttachedFile(null)
            setShowEmojiPicker(false)

            try {
                const activeId = localStorage.getItem('active_wa_account_id') || ''
                const payload = {
                    conversationId: selectedChat.id,
                    message: messageText || undefined,
                    accountId: activeId || undefined
                }

                if (currentAttached) {
                    payload.mediaBase64 = currentAttached.base64
                    payload.mimeType = currentAttached.type
                    payload.fileName = currentAttached.name
                    payload.type = currentAttached.type?.startsWith('image/')
                        ? 'image'
                        : currentAttached.type?.startsWith('video/')
                            ? 'video'
                            : currentAttached.type?.startsWith('audio/')
                                ? 'audio'
                                : 'document'
                }

                const res = await fetch(`${API_BASE_URL}/chat/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                })

                const data = await res.json()
                if (res.ok) {
                    const msgData = data.message || {
                        id: Date.now(),
                        text: messageText || `[Attachment: ${currentAttached?.name}]`,
                        sender: 'bot',
                        direction: 'outgoing',
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                    }
                    setMessages((prev) => {
                        const exists = prev.some(m => (msgData.wamid && m.wamid === msgData.wamid) || (msgData.id && m.id === msgData.id))
                        if (exists) return prev
                        return [...prev, msgData]
                    })
                    loadConversations(true)
                } else {
                    setNewMessage(messageText)
                    if (currentAttached) setAttachedFile(currentAttached)
                    if (data.code === '24H_WINDOW_CLOSED') {
                        setSendError('⏳ 24-hour customer window expired. Please click the "Template" button to start the conversation with an approved template.')
                    } else {
                        setSendError(data.message || 'Failed to send message')
                    }
                }
            } catch (err) {
                setNewMessage(messageText)
                if (currentAttached) setAttachedFile(currentAttached)
                setSendError('Failed to send message: ' + err.message)
            } finally {
                setSending(false)
            }
        }

        const sendSelectedTemplate = async (templateName) => {
            if (!selectedChat || !templateName || sending) return
            setShowTemplateDropdown(false)
            setSending(true)
            setSendError('')

            try {
                const activeId = localStorage.getItem('active_wa_account_id') || ''
                const res = await fetch(`${API_BASE_URL}/chat/send`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        conversationId: selectedChat.id,
                        templateName,
                        type: 'template',
                        accountId: activeId || undefined
                    }),
                })

                const data = await res.json()
                if (res.ok) {
                    const newMsg = data.message || {
                        id: Date.now(),
                        text: `[Template: ${templateName}]`,
                        sender: 'bot',
                        direction: 'outgoing',
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                    }
                    setMessages((prev) => {
                        const exists = prev.some(m => (newMsg.wamid && m.wamid === newMsg.wamid) || (newMsg.id && m.id === newMsg.id))
                        if (exists) return prev
                        return [...prev, newMsg]
                    })
                    loadConversations(true)
                    showToast(`✅ Template "${templateName}" sent successfully!`)
                } else {
                    setSendError(data.message || `Failed to send template "${templateName}"`)
                }
            } catch (err) {
                setSendError('Failed to send template: ' + err.message)
            } finally {
                setSending(false)
            }
        }

        const formatTime = (timestamp) => {
            if (!timestamp) return ''
            const date = new Date(timestamp)
            if (isNaN(date.getTime())) return ''
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        }

        const resolveMediaUrl = (url) => {
            if (!url) return ''
            if (url.startsWith('/api/chat/media/')) return secureMediaUrls[url] || ''
            return url.startsWith('http') || url.startsWith('data:')
                ? url
                : `${API_BASE_URL.replace(/\/api\/?$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
        }

        useEffect(() => {
            const protectedUrls = [...new Set(messages.map(message => message.mediaUrl).filter(url => typeof url === 'string' && url.startsWith('/api/chat/media/')))]
            protectedUrls.forEach(async url => {
                if (secureMediaUrls[url]) return
                try {
                    const response = await fetch(`${API_BASE_URL.replace(/\/api\/?$/, '')}${url}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    if (!response.ok) return
                    const objectUrl = URL.createObjectURL(await response.blob())
                    setSecureMediaUrls(current => current[url] ? current : { ...current, [url]: objectUrl })
                } catch (error) {
                    console.warn('Unable to load protected WhatsApp media:', error.message)
                }
            })
        }, [messages, token, secureMediaUrls])

        const formatDate = (timestamp) => {
            if (!timestamp) return ''
            const date = new Date(timestamp)
            if (Number.isNaN(date.getTime())) return ''
            return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${formatTime(timestamp)}`
        }

        const filteredConversations = conversations.filter(conv => {
            // Replied contacts only. Prevent outgoing-only Socket.IO updates from
            // temporarily appearing before the next server-side filtered refresh.
            if (Number(conv.hasReplied ?? conv.has_replied ?? 0) !== 1) return false
            // Exclude connected official WABA number from chat list
            if (conv.phone && officialNumber) {
                const conv10 = String(conv.phone).replace(/\D/g, '').slice(-10)
                const official10 = String(officialNumber).replace(/\D/g, '').slice(-10)
                if (conv10 && official10 && conv10 === official10) return false
            }

            if (tagFilter && tagFilter.trim()) {
                const tagQuery = tagFilter.toLowerCase().trim()
                const matchTag = conv.tags && Array.isArray(conv.tags) && conv.tags.some(t => t.name?.toLowerCase().includes(tagQuery))
                if (!matchTag && !conv.name?.toLowerCase().includes(tagQuery)) return false
            }

            if (!searchQuery.trim()) return true
            const query = searchQuery.toLowerCase().trim()
            return (conv.name && conv.name.toLowerCase().includes(query)) ||
                (conv.phone && conv.phone.includes(query)) ||
                (conv.lastMessage && conv.lastMessage.toLowerCase().includes(query))
        })

        return (
            <div className={`chat-container ${selectedChat ? 'has-selected-chat' : ''}`}>
                {/* Chat List Sidebar */}
                <div className="chat-sidebar">
                    <div className="chat-sidebar-header">
                        <div className="sidebar-brand-top">
                            <span className="chat-bot-label">ChatBot</span>
                            <span className="chat-phone-label">{officialNumber || user?.mobile || ''}</span>
                        </div>
                        <div style={{ margin: '8px 0' }}>
                            <button
                                type="button"
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    background: '#25D366',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '600',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                                onClick={() => setShowNewChatModal(true)}
                            >
                                <span>➕</span> Start New Chat (Any Number)
                            </button>
                        </div>
                        <div className="header-left">
                            <span className="home-icon">🏠</span>
                            <span className="action-btn" style={{ padding: '0 4px', fontSize: '16px' }}>⋮</span>
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="sidebar-search-input"
                            />
                        </div>
                    </div>

                    {showNewChatModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999
                        }}>
                            <div style={{
                                background: '#fff',
                                padding: '24px',
                                borderRadius: '12px',
                                width: '360px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111b21' }}>Start New WhatsApp Chat</h3>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewChatModal(false)}
                                        style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
                                    >✕</button>
                                </div>
                                <form onSubmit={handleStartNewChat}>
                                    <div style={{ marginBottom: '14px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '4px' }}>
                                            Recipient Phone Number *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 919876543210"
                                            value={newChatPhone}
                                            onChange={(e) => setNewChatPhone(e.target.value)}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid #ccc',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                outline: 'none'
                                            }}
                                        />
                                        <small style={{ fontSize: '11px', color: '#888' }}>Include country code without '+' (e.g. 91 for India)</small>
                                    </div>
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#444', marginBottom: '4px' }}>
                                            Contact Name (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. John Client"
                                            value={newChatName}
                                            onChange={(e) => setNewChatName(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid #ccc',
                                                borderRadius: '6px',
                                                fontSize: '14px',
                                                outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewChatModal(false)}
                                            style={{ padding: '8px 16px', background: '#f0f2f5', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={startingChat || !newChatPhone.trim()}
                                            style={{ padding: '8px 18px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                                        >
                                            {startingChat ? 'Starting...' : 'Open Chat'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className="chat-list">
                        {loading ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>Loading conversations...</div>
                        ) : filteredConversations.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No conversations found</div>
                        ) : (
                            filteredConversations.map((conv) => {
                                const selectedPhone10 = selectedChat?.phone ? String(selectedChat.phone).replace(/\D/g, '').slice(-10) : ''
                                const convPhone10 = conv.phone ? String(conv.phone).replace(/\D/g, '').slice(-10) : ''
                                const isSelected = selectedChat && (
                                    (selectedChat.id && conv.id && Number(selectedChat.id) === Number(conv.id)) ||
                                    (selectedPhone10 && convPhone10 && selectedPhone10 === convPhone10)
                                )

                                return (
                                    <div
                                        key={conv.id}
                                        className={`chat-list-item ${isSelected ? 'active' : ''}`}
                                        onClick={() => handleSelectChat(conv)}
                                    >
                                        <div className="chat-avatar" style={{ background: '#25D366' }}>
                                            {conv.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="chat-info">
                                            <div className="chat-name">
                                                {conv.name || 'WhatsApp User'}
                                                <span style={{ fontSize: '11px', color: '#666', fontWeight: 'normal', marginLeft: '6px' }}>{conv.phone}</span>
                                            </div>
                                            <div className="chat-last-message" style={{ fontSize: '12px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {conv.lastMessage || ''}
                                            </div>
                                        </div>
                                        <div className="chat-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <div className="chat-time" style={{ fontSize: '11px', color: '#888' }}>{formatDate(conv.lastMessageTime)}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {!isSelected && Number(conv.unreadCount) > 0 && (
                                                    <span style={{
                                                        background: '#25D366',
                                                        color: '#fff',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold',
                                                        borderRadius: '50%',
                                                        padding: '2px 6px',
                                                        minWidth: '18px',
                                                        textAlign: 'center'
                                                    }}>
                                                        {conv.unreadCount}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    className="chat-item-delete-btn"
                                                    title="Delete Chat"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteChat(conv);
                                                    }}
                                                >
                                                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                        {hasMoreConversations && !loading && (
                            <div style={{ padding: '10px', textAlign: 'center' }}>
                                <button type="button" disabled={loadingMoreConversations}
                                    onClick={loadAllOlderConversations}
                                    style={{ padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #ccc', background: '#fff' }}>
                                    {loadingMoreConversations ? 'Loading...' : 'Load older conversations'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Filter Section */}
                    <div className="chat-filters">
                        <div className="filter-row">
                            <label className="filter-label">Conversation of last:</label>
                            <select
                                className="filter-select"
                                value={daysFilter}
                                onChange={(e) => {
                                    const newDays = e.target.value
                                    daysFilterRef.current = newDays
                                    setDaysFilter(newDays)
                                    conversationQueryKeyRef.current = ''
                                    conversationRequestVersionRef.current++
                                    setConversations([])
                                    setHasMoreConversations(false)
                                    loadConversations(false, newDays, 1)
                                }}
                            >
                                <option value="150">Last 150 days</option>
                                <option value="30">Last 30 days</option>
                                <option value="7">Last 7 days</option>
                                <option value="all">All time</option>
                            </select>
                        </div>
                        <div className="filter-row" style={{ background: '#e0e0e0', margin: '-10px -16px', padding: '10px 16px', marginTop: '10px' }}>
                            <input
                                type="text"
                                placeholder="Filter By Tag"
                                value={tagFilter}
                                onChange={(e) => setTagFilter(e.target.value)}
                                style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="chat-area">
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="chat-header">
                                <div className="chat-header-info">
                                    <button
                                        type="button"
                                        className="chat-mobile-back-btn"
                                        onClick={() => setSelectedChat(null)}
                                        title="Back to conversation list"
                                        aria-label="Back to conversations"
                                    >
                                        ←
                                    </button>
                                    <div className="chat-avatar-large" style={{ background: '#075e54' }}>
                                        {selectedChat.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="chat-header-details">
                                        <div className="chat-header-name">
                                            {selectedChat.name || (selectedChat.phone ? `+${selectedChat.phone}` : 'WhatsApp User')}
                                            {selectedChat.name && selectedChat.phone && !selectedChat.name.includes(selectedChat.phone.slice(-10)) && (
                                                <span className="chat-header-phone">+{selectedChat.phone}</span>
                                            )}
                                        </div>
                                        <div className="chat-header-tags">
                                            {loadingContactTags ? (
                                                <span className="chat-header-tag-loading">Loading tags…</span>
                                            ) : contactTags.length === 0 ? (
                                                <span className="chat-header-tags-empty">No tags assigned</span>
                                            ) : (
                                                contactTags.map((tag) => (
                                                    <span
                                                        key={tag.id}
                                                        className="chat-tag-chip chat-tag-chip-inline"
                                                        style={{ background: tag.color || '#4d8ef0' }}
                                                    >
                                                        <span>{tag.name}</span>
                                                        <button
                                                            type="button"
                                                            className="chat-tag-chip-remove"
                                                            onClick={() => handleRemoveAssignedTag(tag.id)}
                                                            aria-label={`Remove ${tag.name}`}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="header-right-actions">
                                    <button className="header-action-btn refresh" onClick={() => loadMessages(selectedChat.id)} title="Refresh History">↻</button>
                                    <button
                                        className="header-action-btn delete"
                                        onClick={() => handleDeleteChat(selectedChat)}
                                        title="Delete Chat Conversation"
                                    >
                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                        </svg>
                                    </button>
                                    <div className="header-dropdown-container" ref={headerDropdownRef}>
                                        <button className="header-action-btn" onClick={() => setShowHeaderDropdown(!showHeaderDropdown)}>⋮</button>
                                        {showHeaderDropdown && (
                                            <div className="header-dropdown-menu">
                                                <div className="header-dropdown-item" onClick={() => { setShowHeaderDropdown(false); setShowInChatSearch(true); }}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                    Search Chat
                                                </div>
                                                <div className="header-dropdown-item" onClick={async () => { setShowHeaderDropdown(false); await handleOpenAddTagsModal(); }}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                                    Add Tags
                                                </div>
                                                <div className="header-dropdown-item" onClick={() => { setShowHeaderDropdown(false); setShowUserInfoModal(true); }}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                    User Info
                                                </div>
                                                <div className="header-dropdown-item" onClick={() => { setShowHeaderDropdown(false); setShowDetailsModal(true); }}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                                    Details
                                                </div>
                                                <div className="header-dropdown-item" onClick={handleExportChat}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                    Export Chat
                                                </div>
                                                <div className="header-dropdown-item" onClick={handleToggleSound}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                        {soundEnabled ? (
                                                            <>
                                                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <line x1="1" y1="1" x2="23" y2="23"></line>
                                                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                                                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                                                            </>
                                                        )}
                                                    </svg>
                                                    Notification Sound ({soundEnabled ? 'ON' : 'OFF'})
                                                </div>
                                                <div className="header-dropdown-item" onClick={handleAddToOptOut}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                                    add to Opt-Out
                                                </div>
                                                <div className="header-dropdown-item" onClick={handleViewAllChat}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                                    View All Chat
                                                </div>
                                                <div className="header-dropdown-item delete-chat-item" onClick={() => handleDeleteChat(selectedChat)} style={{ color: '#ef4444', fontWeight: 600 }}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                    Delete Chat
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* In-Chat Search Bar */}
                            {showInChatSearch && (
                                <div className="in-chat-search-bar">
                                    <span style={{ fontSize: '15px', color: '#64748b' }}>🔍</span>
                                    <input
                                        type="text"
                                        className="in-chat-search-input"
                                        placeholder="Search messages in this conversation..."
                                        value={inChatSearchText}
                                        onChange={(e) => setInChatSearchText(e.target.value)}
                                        autoFocus
                                    />
                                    {inChatSearchText && (
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                            {messages.filter(m => String(m.text || '').toLowerCase().includes(inChatSearchText.toLowerCase())).length} found
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="in-chat-search-close"
                                        onClick={() => { setInChatSearchText(''); setShowInChatSearch(false); }}
                                        title="Close Search"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* Toast Feedback */}
                            {toastMessage && (
                                <div className="chat-toast-banner">
                                    <span>{toastMessage}</span>
                                </div>
                            )}

                            {/* Messages Container */}
                            <div className="chat-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
                                {(() => {
                                    if (loadingMessages) {
                                        return (
                                            <div style={{ textAlign: 'center', marginTop: '60px', color: '#54656f' }}>
                                                <div className="chat-loading-spinner" style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    margin: '0 auto 12px',
                                                    border: '3px solid #e0e0e0',
                                                    borderTopColor: '#25D366',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                }} />
                                                <p style={{ fontSize: '14px', margin: 0, fontWeight: 500 }}>Loading messages...</p>
                                            </div>
                                        );
                                    }

                                    if (messagesError) {
                                        return (
                                            <div style={{ textAlign: 'center', marginTop: '40px', padding: '0 20px', color: '#ea3943' }}>
                                                <p style={{ fontWeight: 600, marginBottom: '8px' }}>⚠️ {messagesError}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const chatId = selectedChat?.id || selectedChat?.phone;
                                                        if (chatId) loadMessages(chatId, false);
                                                    }}
                                                    style={{
                                                        padding: '6px 14px',
                                                        background: '#25D366',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        fontSize: '13px'
                                                    }}
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        );
                                    }

                                    const displayedMessages = inChatSearchText.trim()
                                        ? messages.filter(m => String(m.text || '').toLowerCase().includes(inChatSearchText.toLowerCase()))
                                        : messages;

                                    if (displayedMessages.length === 0) {
                                        return (
                                            <div style={{ textAlign: 'center', marginTop: '40px', color: '#54656f' }}>
                                                <p>{inChatSearchText ? 'No messages matched your search.' : 'No messages yet. Send a message to start conversing!'}</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            {hasMoreOlderMessages && !inChatSearchText && (
                                                <div style={{ textAlign: 'center', padding: '8px 0', marginBottom: '8px' }}>
                                                    {loadingOlderMessages ? (
                                                        <span style={{ fontSize: '12px', color: '#64748b' }}>⏳ Loading older messages...</span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={loadOlderMessages}
                                                            style={{
                                                                padding: '4px 12px',
                                                                fontSize: '12px',
                                                                background: '#f0f2f5',
                                                                border: '1px solid #d1d5db',
                                                                borderRadius: '14px',
                                                                color: '#4b5563',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            ↑ Load older messages
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {displayedMessages.map((msg) => {
                                                const isSent = msg.sender === 'bot' || msg.direction === 'outgoing'
                                                const isRead = msg.status === 'read'
                                                const isDelivered = msg.status === 'delivered' || isRead
                                                const isFailed = msg.status === 'failed'

                                                return (
                                                    <div
                                                        key={msg.id || msg.wamid || Math.random()}
                                                        className={`message-wrapper ${isSent ? 'sent' : 'received'}`}
                                                    >
                                                        <div className="message-content">
                                                            {(msg.mediaUrl || ['image', 'video', 'audio', 'document', 'application'].includes(String(msg.mediaType || msg.messageType || '').toLowerCase())) && (
                                                                <AttachmentRenderer message={msg} resolveMediaUrl={resolveMediaUrl} />
                                                            )}
                                                            {false && !msg.mediaUrl && ['image', 'video', 'document', 'application'].includes(String(msg.mediaType || msg.messageType || '').toLowerCase()) && (
                                                                <div style={{ padding: '12px', marginBottom: '6px', borderRadius: '8px', background: 'rgba(0,0,0,.05)', color: '#667781', fontSize: '13px' }}>
                                                                    {String(msg.mediaType || msg.messageType).toLowerCase() === 'image' ? '📷' : String(msg.mediaType || msg.messageType).toLowerCase() === 'video' ? '🎥' : '📄'} Media unavailable
                                                                    {msg.fileName ? ` — ${msg.fileName}` : ''}
                                                                </div>
                                                            )}
                                                            {false && msg.mediaUrl && (
                                                                <div style={{ marginBottom: '6px' }}>
                                                                    {msg.messageType === 'image' || msg.type === 'image' || /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(msg.mediaUrl) ? (
                                                                        <img
                                                                            src={resolveMediaUrl(msg.mediaUrl)}
                                                                            alt="Attachment"
                                                                            style={{ maxWidth: '240px', maxHeight: '200px', borderRadius: '8px', display: 'block', objectFit: 'contain' }}
                                                                        />
                                                                    ) : msg.messageType === 'video' || /\.(mp4|webm|mov|3gp)(\?.*)?$/i.test(msg.mediaUrl) ? (
                                                                        <video controls preload="metadata" style={{ maxWidth: '280px', maxHeight: '240px', borderRadius: '8px', display: 'block' }}>
                                                                            <source src={resolveMediaUrl(msg.mediaUrl)} />
                                                                        </video>
                                                                    ) : (
                                                                        <a
                                                                            href={resolveMediaUrl(msg.mediaUrl)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', textDecoration: 'underline', fontSize: '13px' }}
                                                                        >
                                                                            📎 View Attached File
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {Array.isArray(msg.rawPayload?.templateSnapshot?.cards) && msg.rawPayload.templateSnapshot.cards.length > 0 && (
                                                                <div style={{ display: 'flex', gap: '8px', maxWidth: '320px', overflowX: 'auto', marginBottom: '8px' }}>
                                                                    {msg.rawPayload.templateSnapshot.cards.map((card, index) => (
                                                                        <div key={card.index ?? index} style={{ minWidth: '210px', padding: '8px', border: '1px solid rgba(0,0,0,.1)', borderRadius: '8px' }}>
                                                                            {card.mediaUrl && card.mediaType === 'image' && <img src={resolveMediaUrl(card.mediaUrl)} alt={`Card ${index + 1}`} style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px' }} />}
                                                                            {card.mediaUrl && card.mediaType === 'video' && <video src={resolveMediaUrl(card.mediaUrl)} controls preload="metadata" style={{ width: '100%', maxHeight: '150px', borderRadius: '6px' }} />}
                                                                            {card.body && <div style={{ whiteSpace: 'pre-wrap', marginTop: '6px' }}>{card.body}</div>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                                            {Array.isArray(msg.rawPayload?.templateSnapshot?.buttons) && msg.rawPayload.templateSnapshot.buttons.length > 0 && (
                                                                <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', marginTop: '8px', paddingTop: '6px' }}>
                                                                    {msg.rawPayload.templateSnapshot.buttons.map((button, index) => (
                                                                        <div key={`${button.text || 'button'}-${index}`} style={{ textAlign: 'center', color: '#027eb5', fontSize: '13px', padding: '4px 8px' }}>
                                                                            {button.text || button.title || 'Action'}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {(msg.campaignName || msg.templateName) && (
                                                                <div style={{ marginTop: '6px', fontSize: '10px', color: '#667781', opacity: .85 }}>
                                                                    {[msg.campaignName && `Campaign: ${msg.campaignName}`, msg.templateName && `Template: ${msg.templateName}`].filter(Boolean).join(' · ')}
                                                                </div>
                                                            )}
                                                            <div className="message-meta">
                                                                <span className="message-time">{formatTime(msg.timestamp)}</span>
                                                                {isSent && (
                                                                    <span
                                                                        className="message-status"
                                                                        title={msg.status || 'sent'}
                                                                        style={{
                                                                            marginLeft: '4px',
                                                                            color: isRead ? '#53bdeb' : '#8696a0',
                                                                            fontSize: '12px'
                                                                        }}
                                                                    >
                                                                        {isFailed ? '⚠️' : isDelivered ? '✓✓' : '✓'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </>
                                    )
                                })()}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Send Error Banner */}
                            {sendError && (
                                <div style={{
                                    background: '#fff3cd',
                                    border: '1px solid #ffc107',
                                    borderLeft: '4px solid #ff9800',
                                    padding: '8px 14px',
                                    fontSize: '13px',
                                    color: '#6c4c00',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '8px'
                                }}>
                                    <span>{sendError}</span>
                                    <button type="button" onClick={() => setSendError('')}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#6c4c00', flexShrink: 0 }}>✕</button>
                                </div>
                            )}

                            {/* Attached File Preview */}
                            {attachedFile && (
                                <div style={{
                                    padding: '8px 16px',
                                    background: '#f0fdf4',
                                    borderTop: '1px solid #bbf7d0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {attachedFile.previewUrl ? (
                                            <img src={attachedFile.previewUrl} alt="preview" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #86efac' }} />
                                        ) : (
                                            <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                                                📄
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {attachedFile.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#15803d' }}>
                                                {attachedFile.type || 'Attachment'} ready to send
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAttachedFile(null)}
                                        style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: '4px' }}
                                        title="Remove attachment"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,video/*"
                                style={{ display: 'none' }}
                            />

                            {/* 24-Hour Service Window Warning Banner */}
                            {selectedChat && !isWindowOpen && (
                                <div style={{
                                    margin: '0 16px 8px 16px',
                                    padding: '10px 14px',
                                    background: '#fef3c7',
                                    border: '1px solid #fde68a',
                                    borderLeft: '4px solid #f59e0b',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    fontSize: '13px',
                                    color: '#92400e'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>⏳</span>
                                        <span>
                                            <strong>24-Hour WhatsApp Window Closed:</strong> Customer has not replied within 24 hours. WhatsApp requires sending an approved <strong>Template</strong> to initiate conversation.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowTemplateDropdown(prev => !prev)}
                                        style={{
                                            background: '#075e54',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '5px 12px',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span>📋</span> Choose Template
                                    </button>
                                </div>
                            )}

                            {/* Message Input */}
                            <form className="chat-input-area" onSubmit={sendMessage}>
                                <div className="input-wrapper">
                                    <textarea
                                        ref={messageInputRef}
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                sendMessage(e)
                                            }
                                        }}
                                        placeholder={attachedFile ? 'Add an optional caption...' : 'Type a message'}
                                        disabled={sending}
                                        rows={1}
                                        style={{
                                            width: '100%',
                                            border: 'none',
                                            outline: 'none',
                                            fontFamily: 'inherit',
                                            fontSize: '14px',
                                            resize: 'none',
                                            background: 'transparent',
                                            padding: '4px 0'
                                        }}
                                    />
                                    <div className="input-hint">(press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for a next line)</div>
                                </div>
                                <div className="input-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {/* Emoji Picker Button */}
                                    <button
                                        type="button"
                                        className="action-btn"
                                        title="Emoji"
                                        onClick={() => {
                                            setShowEmojiPicker(!showEmojiPicker)
                                            setShowTemplateDropdown(false)
                                        }}
                                        style={{ fontSize: '18px', cursor: 'pointer', background: showEmojiPicker ? '#e2e8f0' : 'transparent', borderRadius: '8px', border: 'none', padding: '6px 8px' }}
                                    >
                                        😊
                                    </button>

                                    {/* Send Button */}
                                    <button
                                        type="submit"
                                        className="action-btn"
                                        disabled={(!newMessage.trim() && !attachedFile) || sending}
                                        title="Send"
                                        style={{
                                            background: (!newMessage.trim() && !attachedFile) || sending ? '#a7f3d0' : '#25D366',
                                            color: '#fff',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: (!newMessage.trim() && !attachedFile) || sending ? 'not-allowed' : 'pointer',
                                            padding: '8px 14px',
                                            fontSize: '14px',
                                            fontWeight: '700'
                                        }}
                                    >
                                        {sending ? '⏳' : '➤'}
                                    </button>

                                    {/* Attachment / Pin Button */}
                                    <button
                                        type="button"
                                        className="action-btn"
                                        title="Attach Media / Document"
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{ background: '#f0f2f5', border: '1px solid #d1d7db', borderRadius: '8px', cursor: 'pointer', padding: '6px 10px', fontSize: '16px' }}
                                    >
                                        📎
                                    </button>

                                    {/* Template Button */}
                                    <button
                                        type="button"
                                        className="action-btn"
                                        title="Send Template Message"
                                        style={{ background: '#075e54', color: '#fff', border: '1px solid #075e54', borderRadius: '8px', cursor: 'pointer', padding: '7px 12px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        onClick={() => {
                                            setShowTemplateDropdown(!showTemplateDropdown)
                                            setShowEmojiPicker(false)
                                        }}
                                    >
                                        <span>📄</span>
                                        <span>Template</span>
                                    </button>

                                    {/* Emoji Picker Popover */}
                                    {showEmojiPicker && (
                                        <div
                                            ref={emojiPickerRef}
                                            className="emoji-picker"
                                            style={{
                                                position: 'absolute',
                                                bottom: '50px',
                                                right: '120px',
                                                background: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                                width: '290px',
                                                maxHeight: '220px',
                                                overflowY: 'auto',
                                                zIndex: 200,
                                                padding: '10px'
                                            }}
                                        >
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                                                SELECT EMOJI
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                                                {EMOJI_LIST.map((emoji, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => handleEmojiClick(emoji)}
                                                        style={{
                                                            fontSize: '20px',
                                                            padding: '4px',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.15s, transform 0.1s'
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.background = '#f1f5f9'}
                                                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Template Dropdown Popover */}
                                    {showTemplateDropdown && (
                                        <div
                                            ref={templateDropdownRef}
                                            className="template-dropdown"
                                            style={{
                                                position: 'absolute',
                                                bottom: '50px',
                                                right: '0',
                                                background: '#ffffff',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '10px',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                                width: '280px',
                                                maxHeight: '240px',
                                                overflowY: 'auto',
                                                zIndex: 200,
                                                padding: '6px 0'
                                            }}
                                        >
                                            <div style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 'bold', color: '#047857', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                                                OFFICIAL META TEMPLATES
                                            </div>
                                            {!Array.isArray(availableTemplates) || availableTemplates.length === 0 ? (
                                                <div style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>No approved templates found</div>
                                            ) : (
                                                availableTemplates.map((t, idx) => {
                                                    const name = typeof t === 'string' ? t : (t.name || t.template_name || t.template || '')
                                                    if (!name) return null
                                                    return (
                                                        <div
                                                            key={idx}
                                                            style={{
                                                                padding: '9px 14px',
                                                                fontSize: '13px',
                                                                cursor: 'pointer',
                                                                borderBottom: '1px solid #f8fafc',
                                                                transition: 'background 0.15s',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.background = '#ecfdf5'}
                                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                            onClick={() => sendSelectedTemplate(name)}
                                                        >
                                                            <span>📋</span>
                                                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{name}</span>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            </form>
                        </>
                    ) : (
                        <div className="no-chat-selected">
                            <div className="no-chat-icon">💬</div>
                            <p>Click User to Chat</p>
                        </div>
                    )}
                </div>
                {/* Add Tags Modal */}
                {showAddTagsModal && (
                    <div className="modal-overlay" onClick={() => setShowAddTagsModal(false)}>
                        <div className="modal-content tag-modal-content" ref={tagModalRef} onClick={(e) => e.stopPropagation()}>
                            <div className="tag-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2>Assign Tags</h2>
                                    <p>Select existing tags for this chat</p>
                                </div>
                                <button
                                    type="button"
                                    className="chat-info-modal-close"
                                    onClick={() => setShowAddTagsModal(false)}
                                    aria-label="Close"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="tag-modal-body">
                                <div className="tag-modal-search">
                                    <label className="tag-modal-label">Search tags</label>
                                    <div className="tag-search-input-wrapper">
                                        <span className="tag-search-icon">🔍</span>
                                        <input
                                            ref={tagInputRef}
                                            type="text"
                                            placeholder="Type to filter tags"
                                            value={tagSearchQuery}
                                            onChange={(e) => setTagSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="tag-modal-section">
                                    <div className="tag-modal-section-title">Selected tags</div>
                                    <div className="tag-chip-list">
                                        {(!selectedTagIds || selectedTagIds.length === 0) ? (
                                            <div className="tag-modal-empty">No tags selected yet</div>
                                        ) : (
                                            selectedTagIds.map((tagId) => {
                                                const numericId = Number(tagId)
                                                const tag = (availableTags || []).find((item) => Number(item?.id) === numericId) || (contactTags || []).find((item) => Number(item?.id) === numericId)
                                                if (!tag) return null
                                                return (
                                                    <span key={tag.id || numericId} className="chat-tag-chip" style={{ background: tag.color || '#4d8ef0' }}>
                                                        <span>{tag.name || 'Tag'}</span>
                                                        <button
                                                            type="button"
                                                            className="chat-tag-chip-remove"
                                                            onClick={() => handleToggleSelectedTag(tag.id || numericId)}
                                                            aria-label={`Remove ${tag.name || 'Tag'}`}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>

                                <div className="tag-modal-section">
                                    <div className="tag-modal-section-title">Available tags</div>
                                    {loadingTags ? (
                                        <div className="tag-modal-empty">Loading tags…</div>
                                    ) : (
                                        <div className="tag-option-list">
                                            {(availableTags || [])
                                                .filter((tag) => tag && String(tag.name || '').toLowerCase().includes((tagSearchQuery || '').toLowerCase()))
                                                .filter((tag) => tag?.id && !(selectedTagIds || []).includes(Number(tag.id)))
                                                .map((tag) => (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        className="tag-option"
                                                        onClick={() => handleToggleSelectedTag(tag.id)}
                                                    >
                                                        <span className="tag-option-name">{tag.name}</span>
                                                        <span className="tag-option-badge">Add</span>
                                                    </button>
                                                ))}
                                            {(availableTags || []).filter((tag) => tag && String(tag.name || '').toLowerCase().includes((tagSearchQuery || '').toLowerCase())).length === 0 && (
                                                <div className="tag-modal-empty">No matching tags found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="tag-modal-footer">
                                <button type="button" className="tag-modal-button secondary" onClick={() => setShowAddTagsModal(false)}>
                                    Cancel
                                </button>
                                <button type="button" className="tag-modal-button primary" onClick={handleSaveTags} disabled={Boolean(savingTags)}>
                                    {savingTags ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* User Info Modal */}
                {showUserInfoModal && selectedChat && (
                    <div className="modal-overlay" onClick={() => setShowUserInfoModal(false)}>
                        <div className="chat-info-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="chat-info-modal-header">
                                <h3>👤 User Profile & Info</h3>
                                <button type="button" className="chat-info-modal-close" onClick={() => setShowUserInfoModal(false)}>✕</button>
                            </div>
                            <div className="chat-info-modal-body">
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Contact Name</span>
                                    <span className="chat-info-value">{selectedChat.name || 'WhatsApp User'}</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Phone Number</span>
                                    <span className="chat-info-value" style={{ color: '#0284c7' }}>+{selectedChat.phone}</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Assigned Tags</span>
                                    <span className="chat-info-value">
                                        {contactTags.length === 0 ? 'None' : contactTags.map(t => t.name).join(', ')}
                                    </span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Conversation ID</span>
                                    <span className="chat-info-value">#{selectedChat.id}</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Messages in Chat</span>
                                    <span className="chat-info-value">{messages.length} messages</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Last Activity</span>
                                    <span className="chat-info-value">
                                        {selectedChat.lastMessageTime ? new Date(selectedChat.lastMessageTime).toLocaleString() : 'Recent'}
                                    </span>
                                </div>
                            </div>
                            <div className="tag-modal-footer">
                                <button type="button" className="tag-modal-button primary" onClick={() => setShowUserInfoModal(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Details Modal */}
                {showDetailsModal && selectedChat && (
                    <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                        <div className="chat-info-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="chat-info-modal-header">
                                <h3>ℹ️ Conversation Details</h3>
                                <button type="button" className="chat-info-modal-close" onClick={() => setShowDetailsModal(false)}>✕</button>
                            </div>
                            <div className="chat-info-modal-body">
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Channel</span>
                                    <span className="chat-info-value">Official WhatsApp Cloud API</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Conversation ID</span>
                                    <span className="chat-info-value">#{selectedChat.id}</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Connected Phone Number</span>
                                    <span className="chat-info-value" style={{ color: '#16a34a' }}>+{officialNumber || selectedChat.phone}</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Recipient Phone</span>
                                    <span className="chat-info-value" style={{ color: '#0284c7' }}>+{selectedChat.phone}</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Socket Room</span>
                                    <span className="chat-info-value" style={{ color: '#10b981' }}>🟢 Connected</span>
                                </div>
                                <div className="chat-info-row">
                                    <span className="chat-info-label">Notification Sound</span>
                                    <span className="chat-info-value">{soundEnabled ? '🔔 Enabled' : '🔕 Muted'}</span>
                                </div>
                            </div>
                            <div className="tag-modal-footer">
                                <button type="button" className="tag-modal-button primary" onClick={() => setShowDetailsModal(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Chat Confirmation Modal */}
                {showDeleteConfirmModal && chatToDelete && (
                    <div className="modal-overlay" onClick={() => { if (!deletingChat) { setShowDeleteConfirmModal(false); setChatToDelete(null); } }} style={{ zIndex: 10000 }}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', borderRadius: '14px', padding: '24px', background: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
                            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '24px' }}>
                                    🗑️
                                </div>
                                <h3 style={{ margin: '0 0 8px', fontSize: '19px', color: '#111827', fontWeight: '700' }}>Delete Chat Conversation?</h3>
                                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>
                                    Are you sure you want to delete the chat history with <strong style={{ color: '#111827' }}>{chatToDelete.name || (chatToDelete.phone ? `+${chatToDelete.phone}` : 'this user')}</strong>? All messages in this conversation will be permanently deleted.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '22px' }}>
                                <button
                                    type="button"
                                    style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: '600', cursor: 'pointer' }}
                                    onClick={() => { setShowDeleteConfirmModal(false); setChatToDelete(null); }}
                                    disabled={deletingChat}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    style={{ padding: '9px 20px', borderRadius: '8px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={confirmDeleteChat}
                                    disabled={deletingChat}
                                >
                                    {deletingChat ? 'Deleting...' : 'Yes, Delete Chat'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }
