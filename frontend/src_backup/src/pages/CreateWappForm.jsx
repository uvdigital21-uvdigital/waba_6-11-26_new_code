import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'

export default function CreateWappForm() {
    const navigate = useNavigate()
    const [formName, setFormName] = useState('')
    const [questions, setQuestions] = useState([
        { id: 1, text: '', format: 'TEXT' }
    ])
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
    const [advancedOptions, setAdvancedOptions] = useState({
        enableWebhook: false,
        addCompletionResponse: false,
        allowDuplicates: true
    })

    const addNewQuestion = () => {
        const newId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) + 1 : 1
        setQuestions([...questions, { id: newId, text: '', format: 'TEXT' }])
    }

    const deleteQuestion = (id) => {
        if (questions.length > 1) {
            setQuestions(questions.filter(q => q.id !== id))
        }
    }

    const updateQuestion = (id, field, value) => {
        setQuestions(questions.map(q =>
            q.id === id ? { ...q, [field]: value } : q
        ))
    }

    const handleSave = () => {
        console.log('Saving form:', { formName, questions, advancedOptions })
        // Add your save logic here
    }

    const toggleAdvancedOptions = () => {
        setShowAdvancedOptions(!showAdvancedOptions)
    }

    const handleCheckboxChange = (option) => {
        setAdvancedOptions({
            ...advancedOptions,
            [option]: !advancedOptions[option]
        })
    }

    return (
        <Layout title="Create WAPP Form">
            <div className="create-form-container">
                {/* Header */}
                <div className="create-form-header">
                    <div className="header-left">
                        <div className="form-icon">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="48" height="48" rx="12" fill="#1abc9c" />
                                <path d="M24 14C18.48 14 14 18.48 14 24C14 27.3 15.75 30.15 18.3 31.8L17.4 36.6L22.2 35.1C23.55 35.55 25.05 35.85 26.7 35.85C32.22 35.85 36.6 31.37 36.6 24.85C36.6 18.33 32.22 14 24 14Z" fill="white" />
                                <circle cx="20" cy="22" r="2" fill="#1abc9c" />
                                <circle cx="28" cy="22" r="2" fill="#1abc9c" />
                                <circle cx="24" cy="28" r="2" fill="#1abc9c" />
                            </svg>
                        </div>
                        <h1 className="page-title">Create WAPP Form</h1>
                    </div>
                    <button
                        className="btn-view-saved"
                        onClick={() => navigate('/reports/whatsapp-forms')}
                    >
                        View Saved Form
                    </button>
                </div>

                {/* Form Card */}
                <div className="form-card">
                    {/* Form Name Section */}
                    <div className="form-name-section">
                        <div className="form-name-field">
                            <label className="form-name-label">Form Name</label>
                            <input
                                type="text"
                                className="form-name-input"
                                placeholder=""
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>
                        <button className="btn-preview">Preview Sample Form</button>
                    </div>

                    {/* Questions Section */}
                    <div className="questions-section">
                        <div className="questions-header">
                            <h2 className="questions-title">Questions</h2>
                            <h2 className="format-title">Question Format</h2>
                        </div>

                        <div className="questions-list">
                            {questions.map((question, index) => (
                                <div key={question.id} className="question-row">
                                    <div className="question-input-wrapper">
                                        <textarea
                                            className="question-input"
                                            placeholder="Enter question"
                                            value={question.text}
                                            onChange={(e) => updateQuestion(question.id, 'text', e.target.value)}
                                            rows="3"
                                        />
                                    </div>
                                    <div className="format-select-wrapper">
                                        <select
                                            className="format-select"
                                            value={question.format}
                                            onChange={(e) => updateQuestion(question.id, 'format', e.target.value)}
                                        >
                                            <option value="TEXT">TEXT</option>
                                            <option value="NUMBER">NUMBER</option>
                                            <option value="EMAIL">EMAIL</option>
                                            <option value="PHONE">PHONE</option>
                                            <option value="DATE">DATE</option>
                                            <option value="TIME">TIME</option>
                                            <option value="TEXTAREA">TEXTAREA</option>
                                            <option value="SELECT">SELECT</option>
                                            <option value="RADIO">RADIO</option>
                                            <option value="CHECKBOX">CHECKBOX</option>
                                        </select>
                                    </div>
                                    <button
                                        className="btn-delete-question"
                                        onClick={() => deleteQuestion(question.id)}
                                        title="Delete question"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button className="btn-add-question" onClick={addNewQuestion}>
                            + Add New Question
                        </button>
                    </div>

                    {/* Webhook URL */}
                    <div className="webhook-section">
                        <div className="webhook-field">
                            <label className="webhook-label">Webhook URL</label>
                            <textarea
                                className="webhook-input"
                                placeholder=""
                                rows="3"
                            />
                        </div>
                        <button className="btn-view-webhook">View Webhook Form</button>
                    </div>

                    {/* Completion Response */}
                    <div className="completion-section">
                        <div className="completion-field">
                            <label className="completion-label">Completion Response</label>
                            <input
                                type="text"
                                className="completion-input"
                                placeholder="Enter message"
                            />
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                    <button className="btn-save-form" onClick={handleSave}>
                        Save WhatsApp Form
                    </button>
                    <button className="btn-view-saved-forms">
                        View Saved Forms
                    </button>
                    <div className="advanced-options-container">
                        <button className="btn-advanced-options" onClick={toggleAdvancedOptions}>
                            Advanced Options
                        </button>
                        {showAdvancedOptions && (
                            <div className="advanced-options-dropdown">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={advancedOptions.enableWebhook}
                                        onChange={() => handleCheckboxChange('enableWebhook')}
                                    />
                                    <span>Enable Webhook</span>
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={advancedOptions.addCompletionResponse}
                                        onChange={() => handleCheckboxChange('addCompletionResponse')}
                                    />
                                    <span>Add Completion Response</span>
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={advancedOptions.allowDuplicates}
                                        onChange={() => handleCheckboxChange('allowDuplicates')}
                                    />
                                    <span>Allow Duplicates</span>
                                </label>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    )
}