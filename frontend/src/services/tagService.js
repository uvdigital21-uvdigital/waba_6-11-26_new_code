import { API_BASE_URL } from '../config.js'
const API_BASE = API_BASE_URL

const getAuthHeaders = () => {
    const token = localStorage.getItem('wa_dashboard_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
}

export const notifyTagsChanged = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tags:updated'))
    }
}

const requestJson = async (path, options = {}) => {
    const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {}),
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok || data.success === false) {
        throw new Error(data.message || 'Request failed')
    }

    return data
}

export const getTags = async (params = {}) => {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set('page', String(params.page))
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.date_from) searchParams.set('date_from', params.date_from)
    if (params.date_to) searchParams.set('date_to', params.date_to)

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return requestJson(`/tags${suffix}`)
}

export const createTag = async (payload) => {
    const data = await requestJson('/tags', {
        method: 'POST',
        body: JSON.stringify(payload),
    })
    notifyTagsChanged()
    return data
}

export const updateTag = async (id, payload) => {
    const data = await requestJson(`/tags/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    })
    notifyTagsChanged()
    return data
}

export const deleteTag = async (id) => {
    const data = await requestJson(`/tags/${id}`, {
        method: 'DELETE',
    })
    notifyTagsChanged()
    return data
}

export const getChatTags = async (chatId) => {
    return requestJson(`/tags/chats/${encodeURIComponent(chatId)}/tags`)
}

export const getTagContacts = async (tagId) => {
    return requestJson(`/tags/${encodeURIComponent(tagId)}/contacts`)
}

export const assignTagToPhone = async (tagId, phone) => {
    const data = await requestJson('/tags/assign', {
        method: 'POST',
        body: JSON.stringify({ tagId, phone }),
    })
    notifyTagsChanged()
    return data
}

export const unassignTagFromPhone = async (tagId, phone) => {
    const data = await requestJson('/tags/unassign', {
        method: 'DELETE',
        body: JSON.stringify({ tagId, phone }),
    })
    notifyTagsChanged()
    return data
}

export const assignTagsToChat = async (chatId, tagIds) => {
    const data = await requestJson(`/tags/chats/${encodeURIComponent(chatId)}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tagIds }),
    })
    notifyTagsChanged()
    return data
}

export const removeTagFromChat = async (chatId, tagId) => {
    const data = await requestJson(`/tags/chats/${encodeURIComponent(chatId)}/tags/${encodeURIComponent(tagId)}`, {
        method: 'DELETE',
    })
    notifyTagsChanged()
    return data
}
