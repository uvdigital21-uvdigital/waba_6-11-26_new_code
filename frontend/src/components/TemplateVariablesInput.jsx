import React, { useState, useEffect } from 'react'

const GLOBAL_HISTORY_KEY = 'wa_variable_history_global'

export const getVariableHistory = (varNum) => {
    try {
        const specificRaw = localStorage.getItem(`wa_var_history_${varNum}`)
        const globalRaw = localStorage.getItem(GLOBAL_HISTORY_KEY)
        const specific = specificRaw ? JSON.parse(specificRaw) : []
        const global = globalRaw ? JSON.parse(globalRaw) : []
        
        // Merge with specific first, then global, deduplicated
        const combined = [...new Set([...specific, ...global])]
        return combined.filter(item => typeof item === 'string' && item.trim().length > 0)
    } catch (_) {
        return []
    }
}

export const saveVariableHistoryItem = (varNum, val) => {
    if (!val || typeof val !== 'string') return
    const trimmed = val.trim()
    if (!trimmed) return

    try {
        // Save to specific var history
        const specificRaw = localStorage.getItem(`wa_var_history_${varNum}`)
        const specific = specificRaw ? JSON.parse(specificRaw) : []
        const updatedSpecific = [trimmed, ...specific.filter(item => item !== trimmed)].slice(0, 15)
        localStorage.setItem(`wa_var_history_${varNum}`, JSON.stringify(updatedSpecific))

        // Save to global history
        const globalRaw = localStorage.getItem(GLOBAL_HISTORY_KEY)
        const global = globalRaw ? JSON.parse(globalRaw) : []
        const updatedGlobal = [trimmed, ...global.filter(item => item !== trimmed)].slice(0, 30)
        localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(updatedGlobal))
    } catch (_) {}
}

export default function TemplateVariablesInput({
    variables = [],
    variableValues = {},
    onVariableChange
}) {
    const [historyMap, setHistoryMap] = useState({})

    const refreshHistory = () => {
        const map = {}
        variables.forEach(v => {
            map[v] = getVariableHistory(v)
        })
        setHistoryMap(map)
    }

    useEffect(() => {
        refreshHistory()
    }, [variables.join(',')])

    if (!variables || variables.length === 0) return null

    const handleBlur = (v, value) => {
        if (value && value.trim()) {
            saveVariableHistoryItem(v, value)
            refreshHistory()
        }
    }

    const handleSelectSuggestion = (v, value) => {
        onVariableChange(v, value)
        saveVariableHistoryItem(v, value)
        refreshHistory()
    }

    const handleDeleteHistoryItem = (e, v, itemToDelete) => {
        e.stopPropagation()
        try {
            const specificRaw = localStorage.getItem(`wa_var_history_${v}`)
            const globalRaw = localStorage.getItem(GLOBAL_HISTORY_KEY)
            const specific = specificRaw ? JSON.parse(specificRaw) : []
            const global = globalRaw ? JSON.parse(globalRaw) : []
            
            localStorage.setItem(`wa_var_history_${v}`, JSON.stringify(specific.filter(i => i !== itemToDelete)))
            localStorage.setItem(GLOBAL_HISTORY_KEY, JSON.stringify(global.filter(i => i !== itemToDelete)))
            refreshHistory()
        } catch (_) {}
    }

    return (
        <div style={{
            marginTop: '16px',
            marginBottom: '16px',
            backgroundColor: '#ffffff',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}>
            <div style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#991b1b',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <span>📝</span>
                <span>Template Variables:</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {variables.map((v) => {
                    const suggestions = historyMap[v] || []
                    const currentValue = variableValues[v] || ''

                    return (
                        <div key={v} style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#dc2626', marginBottom: '6px' }}>
                                ENTER CONTENT FOR {`{{${v}}}`}: <span style={{ color: '#ef4444', fontWeight: '400', fontSize: '12px' }}>(MAX 200 CHARACTERS)</span>
                            </label>
                            
                            <input
                                type="text"
                                list={`var-datalist-${v}`}
                                autoComplete="on"
                                maxLength={200}
                                placeholder={`Enter value for {{${v}}}`}
                                value={currentValue}
                                onChange={(e) => onVariableChange(v, e.target.value)}
                                onBlur={(e) => handleBlur(v, e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    border: '1.5px solid #cbd5e1',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    color: '#0f172a',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    boxSizing: 'border-box',
                                    backgroundColor: '#ffffff'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#0284c7'
                                }}
                                onBlurCapture={(e) => {
                                    e.target.style.borderColor = '#cbd5e1'
                                }}
                            />

                            {/* HTML5 Datalist for automatic browser suggestions on type/focus/click */}
                            <datalist id={`var-datalist-${v}`}>
                                {suggestions.map((item, idx) => (
                                    <option key={idx} value={item} />
                                ))}
                            </datalist>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
