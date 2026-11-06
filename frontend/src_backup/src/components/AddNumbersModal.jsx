import React, { useState, useEffect } from 'react'

export default function AddNumbersModal({ isOpen, onClose, onAdd }) {
    const [formData, setFormData] = useState({
        waNumber: '',
        waNumberId: '',
        wabizId: '',
        permanentToken: ''
    })
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')

    useEffect(() => {
        if (!isOpen) {
            // Reset form when modal closes
            setFormData({
                waNumber: '',
                waNumberId: '',
                wabizId: '',
                permanentToken: ''
            })
            setErrors({})
            setSubmitError('')
            setSubmitting(false)
        }
    }, [isOpen])

    const validate = () => {
        const newErrors = {}
        if (!formData.waNumber.trim()) {
            newErrors.waNumber = 'WA Number is required'
        }
        if (!formData.waNumberId.trim()) {
            newErrors.waNumberId = 'WA NumberId is required'
        }
        if (!formData.wabizId.trim()) {
            newErrors.wabizId = 'WaBiz Id is required'
        }
        if (!formData.permanentToken.trim()) {
            newErrors.permanentToken = 'Permanent Token is required'
        }
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitError('')

        if (!validate()) {
            return
        }

        setSubmitting(true)
        try {
            if (onAdd) {
                // Use custom handler if provided (for backward compatibility)
                await onAdd(formData)
            } else {
                // Default submission logic using existing API
                const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'
                const token = localStorage.getItem('wa_dashboard_token')

                const res = await fetch(`${API_BASE}/numbers`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify(formData)
                })

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}))
                    throw new Error(errorData.message || 'Failed to add number')
                }

                const data = await res.json()
                if (onAdd) {
                    await onAdd(data)
                }
            }
            onClose()
        } catch (err) {
            setSubmitError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDiscard = () => {
        onClose()
    }

    if (!isOpen) return null

    return (
        <>
            {/* Bootstrap Modal */}
            <div
                className="modal fade show"
                style={{ display: 'block' }}
                tabIndex="-1"
                role="dialog"
                aria-labelledby="addNumberModalLabel"
                aria-hidden="true"
            >
                <div className="modal-dialog modal-dialog-centered" role="document">
                    <div className="modal-content">
                        {/* Modal Header */}
                        <div className="modal-header">
                            <h5 className="modal-title" id="addNumberModalLabel">
                                Add WaApi Number
                            </h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={handleDiscard}
                                aria-label="Close"
                            ></button>
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body">
                            {submitError && (
                                <div className="alert alert-danger" role="alert">
                                    {submitError}
                                </div>
                            )}

                            <form id="addNumberForm" onSubmit={handleSubmit}>
                                {/* Field 1: WA Number with Country Code */}
                                <div className="mb-3">
                                    <label htmlFor="waNumber" className="form-label">
                                        WA Number (with Country code)
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-control ${errors.waNumber ? 'is-invalid' : ''}`}
                                        id="waNumber"
                                        name="waNumber"
                                        placeholder="Enter wa number"
                                        value={formData.waNumber}
                                        onChange={handleChange}
                                        required
                                    />
                                    {errors.waNumber && (
                                        <div className="invalid-feedback">
                                            {errors.waNumber}
                                        </div>
                                    )}
                                </div>

                                {/* Field 2: WA NumberId */}
                                <div className="mb-3">
                                    <label htmlFor="waNumberId" className="form-label">
                                        WA NumberId (from Facebook)
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-control ${errors.waNumberId ? 'is-invalid' : ''}`}
                                        id="waNumberId"
                                        name="waNumberId"
                                        placeholder="Enter wa numberid"
                                        value={formData.waNumberId}
                                        onChange={handleChange}
                                        required
                                    />
                                    {errors.waNumberId && (
                                        <div className="invalid-feedback">
                                            {errors.waNumberId}
                                        </div>
                                    )}
                                </div>

                                {/* Field 3: WaBiz Id */}
                                <div className="mb-3">
                                    <label htmlFor="wabizId" className="form-label">
                                        WaBiz Id (from Facebook)
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-control ${errors.wabizId ? 'is-invalid' : ''}`}
                                        id="wabizId"
                                        name="wabizId"
                                        placeholder="Enter wabizid"
                                        value={formData.wabizId}
                                        onChange={handleChange}
                                        required
                                    />
                                    {errors.wabizId && (
                                        <div className="invalid-feedback">
                                            {errors.wabizId}
                                        </div>
                                    )}
                                </div>

                                {/* Field 4: Permanent Token */}
                                <div className="mb-3">
                                    <label htmlFor="permanentToken" className="form-label">
                                        Permanent Token (from Facebook)
                                    </label>
                                    <textarea
                                        className={`form-control ${errors.permanentToken ? 'is-invalid' : ''}`}
                                        id="permanentToken"
                                        name="permanentToken"
                                        placeholder="Enter Permanent Token from Facebook"
                                        rows={4}
                                        value={formData.permanentToken}
                                        onChange={handleChange}
                                        required
                                        style={{ height: '100px' }}
                                    />
                                    {errors.permanentToken && (
                                        <div className="invalid-feedback">
                                            {errors.permanentToken}
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleDiscard}
                                disabled={submitting}
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                form="addNumberForm"
                                className="btn btn-primary"
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Saving...
                                    </>
                                ) : (
                                    'Save'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Backdrop */}
            <div
                className="modal-backdrop fade show"
                onClick={handleDiscard}
            ></div>

            <style>{`
                .modal.show {
                    padding-right: 0 !important;
                }
                .modal-backdrop.show {
                    opacity: 0.5;
                }
                .modal-content {
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                    width: 100%;
                }
                .modal-dialog {
                    max-width: 750px;
                    margin: 1.75rem auto;
                }
                .modal-header {
                    border-bottom: 1px solid #dee2e6;
                    padding: 1.25rem 1.5rem;
                }
                .modal-title {
                    font-size: 24px;
                    font-weight: bold;
                    color: #212529;
                }
                .modal-body {
                    padding: 1.5rem;
                }
                .modal-footer {
                    border-top: 1px solid #dee2e6;
                    padding: 1rem 1.5rem;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .modal-footer .btn {
                    min-width: 100px;
                    padding: 0.5rem 1.5rem;
                    font-weight: 500;
                }
                .modal-footer .btn-secondary {
                    background-color: #6c757d;
                    border-color: #6c757d;
                }
                .modal-footer .btn-secondary:hover {
                    background-color: #5a6268;
                    border-color: #5a6268;
                }
                .modal-footer .btn-primary {
                    background-color: #0d6efd;
                    border-color: #0d6efd;
                }
                .modal-footer .btn-primary:hover {
                    background-color: #0b5ed7;
                    border-color: #0b5ed7;
                }
                .form-label {
                    font-size: 14px;
                    font-weight: 500;
                    color: #374151;
                    margin-bottom: 0.5rem;
                }
                .form-control {
                    padding: 0.625rem 0.875rem;
                    font-size: 15px;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
                }
                .form-control:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .form-control::placeholder {
                    color: #9ca3af;
                }
                textarea.form-control {
                    resize: vertical;
                    min-height: 100px;
                }
                .is-invalid {
                    border-color: #dc3545;
                }
                .is-invalid:focus {
                    box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
                }
                .invalid-feedback {
                    display: block;
                    width: 100%;
                    margin-top: 0.25rem;
                    font-size: 14px;
                    color: #dc3545;
                }
                .alert {
                    padding: 0.75rem 1rem;
                    margin-bottom: 1rem;
                    border-radius: 8px;
                    font-size: 14px;
                }
                .btn-close {
                    padding: 0.5rem;
                    opacity: 0.5;
                }
                .btn-close:hover {
                    opacity: 0.75;
                }
                @media (max-width: 768px) {
                    .modal-dialog {
                        margin: 0.5rem;
                        max-width: calc(100% - 1rem);
                    }
                    .modal-content {
                        border-radius: 10px;
                    }
                    .modal-header, .modal-body, .modal-footer {
                        padding-left: 1rem;
                        padding-right: 1rem;
                    }
                    .modal-title {
                        font-size: 20px;
                    }
                }
            `}</style>
        </>
    )
}