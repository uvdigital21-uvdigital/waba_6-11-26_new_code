import React, { useState, useEffect } from 'react';
import { API_BASE_URL, getImageUrl } from '../config.js';
import { getTemplateMediaUrl, getCardMediaUrl } from './MediaHeaderUpload.jsx';

export default function WhatsAppMobilePreview({
  template,
  messageText,
  customMediaUrl,
  customCarouselMedia = null,
  accountName
}) {
  const [imageError, setImageError] = useState(false);

  // Dynamic connected number / user display name state
  const [resolvedAccountName, setResolvedAccountName] = useState(() => {
    if (accountName) return accountName;
    try {
      const stored = localStorage.getItem('active_wa_account_name');
      if (stored) return stored;
      const userStr = localStorage.getItem('wa_dashboard_user');
      if (userStr) {
        const u = JSON.parse(userStr);
        return u.company_name || u.name || u.username || 'Official WhatsApp Account';
      }
    } catch (_) {}
    return 'Official WhatsApp Account';
  });

  // Fetch verified name / connected number name on mount or when active account changes
  useEffect(() => {
    if (accountName) {
      setResolvedAccountName(accountName);
      return;
    }
    const token = localStorage.getItem('wa_dashboard_token');
    const selectedId = localStorage.getItem('active_wa_account_id');
    if (token) {
      fetch(`${API_BASE_URL}/numbers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const list = data.numbers || data.data || data.whatsapp_accounts || [];
          if (list.length > 0) {
            const match = selectedId ? list.find(a => String(a.id) === String(selectedId)) || list[0] : list[0];
            const name = match.verified_name || match.name || match.display_phone_number || match.wa_number;
            if (name) {
              setResolvedAccountName(name);
              localStorage.setItem('active_wa_account_name', name);
            }
          }
        })
        .catch(() => {});
    }
  }, [accountName]);

  // Reset image error state when template or custom media changes
  useEffect(() => {
    setImageError(false);
  }, [template?.name, template?.id, customMediaUrl, customCarouselMedia]);

  // Helper to detect if media is a video
  const isVideoMedia = (urlOrCard, headerComp = null) => {
    if (headerComp && (headerComp.format || '').toUpperCase() === 'VIDEO') return true;
    if (!urlOrCard) return false;
    if (typeof urlOrCard === 'object') {
      if ((urlOrCard.mediaType || urlOrCard.media_type || '').toLowerCase() === 'video') return true;
      if ((urlOrCard.format || '').toUpperCase() === 'VIDEO') return true;
      const raw = urlOrCard.previewUrl || urlOrCard.headerMedia || urlOrCard.media_url || urlOrCard.base64 || '';
      return isVideoMedia(raw);
    }
    if (typeof urlOrCard === 'string') {
      const lower = urlOrCard.toLowerCase();
      return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov') || lower.includes('.mkv') || lower.startsWith('data:video');
    }
    return false;
  };

  const components = template?.components || [];
  const carouselComp = components.find(c => (c.type || '').toUpperCase() === 'CAROUSEL');
  const carouselCards = carouselComp?.cards || template?.cards || [];
  const isCarouselTemplate = Array.isArray(carouselCards) && carouselCards.length > 0;

  const headerComp = components.find(c => (c.type || '').toUpperCase() === 'HEADER');
  const footerComp = components.find(c => (c.type || '').toUpperCase() === 'FOOTER');
  const buttonComp = components.find(c => (c.type || '').toUpperCase() === 'BUTTONS');

  let headerText = null;
  let headerMedia = null;
  let isHeaderVideo = false;

  // Single header media resolution only applies when template is NOT carousel
  if (!isCarouselTemplate) {
    if (headerComp) {
      const format = (headerComp.format || template?.media_type || '').toUpperCase();
      if (headerComp.text && format !== 'IMAGE' && format !== 'VIDEO' && format !== 'DOCUMENT') {
        headerText = headerComp.text;
      } else if (format === 'IMAGE' || format === 'VIDEO' || (!format && (template?.header_media_url || template?.media_type))) {
        if (customMediaUrl === '__REMOVED__') {
          headerMedia = null;
        } else if (typeof customMediaUrl === 'string' && customMediaUrl.trim() && customMediaUrl !== '__REMOVED__') {
          headerMedia = getImageUrl(customMediaUrl);
        } else {
          headerMedia = getTemplateMediaUrl(template);
        }
        isHeaderVideo = format === 'VIDEO' || isVideoMedia(headerMedia);
      } else if (format === 'DOCUMENT') {
        headerText = '📄 [Document Header]';
      }
    } else if (template?.header_media_url || template?.media_type) {
      if (customMediaUrl === '__REMOVED__') {
        headerMedia = null;
      } else if (typeof customMediaUrl === 'string' && customMediaUrl.trim() && customMediaUrl !== '__REMOVED__') {
        headerMedia = getImageUrl(customMediaUrl);
      } else {
        headerMedia = getTemplateMediaUrl(template);
      }
      isHeaderVideo = template?.media_type === 'video' || isVideoMedia(headerMedia);
    }
  }

  const rawBodyText = components.find(c => (c.type || '').toUpperCase() === 'BODY')?.text || '';
  const displayText = (messageText !== undefined && messageText !== null && messageText !== '')
    ? messageText 
    : (rawBodyText || 'Select an official template from the dropdown to preview message layout and content in real-time.');

  const footerText = footerComp?.text || null;
  const buttons = buttonComp?.buttons || [];

  const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const displayName = resolvedAccountName || accountName || 'Official WhatsApp Account';

  return (
    <div className="wa-mobile-preview-container">
      <div className="wa-preview-header-badge">
        <span className="badge-pulse"></span>
        <span>Live Mobile Preview</span>
      </div>

      <div className="wa-phone-frame">
        {/* Top Phone Status Notch Bar */}
        <div className="wa-phone-status-bar">
          <span className="phone-time">{timeString}</span>
          <div className="phone-icons">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z"/>
            </svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/>
            </svg>
          </div>
        </div>

        {/* WhatsApp App Top Navigation Bar */}
        <div className="wa-app-bar">
          <div className="wa-app-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="wa-app-info">
            <div className="wa-app-title">
              <span>{displayName}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#00a884" className="wa-verified-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <div className="wa-app-sub">Official Business Account • Online</div>
          </div>
        </div>

        {/* Chat Conversation Wall Area */}
        <div className="wa-chat-wall">
          <div className="wa-date-pill">TODAY</div>

          {/* Incoming Message Card */}
          <div className="wa-card-bubble">
            {/* Header Media (Only rendered for Single Image/Media templates, NOT Carousel) */}
            {!isCarouselTemplate && (
              <>
                {headerMedia && !imageError ? (
                  <div style={{ width: '100%', marginBottom: '8px', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px', backgroundColor: '#e2e8f0', position: 'relative' }}>
                    {isHeaderVideo ? (
                      <video
                        src={headerMedia}
                        controls
                        style={{ width: '100%', height: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <img 
                        src={headerMedia} 
                        alt="Template Header" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
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
                          setImageError(true);
                        }}
                      />
                    )}
                  </div>
                ) : (headerComp && ((headerComp.format || '').toUpperCase() === 'IMAGE' || (headerComp.format || '').toUpperCase() === 'VIDEO') ? (
                  <div className="wa-card-header-text" style={{ color: '#0369a1', fontStyle: 'italic', fontSize: '12px', marginBottom: '8px' }}>
                    {(headerComp.format || '').toUpperCase() === 'VIDEO' ? '🎥 [Template Video Header]' : '📷 [Template Image Header]'}
                  </div>
                ) : null)}

                {/* Header Text */}
                {headerText && (
                  <div className="wa-card-header-text">
                    {headerText}
                  </div>
                )}
              </>
            )}

            {/* Body Content */}
            <div className="wa-card-body-text">
              {displayText.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < displayText.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>

            {/* Carousel Horizontal Cards (For Carousel Templates) */}
            {isCarouselTemplate && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '6px 0', marginTop: '6px', scrollbarWidth: 'thin' }}>
                {carouselCards.map((card, cIdx) => {
                  const cardHdr = card.components?.find(c => (c.type || '').toUpperCase() === 'HEADER');
                  const cardBody = card.components?.find(c => (c.type || '').toUpperCase() === 'BODY');
                  const cardBtns = card.components?.find(c => (c.type || '').toUpperCase() === 'BUTTONS')?.buttons || card.buttons || [];
                  
                  // Determine card media based on customCarouselMedia override or default
                  let cardImg = null;
                  const override = Array.isArray(customCarouselMedia) ? customCarouselMedia[cIdx] : customCarouselMedia?.[cIdx];

                  if (override !== undefined && override !== null) {
                    if (override.isRemoved === true || override === '__REMOVED__') {
                      cardImg = null;
                    } else if (typeof override === 'string' && override.trim() && override !== '__REMOVED__') {
                      cardImg = override;
                    } else if (override.previewUrl) {
                      cardImg = override.previewUrl;
                    } else if (override.file || override.base64) {
                      cardImg = override.previewUrl || override.base64;
                    } else if (!override.isRemoved) {
                      cardImg = getCardMediaUrl(card);
                    }
                  } else {
                    cardImg = getCardMediaUrl(card);
                  }

                  const resolvedCardImg = cardImg ? (
                    (typeof cardImg === 'string' && (cardImg.startsWith('http') || cardImg.startsWith('data:') || cardImg.startsWith('blob:')))
                      ? cardImg
                      : getImageUrl(cardImg)
                  ) : null;

                  const isCardVid = isVideoMedia(override || card, cardHdr) || isVideoMedia(resolvedCardImg);

                  return (
                    <div key={cIdx} style={{ minWidth: '130px', maxWidth: '140px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px', fontSize: '11px', flexShrink: 0 }}>
                      <div style={{ height: '65px', background: '#0f172a', borderRadius: '4px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                        {resolvedCardImg ? (
                          isCardVid ? (
                            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                              <video
                                src={resolvedCardImg}
                                muted
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', pointerEvents: 'none' }}>
                                ▶
                              </div>
                            </div>
                          ) : (
                            <img
                              src={resolvedCardImg}
                              alt={`Card ${cIdx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
                                e.target.style.display = 'none';
                              }}
                            />
                          )
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{isCardVid ? `🎬 Card #${cIdx + 1}` : `🖼 Card #${cIdx + 1}`}</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {cardBody?.text || card.body || `Card ${cIdx + 1}`}
                      </div>
                      {cardBtns.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {cardBtns.map((cb, cbIdx) => (
                            <div key={cbIdx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '3px 4px', textAlign: 'center', fontSize: '10px', color: '#00a884', fontWeight: 600 }}>
                              {cb.text || 'View Details'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {footerText && (
              <div className="wa-card-footer-text">
                {footerText}
              </div>
            )}

            {/* Timestamp & Ticks */}
            <div className="wa-card-meta">
              <span className="wa-card-time">{timeString}</span>
              <span className="wa-card-ticks">✓✓</span>
            </div>

            {/* Action Buttons (For Non-Carousel templates) */}
            {!isCarouselTemplate && buttons.length > 0 && (
              <div className="wa-card-buttons">
                {buttons.map((btn, bIndex) => (
                  <div key={bIndex} className="wa-card-btn-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    <span>{btn.text || btn.url || 'Option'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
