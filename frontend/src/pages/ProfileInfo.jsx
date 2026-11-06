import React, { useState, useEffect } from 'react'
import { useTitle } from '../context/TitleContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { getImageUrl } from '../config.js'
import api from '../services/api.js'

export default function ProfileInfo() {
  const { setTitle } = useTitle()
  const { user, updateUser } = useAuth()

  useEffect(() => {
    setTitle('Profile Info')
  }, [setTitle])

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Form State
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [appName, setAppName] = useState('')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')

  // Initialize form data from logged in user
  useEffect(() => {
    if (user) {
      setName(user.full_name || user.name || '')
      setEmail(user.email || '')
      setMobile(user.mobile || '')
      setAppName(user.app_name || user.organization_name || 'OfficialWA')
      setLogoPreview(user.app_logo || '')
    }
  }, [user])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setSuccessMsg('')
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('full_name', name)
      formData.append('name', name)
      formData.append('email', email)
      formData.append('mobile', mobile)
      formData.append('app_name', appName)
      if (logoFile) {
        formData.append('app_logo', logoFile)
      } else if (logoPreview) {
        formData.append('app_logo', logoPreview)
      }

      const res = await api.put('/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (res.data && res.data.success) {
        setSuccessMsg(res.data.message || 'Profile & Branding updated successfully!')
        if (res.data.user) {
          updateUser(res.data.user)
        }
        setIsEditing(false)
      } else {
        setErrorMsg(res.data?.message || 'Failed to update profile.')
      }
    } catch (err) {
      console.error('Update profile error:', err)
      setErrorMsg(err.response?.data?.message || 'Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const displayName = user?.full_name || user?.name || user?.username || 'Admin'
  const displayEmail = user?.email || 'admin@officialwa.in'
  const displayRole = user?.role || 'Super Admin'
  const displayMobile = user?.mobile || '-'
  const displayAppName = user?.app_name || user?.organization_name || 'OfficialWA'
  const displayAppLogo = user?.app_logo || null

  return (
    <div className="profile-info-page">
      <div className="profile-info-card" style={{ maxWidth: '680px' }}>
        {/* Header */}
        <div className="profile-info-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="profile-info-avatar-wrap">
              <img
                src={getImageUrl(displayAppLogo || '/uploads/image.png')}
                alt="App Logo"
                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = getImageUrl('/uploads/image.png');
                }}
              />
            </div>
            <div>
              <h1 className="profile-info-title">{displayName}</h1>
              <span style={{ fontSize: '12px', color: 'white' }}>{displayRole}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn-edit-profile"
            onClick={() => {
              setIsEditing(!isEditing)
              setSuccessMsg('')
              setErrorMsg('')
            }}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: isEditing ? '#f1f5f9' : '#00a884',
              color: isEditing ? '#475569' : '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
        </div>

        {/* Banners */}
        {successMsg && (
          <div style={{ margin: '16px 24px 0 24px', padding: '12px 16px', background: '#dcfce7', color: '#15803d', borderRadius: '6px', fontSize: '14px', fontWeight: '500' }}>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ margin: '16px 24px 0 24px', padding: '12px 16px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '14px', fontWeight: '500' }}>
            {errorMsg}
          </div>
        )}

        {/* View Mode */}
        {!isEditing ? (
          <div className="profile-info-body">
            <div className="profile-info-row">
              <span className="profile-info-label">NAME</span>
              <span className="profile-info-value">{displayName}</span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">EMAIL</span>
              <span className="profile-info-value">{displayEmail}</span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">ROLE</span>
              <span className="profile-info-value">{displayRole}</span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">MOBILE</span>
              <span className="profile-info-value">{displayMobile}</span>
            </div>
            <div className="profile-info-row">
              <span className="profile-info-label">APP NAME</span>
              <span className="profile-info-value" style={{ fontWeight: '600', color: '#0f766e' }}>{displayAppName}</span>
            </div>
            {/* <div className="profile-info-row">
              <span className="profile-info-label">SIDEBAR LOGO</span>
              <div className="profile-info-value" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={getImageUrl(displayAppLogo || '/uploads/image.png')}
                  alt="Sidebar Logo"
                  style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = getImageUrl('/uploads/image.png');
                  }}
                />
                <span style={{ fontSize: '13px', color: '#64748b' }}>Custom Logo Uploaded</span>
              </div>
            </div> */}
          </div>
        ) : (
          /* Edit Mode Form */
          <form onSubmit={handleSave} style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Enter mobile number"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  App / Brand Name (Sidebar Title)
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="e.g. OfficialWA"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600' }}
                  required
                />
              </div>

              {/* <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                  Sidebar Logo (Replaces default 'W' Icon)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    <img
                      src={getImageUrl(logoPreview || '/uploads/image.png')}
                      alt="Logo preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = getImageUrl('/uploads/image.png');
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ fontSize: '13px' }}
                    />
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Recommended: PNG or JPG image (Square 1:1)
                    </div>
                  </div>
                </div>
              </div> */}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{ padding: '10px 24px', borderRadius: '6px', border: 'none', background: '#00a884', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}
                >
                  {isSaving ? 'Saving Changes...' : 'Save & Update DB'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
