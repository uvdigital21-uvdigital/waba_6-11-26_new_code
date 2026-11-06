import React, { useState, useRef, useEffect } from 'react'
import { getImageUrl } from '../config.js'

export function getTemplateCards(templateData) {
    if (!templateData) return null
    const carouselComp = templateData?.components?.find(c => (c.type || '').toUpperCase() === 'CAROUSEL')
    if (carouselComp && Array.isArray(carouselComp.cards) && carouselComp.cards.length > 0) {
        return carouselComp.cards
    }
    if (Array.isArray(templateData?.cards) && templateData.cards.length > 0) {
        return templateData.cards
    }
    return null
}

export function getCardMediaUrl(card) {
    if (!card) return null
    const cardHeader = card.components?.find(c => (c.type || '').toUpperCase() === 'HEADER')
    const candidateUrls = [
        card.headerMedia,
        card.mediaPreviewUrl,
        card.media_url,
        card.mediaUrl,
        card.header_media_url,
        card.headerMediaUrl,
        card.sampleMedia,
        card.sample_media,
        card.mediaBase64,
        cardHeader?.media_url,
        cardHeader?.header_url,
        cardHeader?.example?.header_url?.[0],
        cardHeader?.example?.header_handle?.[0],
        cardHeader?.meta_header_handle
    ]

    const raw = candidateUrls.find(u => {
        if (!u || typeof u !== 'string') return false
        const s = u.trim()
        return s.length > 0 && !s.startsWith('4::') && (
            s.startsWith('http://') || 
            s.startsWith('https://') || 
            s.startsWith('/uploads/') || 
            s.startsWith('uploads/') || 
            s.startsWith('/api/uploads/') || 
            s.startsWith('api/uploads/') || 
            s.startsWith('blob:') || 
            s.startsWith('data:') ||
            s.includes('/templates/') ||
            s.startsWith('card_') ||
            s.startsWith('template_') ||
            s.match(/\.(png|jpg|jpeg|gif|webp|mp4|pdf)$/i)
        )
    })

    if (!raw) return null
    let normalized = raw.trim()
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://') && !normalized.startsWith('blob:') && !normalized.startsWith('data:')) {
        if (normalized.startsWith('card_') || normalized.startsWith('template_')) {
            normalized = `/uploads/templates/${normalized}`
        } else if (!normalized.startsWith('/')) {
            normalized = `/${normalized}`
        }
    }
    return getImageUrl(normalized)
}

export function getTemplateMediaUrl(templateData) {
    if (!templateData) return null
    // Carousel templates have per-card media, not a single header media
    const carouselComp = templateData?.components?.find(c => (c.type || '').toUpperCase() === 'CAROUSEL')
    if (carouselComp || (Array.isArray(templateData?.cards) && templateData.cards.length > 0)) {
        return null
    }
    const headerComp = templateData?.components?.find(c => (c.type || '').toUpperCase() === 'HEADER')

    const candidateUrls = [
        templateData?.header_media_url,
        templateData?.headerMediaUrl,
        templateData?.media_url,
        templateData?.mediaUrl,
        templateData?.mediaPreviewUrl,
        templateData?.headerMedia,
        templateData?.header_media,
        templateData?.sampleMedia,
        templateData?.sample_media,
        headerComp?.media_url,
        headerComp?.header_url,
        headerComp?.example?.header_url?.[0],
        headerComp?.example?.header_handle?.[0],
        (templateData?.meta_header_handle && (templateData.meta_header_handle.startsWith('http') || templateData.meta_header_handle.startsWith('/'))) ? templateData.meta_header_handle : null
    ]

    const raw = candidateUrls.find(u => {
        if (!u || typeof u !== 'string') return false
        const s = u.trim()
        return s.length > 0 && !s.startsWith('4::') && (
            s.startsWith('http://') || 
            s.startsWith('https://') || 
            s.startsWith('/uploads/') || 
            s.startsWith('uploads/') || 
            s.startsWith('/api/uploads/') || 
            s.startsWith('api/uploads/') || 
            s.startsWith('blob:') || 
            s.startsWith('data:') ||
            s.includes('/templates/') ||
            s.startsWith('template_') ||
            s.match(/\.(png|jpg|jpeg|gif|webp|mp4|pdf)$/i)
        )
    })

    if (!raw) return null
    let normalized = raw.trim()
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://') && !normalized.startsWith('blob:') && !normalized.startsWith('data:')) {
        if (normalized.startsWith('template_')) {
            normalized = `/uploads/templates/${normalized}`
        } else if (!normalized.startsWith('/')) {
            normalized = `/${normalized}`
        }
    }
    return getImageUrl(normalized)
}

