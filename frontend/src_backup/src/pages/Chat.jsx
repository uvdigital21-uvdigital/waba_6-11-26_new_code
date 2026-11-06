import React, { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { API_BASE_URL } from '../config.js'

export default function Chat() {
    const { user, token } = useAuth()
    const [conversations, setConversations] = useState([])
    const [selectedChat, setSelectedChat] = useState(null)
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const messagesEndRef = useRef(null)

    // Load conversations list
    useEffect(() => {
        loadConversations()
    }, [])

    // Load messages when a chat is selected
    useEffect(() => {
        if (selectedChat) {
            loadMessages(selectedChat.id)
        }
    }, [selectedChat])

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const loadConversations = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE_URL}/chat/conversations`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (res.ok) {
                setConversations(data.conversations || [])
            }
        } catch (err) {
            console.error('Failed to load conversations:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadMessages = async (conversationId) => {
        try {
            const res = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
                headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (res.ok) {
                setMessages(data.messages || [])
            }
        } catch (err) {
            console.error('Failed to load messages:', err)
        }
    }

    const sendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || !selectedChat || sending) return

        setSending(true)
        const messageText = newMessage.trim()
        setNewMessage('')

        try {
            const res = await fetch(`${API_BASE_URL}/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    conversationId: selectedChat.id,
                    message: messageText,
                }),
            })

            const data = await res.json()
            if (res.ok) {
                // Add the sent message to the messages list
                setMessages((prev) => [
                    ...prev,
                    {
                        id: data.message.id || Date.now(),
                        text: messageText,
                        sender: 'user',
                        timestamp: new Date().toISOString(),
                        status: 'sent',
                    },
                ])
            } else {
                // Revert the input if sending failed
                setNewMessage(messageText)
                alert(data.message || 'Failed to send message')
            }
        } catch (err) {
            setNewMessage(messageText)
            alert('Failed to send message. Please try again.')
        } finally {
            setSending(false)
        }
    }

    const formatTime = (timestamp) => {
        const date = new Date(timestamp)
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const formatDate = (timestamp) => {
        const date = new Date(timestamp)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        if (date.toDateString() === today.toDateString()) {
            return 'Today'
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday'
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
    }

    return (
        <Layout title="Chat">
            <div className="chat-container">
                {/* Chat List Sidebar */}
                <div className="chat-sidebar">
                    <div className="chat-sidebar-header">
                        <div className="header-left">
                            <span className="home-icon">🏠</span>
                            <input
                                type="text"
                                placeholder="Search"
                                className="sidebar-search-input"
                            />
                            <span className="search-icon">🔍</span>
                        </div>
                    </div>

                    {/* Filter Section */}
                    <div className="chat-filters">
                        <div className="filter-row">
                            <label className="filter-label">Conversation of last:</label>
                            <select className="filter-select">
                                <option>Last 7 days</option>
                                <option>Last 30 days</option>
                                <option>Last 90 days</option>
                                <option>All time</option>
                            </select>
                        </div>
                        <div className="filter-row">
                            <label className="filter-label">Filter By Tag</label>
                            <select className="filter-select">
                                <option value="">All Tags</option>
                            </select>
                        </div>
                    </div>

                    <div className="chat-list">
                        {loading ? (
                            <div className="loading-text">Loading conversations...</div>
                        ) : conversations.length === 0 ? (
                            <div className="empty-text">No conversations yet</div>
                        ) : (
                            conversations.map((conv) => (
                                <div
                                    key={conv.id}
                                    className={`chat-list-item ${selectedChat?.id === conv.id ? 'active' : ''}`}
                                    onClick={() => setSelectedChat(conv)}
                                >
                                    <div className="chat-avatar">
                                        {conv.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="chat-info">
                                        <div className="chat-name">{conv.name || 'Unknown'}</div>
                                        <div className="chat-preview">{conv.lastMessage || 'No messages'}</div>
                                    </div>
                                    <div className="chat-meta">
                                        <div className="chat-time">{formatDate(conv.lastMessageTime)}</div>
                                        {conv.unreadCount > 0 && (
                                            <span className="unread-badge">{conv.unreadCount}</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className="chat-area">
                    {selectedChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="chat-header">
                                <div className="chat-header-info">
                                    <div className="chat-avatar-large">
                                        {selectedChat.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <div className="chat-header-name">{selectedChat.name || 'Unknown'}</div>
                                        <div className="chat-header-phone">{selectedChat.phone || ''}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="chat-messages">
                                {messages.length === 0 ? (
                                    <div className="no-messages">
                                        <p>No messages yet. Start a conversation!</p>
                                    </div>
                                ) : (
                                    messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`message ${msg.sender === 'user' ? 'sent' : 'received'}`}
                                        >
                                            <div className="message-content">
                                                <div className="message-text">{msg.text}</div>
                                                <div className="message-time">
                                                    {formatTime(msg.timestamp)}
                                                    {msg.sender === 'user' && (
                                                        <span className="message-status">
                                                            {msg.status === 'sent' && '✓'}
                                                            {msg.status === 'delivered' && '✓✓'}
                                                            {msg.status === 'read' && '✓✓'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <form className="chat-input-area" onSubmit={sendMessage}>
                                <div className="input-wrapper">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type a message"
                                        disabled={sending}
                                    />
                                    <div className="input-hint">(press Enter to send, Shift + Enter for a next line)</div>
                                </div>
                                <div className="input-actions">
                                    <button type="button" className="emoji-btn" title="Emoji">
                                        <span className="emoji-icon">😊</span>
                                    </button>
                                    <button type="submit" className="send-btn" disabled={!newMessage.trim() || sending} title="Send">
                                        <span className="send-icon">➤</span>
                                    </button>
                                    <button type="button" className="attach-btn" title="Attach">
                                        <span className="attach-icon">📎</span>
                                    </button>
                                    <button type="button" className="menu-btn" title="Menu">
                                        <span className="menu-icon">☰</span>
                                    </button>
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
            </div>
        </Layout>
    )
}