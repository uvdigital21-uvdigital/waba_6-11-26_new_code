import React, { useState } from 'react';
import { API_BASE_URL } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Dashboard.css';

export default function StaffMobileAppDownload() {
  const { token, user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGetDownloadLink = async () => {
    setDownloading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/app/download-link`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(
          res.status === 404
            ? 'Backend endpoint not found (404). Please ensure the latest backend is running on the server.'
            : `Server returned an error (Status ${res.status}). Please check backend logs.`
        );
      }

      if (res.ok && data.downloadUrl) {
        setDownloadInfo(data);
        // Trigger file download
        const downloadAnchor = document.createElement('a');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        downloadAnchor.href = data.downloadUrl.startsWith('http') ? data.downloadUrl : `${origin}${data.downloadUrl}`;
        downloadAnchor.setAttribute('download', 'OfficialWABA_Staff_Chat_v1.0.0.apk');
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } else {
        setError(data.message || 'Failed to generate download link');
      }
    } catch (err) {
      setError(err.message || 'Network error while requesting download');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = () => {
    if (downloadInfo?.fullDownloadUrl) {
      navigator.clipboard.writeText(downloadInfo.fullDownloadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="dashboard-content" style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 60px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #075e54 0%, #128c7e 100%)',
        borderRadius: '16px',
        padding: '32px 24px',
        color: '#ffffff',
        boxShadow: '0 8px 24px rgba(7, 94, 84, 0.18)',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            flexShrink: 0
          }}>
            📱
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>Official WABA Staff App</h1>
              <span style={{
                background: '#25d366',
                color: '#075e54',
                fontSize: '11px',
                fontWeight: '800',
                padding: '3px 9px',
                borderRadius: '999px',
                letterSpacing: '0.04em'
              }}>
                v1.0.0 RELEASE
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.9)' }}>
              Dedicated mobile chat inbox app for staff to view, manage, and reply to WhatsApp messages on the go.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          color: '#991b1b',
          fontSize: '13px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Main Download Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '32px 28px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div style={{ flex: '1 1 360px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
              Download Android APK
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.6 }}>
              Directly download and install the authenticated APK onto your Android phone or tablet. Uses secure, single-use signed download tokens.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '320px' }}>
              <button
                type="button"
                onClick={handleGetDownloadLink}
                disabled={downloading}
                style={{
                  background: '#25d366',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 14px rgba(37, 211, 102, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>{downloading ? '⏳ Generating Link...' : '⬇️ Download APK (v1.0.0)'}</span>
              </button>

              <small style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
                🔒 <strong>Only for authorized staff.</strong> Do not share this link.
              </small>
            </div>

            {downloadInfo && (
              <div style={{
                marginTop: '20px',
                padding: '14px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                fontSize: '12.5px',
                color: '#166534'
              }}>
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>✅ Download Started!</div>
                <div>Single-use link generated for <strong>{user?.name || user?.email}</strong>. Expires in 5 minutes.</div>
                {downloadInfo.fullDownloadUrl && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      marginTop: '8px',
                      background: '#ffffff',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      color: '#15803d',
                      cursor: 'pointer'
                    }}
                  >
                    {copied ? '✓ Link Copied!' : '📋 Copy Download Link'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* App Specs Box */}
          <div style={{
            flex: '0 0 280px',
            background: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              App Specifications
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Platform:</span>
                <strong style={{ color: '#1e293b' }}>Android (APK)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Target SDK:</span>
                <strong style={{ color: '#1e293b' }}>Android 14 (API 34)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>File Size:</span>
                <strong style={{ color: '#1e293b' }}>~12.4 MB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Permissions:</span>
                <strong style={{ color: '#16a34a' }}>Internet + Notify only</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Auth:</span>
                <strong style={{ color: '#1e293b' }}>Dashboard Credentials</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Android Installation Instructions Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '24px 28px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💡</span> Android Installation Guide
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#075e54', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', marginBottom: '10px' }}>1</div>
            <strong style={{ display: 'block', fontSize: '13.5px', color: '#1e293b', marginBottom: '4px' }}>Download the APK</strong>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
              Click the download button above directly from your Android phone or copy the link to Chrome on mobile.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#075e54', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', marginBottom: '10px' }}>2</div>
            <strong style={{ display: 'block', fontSize: '13.5px', color: '#1e293b', marginBottom: '4px' }}>Allow Unknown Apps</strong>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
              If prompted by Android, tap <strong>Settings → Allow from this source</strong> to approve installation of private staff apps.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#075e54', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px', marginBottom: '10px' }}>3</div>
            <strong style={{ display: 'block', fontSize: '13.5px', color: '#1e293b', marginBottom: '4px' }}>Log In & Start Chatting</strong>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
              Open the app and log in using your existing Official WABA dashboard username and password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