export function isTemplateMediaHeader(templateData) {
    if (!templateData) return false
    const cards = getTemplateCards(templateData)
    if (cards && cards.length > 0) {
        return true
    }
    const headerComp = templateData?.components?.find(c => (c.type || '').toUpperCase() === 'HEADER')
    const headerFormat = (headerComp?.format || templateData?.media_type || '').toUpperCase()
    return Boolean(
        (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerFormat) && headerFormat !== 'TEXT') ||
        templateData?.header_media_url ||
        templateData?.headerMediaUrl ||
        templateData?.media_url ||
        templateData?.mediaUrl ||
        (templateData?.media_type && ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(templateData.media_type.toUpperCase())) ||
        (headerComp?.example?.header_handle?.[0] && headerFormat !== 'TEXT') ||
        (headerComp?.example?.header_url?.[0] && headerFormat !== 'TEXT')
    )
}

export default function MediaHeaderUpload({
    templateData,
    onMediaChange,
    customPreview = null,
    style = {}
}) {
    const singleFileInputRef = useRef(null)
    const cardFileInputRefs = useRef([])

    const [singleSlot, setSingleSlot] = useState({
        file: null,
        previewUrl: null,
        base64: null,
        isRemoved: false,
        error: false
    })

    const [carouselSlots, setCarouselSlots] = useState({})

    const cards = getTemplateCards(templateData)
    const isCarousel = Array.isArray(cards) && cards.length > 0

    // Reset local uploaded previews and error state if selected template changes
    useEffect(() => {
        setSingleSlot({
            file: null,
            previewUrl: null,
            base64: null,
            isRemoved: false,
            error: false
        })
        setCarouselSlots({})
    }, [templateData?.name, templateData?.id, templateData?.template_name])

    if (!isTemplateMediaHeader(templateData)) {
        return null
    }

    // ─── CAROUSEL HANDLERS ──────────────────────────────────────────
    const handleCardFileSelect = (cardIndex, e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const isVideo = file.type?.startsWith('video/')
        const maxLimit = isVideo ? 16 * 1024 * 1024 : 5 * 1024 * 1024
        const maxMbText = isVideo ? '16 MB' : '5 MB'

        if (file.size > maxLimit) {
            alert(`Card media size exceeds WhatsApp limit of ${maxMbText} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please choose a smaller file.`)
            e.target.value = ''
            return
        }

        const objectUrl = URL.createObjectURL(file)
        const reader = new FileReader()
        reader.onload = (evt) => {
            const base64 = evt.target?.result
            const updatedSlot = {
                file,
                previewUrl: objectUrl,
                base64,
                isRemoved: false,
                error: false
            }
            const updatedCarouselSlots = {
                ...carouselSlots,
                [cardIndex]: updatedSlot
            }
            setCarouselSlots(updatedCarouselSlots)

            if (typeof onMediaChange === 'function') {
                const carouselData = cards.map((c, idx) => {
                    const slot = updatedCarouselSlots[idx]
                    const defaultUrl = getCardMediaUrl(c)
                    const isRem = slot?.isRemoved === true
                    const activeUrl = isRem ? null : (slot?.previewUrl || defaultUrl || null)
                    return {
                        cardIndex: idx,
                        file: slot?.file || null,
                        previewUrl: activeUrl,
                        base64: slot?.base64 || null,
                        isRemoved: isRem
                    }
                })
                onMediaChange(null, null, null, carouselData)
            }
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveCardMedia = (cardIndex, e) => {
        e.stopPropagation()
        const updatedSlot = {
            file: null,
            previewUrl: null,
            base64: null,
            isRemoved: true,
            error: false
        }
        const updatedCarouselSlots = {
            ...carouselSlots,
            [cardIndex]: updatedSlot
        }
        setCarouselSlots(updatedCarouselSlots)

        // Clear file input value
        if (cardFileInputRefs.current[cardIndex]) {
            cardFileInputRefs.current[cardIndex].value = ''
        }

        if (typeof onMediaChange === 'function') {
            const carouselData = cards.map((c, idx) => {
                const slot = updatedCarouselSlots[idx]
                const defaultUrl = getCardMediaUrl(c)
                const isRem = slot?.isRemoved === true
                const activeUrl = isRem ? null : (slot?.previewUrl || defaultUrl || null)
                return {
                    cardIndex: idx,
                    file: slot?.file || null,
                    previewUrl: activeUrl,
                    base64: slot?.base64 || null,
                    isRemoved: isRem
                }
            })
            onMediaChange(null, null, null, carouselData)
        }
    }

    const triggerCardFileBrowse = (cardIndex) => {
        if (cardFileInputRefs.current[cardIndex]) {
            cardFileInputRefs.current[cardIndex].click()
        }
    }

    // ─── SINGLE MEDIA HANDLERS ──────────────────────────────────────
    const handleSingleFileSelect = (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        const isVideo = file.type?.startsWith('video/') || formatLabel === 'VIDEO'
        const isDoc = file.type === 'application/pdf' || formatLabel === 'DOCUMENT'
        const maxLimit = isDoc ? 50 * 1024 * 1024 : isVideo ? 16 * 1024 * 1024 : 5 * 1024 * 1024
        const maxMbText = isDoc ? '50 MB' : isVideo ? '16 MB' : '5 MB'

        if (file.size > maxLimit) {
            alert(`File size exceeds WhatsApp limit of ${maxMbText} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please choose a smaller file.`)
            e.target.value = ''
            return
        }

        const objectUrl = URL.createObjectURL(file)
        const reader = new FileReader()
        reader.onload = (evt) => {
            const base64 = evt.target?.result
            setSingleSlot({
                file,
                previewUrl: objectUrl,
                base64,
                isRemoved: false,
                error: false
            })

            if (typeof onMediaChange === 'function') {
                onMediaChange(file, objectUrl, base64, null)
            }
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveSingleMedia = (e) => {
        e.stopPropagation()
        setSingleSlot({
            file: null,
            previewUrl: null,
            base64: null,
            isRemoved: true,
            error: false
        })

        if (singleFileInputRef.current) {
            singleFileInputRef.current.value = ''
        }

        if (typeof onMediaChange === 'function') {
            onMediaChange(null, '__REMOVED__', null, null)
        }
    }

    const triggerSingleFileBrowse = () => {
        if (singleFileInputRef.current) {
            singleFileInputRef.current.click()
        }
    }

    // ─── RENDER CAROUSEL SLOTS ──────────────────────────────────────
    if (isCarousel) {
        return (
            <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                ...style
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label className="field-label" style={{ margin: 0, fontWeight: '700', color: '#334155' }}>
                            Upload Media:
                        </label>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                            ({cards.length} Carousel Cards)
                        </span>
                    </div>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        textTransform: 'uppercase'
                    }}>
                        CAROUSEL
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: cards.length > 2 ? 'repeat(auto-fit, minmax(180px, 1fr))' : '1fr 1fr',
                    gap: '12px',
                    width: '100%'
                }}>
                    {cards.map((card, cIdx) => {
                        const cardHeader = card.components?.find(c => (c.type || '').toUpperCase() === 'HEADER')
                        const formatLabel = (cardHeader?.format || card.media_type || card.format || 'IMAGE').toUpperCase()
                        const defaultMedia = getCardMediaUrl(card)
                        const slot = carouselSlots[cIdx] || {}
                        const isRemoved = slot.isRemoved === true
                        const activePreview = isRemoved ? null : (slot.previewUrl || defaultMedia)
                        const hasError = slot.error === true
                        const hasMediaAttached = Boolean(activePreview && !hasError)

                        return (
                            <div
                                key={cIdx}
                                style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '10px',
                                    backgroundColor: '#fafaf9',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <input
                                    type="file"
                                    ref={(el) => { cardFileInputRefs.current[cIdx] = el }}
                                    style={{ display: 'none' }}
                                    accept={formatLabel === 'VIDEO' ? 'video/*' : formatLabel === 'DOCUMENT' ? '.pdf,.doc,.docx,.xls,.xlsx' : 'image/*'}
                                    onChange={(e) => handleCardFileSelect(cIdx, e)}
                                />

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                                        Card {cIdx + 1} Media
                                    </span>
                                    <span style={{
                                        fontSize: '10px',
                                        fontWeight: '600',
                                        padding: '1px 6px',
                                        borderRadius: '6px',
                                        backgroundColor: '#f1f5f9',
                                        color: '#475569'
                                    }}>
                                        {formatLabel}
                                    </span>
                                </div>

                                <div
                                    onClick={() => triggerCardFileBrowse(cIdx)}
                                    style={{
                                        position: 'relative',
                                        flex: 1,
                                        minHeight: '110px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: hasMediaAttached ? '1px solid #cbd5e1' : '2px dashed #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '8px',
                                        backgroundColor: hasMediaAttached ? '#ffffff' : '#f8fafc',
                                        cursor: 'pointer',
                                        overflow: 'hidden'
                                    }}
                                    title="Click to browse or change media file"
                                >
                                    {hasMediaAttached ? (
                                        <>
                                            {/* Overlaid Remove (X) Button */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleRemoveCardMedia(cIdx, e)}
                                                title={`Remove Card ${cIdx + 1} image`}
                                                style={{
                                                    position: 'absolute',
                                                    top: '6px',
                                                    right: '6px',
                                                    width: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#ef4444',
                                                    color: '#ffffff',
                                                    border: '2px solid #ffffff',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    lineHeight: 1,
                                                    zIndex: 10,
                                                    transition: 'all 0.15s ease-in-out'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#dc2626'
                                                    e.currentTarget.style.transform = 'scale(1.1)'
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#ef4444'
                                                    e.currentTarget.style.transform = 'scale(1)'
                                                }}
                                            >
                                                ✕
                                            </button>

                                            <div style={{ textAlign: 'center', width: '100%' }}>
                                                {formatLabel === 'VIDEO' ? (
                                                    <video
                                                        src={activePreview}
                                                        controls
                                                        style={{ maxHeight: '90px', maxWidth: '100%', borderRadius: '4px', objectFit: 'contain' }}
                                                    />
                                                ) : formatLabel === 'DOCUMENT' ? (
                                                    <div style={{ fontSize: '30px', margin: '4px 0' }}>📄</div>
                                                ) : (
                                                    <img
                                                        src={activePreview}
                                                        alt={`Card ${cIdx + 1} Media`}
                                                        style={{ maxHeight: '90px', maxWidth: '100%', borderRadius: '4px', objectFit: 'contain' }}
                                                        onError={(e) => {
                                                            if (!e.target.dataset.retried) {
                                                                e.target.dataset.retried = '1';
                                                                if (e.target.src && !e.target.src.includes('/api/uploads/') && e.target.src.includes('/uploads/')) {
                                                                    e.target.src = e.target.src.replace('/uploads/', '/api/uploads/');
                                                                    return;
                                                                }
                                                                if (e.target.src && e.target.src.includes('/api/uploads/')) {
                                                                    e.target.src = e.target.src.replace('/api/uploads/', '/uploads/');
                                                                    return;
                                                                }
                                                            }
                                                            setCarouselSlots(prev => ({
                                                                ...prev,
                                                                [cIdx]: { ...(prev[cIdx] || {}), error: true }
                                                            }))
                                                        }}
                                                    />
                                                )}
                                                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', fontWeight: '600' }}>
                                                    {slot.previewUrl ? 'Custom Attached' : 'Template Media'}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                                            <div style={{ fontSize: '24px', marginBottom: '2px' }}>
                                                {formatLabel === 'VIDEO' ? '🎥' : formatLabel === 'DOCUMENT' ? '📄' : '🖼️'}
                                            </div>
                                            <div style={{ fontSize: '11px', fontWeight: '600', color: '#4f46e5' }}>
                                                + Upload Card {cIdx + 1}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                                                Click to browse
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    // ─── RENDER SINGLE MEDIA SLOT ───────────────────────────────────
    const headerComp = templateData?.components?.find(c => (c.type || '').toUpperCase() === 'HEADER')
    const formatLabel = (headerComp?.format || templateData?.media_type || 'IMAGE').toUpperCase()
    const defaultTemplateMedia = getTemplateMediaUrl(templateData)
    const isSingleRemoved = singleSlot.isRemoved === true
    const activeSinglePreview = isSingleRemoved ? null : (singleSlot.previewUrl || customPreview || defaultTemplateMedia)
    const hasSingleAttached = Boolean(activeSinglePreview && !singleSlot.error)

    return (
        <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            ...style
        }}>
            <input
                type="file"
                ref={singleFileInputRef}
                style={{ display: 'none' }}
                accept={formatLabel === 'VIDEO' ? 'video/*' : formatLabel === 'DOCUMENT' ? '.pdf,.doc,.docx,.xls,.xlsx' : 'image/*'}
                onChange={handleSingleFileSelect}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label className="field-label" style={{ margin: 0, fontWeight: '700', color: '#334155' }}>
                    Upload Media:
                </label>
                <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#e0e7ff',
                    color: '#3730a3',
                    textTransform: 'uppercase'
                }}>
                    {formatLabel}
                </span>
            </div>

            <div
                onClick={triggerSingleFileBrowse}
                style={{
                    position: 'relative',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: hasSingleAttached ? '1px solid #cbd5e1' : '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: hasSingleAttached ? '#ffffff' : '#f8fafc',
                    minHeight: '130px',
                    cursor: 'pointer'
                }}
                title="Click to browse or change media file"
            >
                {hasSingleAttached ? (
                    <>
                        {/* Overlaid Remove (X) Button */}
                        <button
                            type="button"
                            onClick={handleRemoveSingleMedia}
                            title="Remove attached media"
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                border: '2px solid #ffffff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '13px',
                                fontWeight: 'bold',
                                lineHeight: 1,
                                zIndex: 10,
                                transition: 'all 0.15s ease-in-out'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#dc2626'
                                e.currentTarget.style.transform = 'scale(1.1)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#ef4444'
                                e.currentTarget.style.transform = 'scale(1)'
                            }}
                        >
                            ✕
                        </button>

                        <div style={{ textAlign: 'center', width: '100%' }}>
                            {formatLabel === 'VIDEO' ? (
                                <video src={activeSinglePreview} controls style={{ maxHeight: '120px', maxWidth: '100%', borderRadius: '6px', objectFit: 'contain' }} />
                            ) : formatLabel === 'DOCUMENT' ? (
                                <div style={{ fontSize: '36px', margin: '6px 0' }}>📄</div>
                            ) : (
                                <img
                                    src={activeSinglePreview}
                                    alt="Template Header Media"
                                    style={{ maxHeight: '120px', maxWidth: '100%', borderRadius: '6px', objectFit: 'contain', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                                    onError={(e) => {
                                        if (!e.target.dataset.retried) {
                                            e.target.dataset.retried = '1';
                                            if (e.target.src && !e.target.src.includes('/api/uploads/') && e.target.src.includes('/uploads/')) {
                                                e.target.src = e.target.src.replace('/uploads/', '/api/uploads/');
                                                return;
                                            }
                                            if (e.target.src && e.target.src.includes('/api/uploads/')) {
                                                e.target.src = e.target.src.replace('/api/uploads/', '/uploads/');
                                                return;
                                            }
                                        }
                                        setSingleSlot(prev => ({ ...prev, error: true }))
                                    }}
                                />
                            )}
                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', fontWeight: '600' }}>
                                {singleSlot.previewUrl ? 'Custom Media Attached' : 'Template Media Attached'}
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '28px', marginBottom: '4px' }}>
                            {formatLabel === 'VIDEO' ? '🎥' : formatLabel === 'DOCUMENT' ? '📄' : '🖼️'}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#4f46e5' }}>
                            + Upload {formatLabel.toLowerCase()} file
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                            Click to browse or Drag &amp; Drop
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
