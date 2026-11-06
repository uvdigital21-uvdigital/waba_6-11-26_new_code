import React, { useState, useEffect } from 'react';
import { useFlowStore } from '../../store/useFlowStore.js';
import api from '../../services/api.js';
import { FiX, FiPlus, FiTrash, FiUpload, FiSmile } from 'react-icons/fi';
import MediaHeaderUpload, { isTemplateMediaHeader } from '../MediaHeaderUpload.jsx';

export default function NodeConfigPanel() {
    const selectedNode = useFlowStore((state) => state.selectedNode);
    const setSelectedNode = useFlowStore((state) => state.setSelectedNode);
    const updateNodeData = useFlowStore((state) => state.updateNodeData);

    const removeEdgeByHandle = useFlowStore((state) => state.removeEdgeByHandle);

    const [localData, setLocalData] = useState({});
    const [keywordInput, setKeywordInput] = useState('');
    const [metaTemplates, setMetaTemplates] = useState([]);
    const [tagsList, setTagsList] = useState([]);
    const [groupsList, setGroupsList] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (selectedNode) {
            const data = selectedNode.data || {};
            setLocalData(data);
            if (selectedNode.type === 'starting_keyword') {
                const kwArr = Array.isArray(data.keywords) ? data.keywords : [];
                setKeywordInput(data.rawKeywords !== undefined ? data.rawKeywords : kwArr.join(', '));
            }
        }
    }, [selectedNode?.id]);

    useEffect(() => {
        // Load dropdown options for templates, tags, groups safely
        api.get('/meta-templates')
            .then((res) => {
                const list = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.templates) ? res.data.templates : []);
                setMetaTemplates(list);
            })
            .catch(() => setMetaTemplates([]));

        api.get('/tags')
            .then((res) => {
                const list = Array.isArray(res.data?.tags) ? res.data.tags : (Array.isArray(res.data) ? res.data : []);
                setTagsList(list);
            })
            .catch(() => setTagsList([]));

        api.get('/groups')
            .then((res) => {
                const list = Array.isArray(res.data?.groups) ? res.data.groups : (Array.isArray(res.data) ? res.data : []);
                setGroupsList(list);
            })
            .catch(() => setGroupsList([]));
    }, []);

    if (!selectedNode) return null;

    const handleChange = (field, value) => {
        const updated = { ...localData, [field]: value };
        setLocalData(updated);
        updateNodeData(selectedNode.id, updated);
    };

    const handleKeywordInputChange = (val) => {
        setKeywordInput(val);
        // Split by commas, semicolons, or newlines
        const parsed = val
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);

        // Deduplicate while preserving order
        const seen = new Set();
        const unique = [];
        for (const k of parsed) {
            const lower = k.toLowerCase();
            if (!seen.has(lower)) {
                seen.add(lower);
                unique.push(k);
            }
        }

        const updated = { ...localData, keywords: unique, rawKeywords: val };
        setLocalData(updated);
        updateNodeData(selectedNode.id, updated);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/chatbot/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const updated = {
                ...localData,
                mediaUrl: res.data.fileUrl,
                mediaName: res.data.fileName,
                mediaType: res.data.fileType,
                file: res.data.fileUrl,
                fileUrl: res.data.fileUrl
            };
            setLocalData(updated);
            updateNodeData(selectedNode.id, updated);
        } catch (err) {
            alert('File upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsUploading(false);
        }
    };

    const insertVariable = (varName) => {
        const currentMsg = localData.message || '';
        handleChange('message', currentMsg + ` {{${varName}}}`);
    };

    return (
        <aside className="node-config-panel">
            <div className="config-header">
                <h3>Configure Node</h3>
                <button type="button" className="close-btn" onClick={() => setSelectedNode(null)}>
                    <FiX size={18} />
                </button>
            </div>

            <div className="config-scroll">
                {/* 1. Starting Keyword */}
                {selectedNode.type === 'starting_keyword' && (
                    <div className="form-group">
                        <label>Trigger Keywords (comma separated)</label>
                        <textarea
                            rows={3}
                            value={keywordInput}
                            onChange={(e) => handleKeywordInputChange(e.target.value)}
                            placeholder="e.g. SEO, seo, Seo, price list, track order"
                        />
                        <p className="field-hint">Incoming messages matching any of these keywords will start this flow. Separate multiple keywords with commas.</p>
                        {Array.isArray(localData.keywords) && localData.keywords.length > 0 && (
                            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {localData.keywords.map((kw, idx) => (
                                    <span
                                        key={idx}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            background: '#ecfdf5',
                                            color: '#065f46',
                                            border: '1px solid #a7f3d0',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            fontSize: '11px',
                                            fontWeight: '600'
                                        }}
                                    >
                                        ✓ {kw}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Text Reply */}
                {selectedNode.type === 'text_reply' && (
                    <div className="form-group">
                        <div className="label-row">
                            <label>Message Content</label>
                            <div className="var-buttons">
                                <button type="button" onClick={() => insertVariable('name')}>+ Name</button>
                                <button type="button" onClick={() => insertVariable('phone')}>+ Phone</button>
                                <button type="button" onClick={() => insertVariable('email')}>+ Email</button>
                            </div>
                        </div>
                        <textarea
                            rows={6}
                            value={localData.message || ''}
                            onChange={(e) => handleChange('message', e.target.value)}
                            placeholder="Type your WhatsApp message here..."
                        />
                    </div>
                )}

                {/* 3. Text + Button */}
                {selectedNode.type === 'text_button' && (
                    <>
                        <div className="form-group">
                            <label>Message Body</label>
                            <textarea
                                rows={4}
                                value={localData.message || ''}
                                onChange={(e) => handleChange('message', e.target.value)}
                                placeholder="Message text above buttons..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Buttons (Max 3)</label>
                            {(localData.buttons || []).map((btn, idx) => (
                                <div key={idx} className="array-item-row">
                                    <input
                                        type="text"
                                        placeholder={`Button ${idx + 1} Text`}
                                        value={btn.text || ''}
                                        onChange={(e) => {
                                             const updated = [...(localData.buttons || [])];
                                            updated[idx] = { ...updated[idx], text: e.target.value };
                                            handleChange('buttons', updated);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="danger-btn"
                                        onClick={() => {
                                            const deletedBtn = (localData.buttons || [])[idx];
                                            if (deletedBtn && deletedBtn.id) {
                                                removeEdgeByHandle(selectedNode.id, `button-${deletedBtn.id}`);
                                            }
                                            const updated = (localData.buttons || []).filter((_, i) => i !== idx);
                                            handleChange('buttons', updated);
                                        }}
                                    >
                                        <FiTrash size={14} />
                                    </button>
                                </div>
                            ))}
                            {(localData.buttons || []).length < 3 ? (
                                <button
                                    type="button"
                                    className="add-subitem-btn"
                                    onClick={() => {
                                        const count = (localData.buttons || []).length;
                                        const newBtnId = `btn_${Date.now()}`;
                                        const updated = [...(localData.buttons || []), { id: newBtnId, text: `Option ${count + 1}` }];
                                        handleChange('buttons', updated);
                                    }}
                                >
                                    <FiPlus size={14} /> Add Button
                                </button>
                            ) : (
                                <p className="field-hint" style={{ color: '#ef4444', fontWeight: '500' }}>
                                    ⚠️ WhatsApp Interactive Reply Buttons support a maximum of 3 buttons. Use a List Message instead.
                                </p>
                            )}
                        </div>
                    </>
                )}

                {/* 4. Media + Button & 7. Media Caption */}
                {(selectedNode.type === 'media_button' || selectedNode.type === 'media_caption') && (
                    <>
                        <div className="form-group">
                            <label>Upload Media / Document File (PDF, Image, Video, Audio)</label>
                            <input type="file" onChange={handleFileUpload} />
                            {isUploading && <p className="field-hint">Uploading media file...</p>}
                            {localData.mediaUrl && (
                                <div className="file-preview-pill">
                                    <span>📁 {localData.mediaName || localData.mediaUrl} ({localData.mediaType || 'file'})</span>
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label>Caption</label>
                            <textarea
                                rows={4}
                                value={localData.caption || ''}
                                onChange={(e) => handleChange('caption', e.target.value)}
                                placeholder="Enter caption text..."
                            />
                        </div>
                        {selectedNode.type === 'media_button' && (
                            <div className="form-group">
                                <label>Interactive Buttons (Max 3 - Optional)</label>
                                {(localData.buttons || []).map((btn, idx) => (
                                    <div key={idx} className="array-item-row">
                                        <input
                                            type="text"
                                            placeholder={`Button ${idx + 1} Text`}
                                            value={btn.text || ''}
                                            onChange={(e) => {
                                                const updated = [...(localData.buttons || [])];
                                                updated[idx] = { ...updated[idx], text: e.target.value };
                                                handleChange('buttons', updated);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="danger-btn"
                                            onClick={() => {
                                                const deletedBtn = (localData.buttons || [])[idx];
                                                if (deletedBtn && deletedBtn.id) {
                                                    removeEdgeByHandle(selectedNode.id, `button-${deletedBtn.id}`);
                                                }
                                                const updated = (localData.buttons || []).filter((_, i) => i !== idx);
                                                handleChange('buttons', updated);
                                            }}
                                        >
                                            <FiTrash size={14} />
                                        </button>
                                    </div>
                                ))}
                                {(localData.buttons || []).length < 3 && (
                                    <button
                                        type="button"
                                        className="add-subitem-btn"
                                        onClick={() => {
                                            const count = (localData.buttons || []).length;
                                            const newBtnId = `btn_${Date.now()}`;
                                            const updated = [...(localData.buttons || []), { id: newBtnId, text: `Option ${count + 1}` }];
                                            handleChange('buttons', updated);
                                        }}
                                    >
                                        <FiPlus size={14} /> Add Button
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* 5. URL Button */}
                {selectedNode.type === 'url_button' && (
                    <>
                        <div className="form-group">
                            <label>Caption / Message</label>
                            <textarea
                                rows={3}
                                value={localData.caption || ''}
                                onChange={(e) => handleChange('caption', e.target.value)}
                                placeholder="Message above link button..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Button Label</label>
                            <input
                                type="text"
                                value={localData.buttonText || ''}
                                onChange={(e) => handleChange('buttonText', e.target.value)}
                                placeholder="e.g. Visit Our Website"
                            />
                        </div>
                        <div className="form-group">
                            <label>Target URL</label>
                            <input
                                type="url"
                                value={localData.url || ''}
                                onChange={(e) => handleChange('url', e.target.value)}
                                placeholder="https://yourwebsite.com"
                            />
                        </div>
                    </>
                )}

                {/* 6. List Message */}
                {selectedNode.type === 'list_message' && (
                    <>
                        <div className="form-group">
                            <label>Header (Optional)</label>
                            <input
                                type="text"
                                value={localData.header || ''}
                                onChange={(e) => handleChange('header', e.target.value)}
                                placeholder="List Title Header"
                            />
                        </div>
                        <div className="form-group">
                            <label>Body Message</label>
                            <textarea
                                rows={3}
                                value={localData.body || ''}
                                onChange={(e) => handleChange('body', e.target.value)}
                                placeholder="List body text..."
                            />
                        </div>
                        <div className="form-group">
                            <label>Menu Button Text</label>
                            <input
                                type="text"
                                value={localData.buttonText || ''}
                                onChange={(e) => handleChange('buttonText', e.target.value)}
                                placeholder="e.g. Select Option"
                            />
                        </div>
                    </>
                )}

                {/* 8. Request Location */}
                {selectedNode.type === 'request_location' && (
                    <div className="form-group">
                        <label>Prompt Message</label>
                        <textarea
                            rows={4}
                            value={localData.message || ''}
                            onChange={(e) => handleChange('message', e.target.value)}
                            placeholder="Please share your location pin on WhatsApp."
                        />
                    </div>
                )}

                {/* 9. WhatsApp Form */}
                {selectedNode.type === 'whatsapp_form' && (
                    <div className="form-group">
                        <label>Form Title &amp; Prompt</label>
                        <textarea
                            rows={3}
                            value={localData.message || ''}
                            onChange={(e) => handleChange('message', e.target.value)}
                            placeholder="Fill out form message..."
                        />
                    </div>
                )}

                {/* 10. Official Template */}
                {selectedNode.type === 'template' && (
                    <>
                        <div className="form-group">
                            <label>Select Meta Approved Template</label>
                            <select
                                value={localData.templateName || ''}
                                onChange={(e) => {
                                    try {
                                        const tName = e.target.value;
                                        console.log("Selected Template:", tName);
                                        const templatesList = Array.isArray(metaTemplates) ? metaTemplates : [];
                                        const selected = templatesList.find((t) => t?.name === tName);
                                        if (!selected) {
                                            handleChange('templateName', '');
                                            return;
                                        }

                                        // Safely extract template components (handles stringified JSON or arrays)
                                        let comps = selected?.components || [];
                                        if (typeof comps === 'string') {
                                            try { comps = JSON.parse(comps); } catch (pErr) { comps = []; }
                                        }
                                        if (!Array.isArray(comps)) comps = [];

                                        const bodyComp = comps.find(c => c?.type === 'BODY') || {};
                                        const headerComp = comps.find(c => c?.type === 'HEADER') || {};
                                        const footerComp = comps.find(c => c?.type === 'FOOTER') || {};
                                        const buttonComp = comps.find(c => c?.type === 'BUTTONS') || {};

                                        const bodyText = bodyComp?.text || '';
                                        const headerText = headerComp?.text || '';
                                        const footerText = footerComp?.text || '';

                                        // Extract variables {{1}}, {{2}}, etc.
                                        const varMatches = bodyText.match(/\{\{\d+\}\}/g) || [];
                                        const uniqueVars = Array.from(new Set(varMatches));

                                        // Extract buttons
                                        let parsedButtons = [];
                                        if (Array.isArray(buttonComp?.buttons)) {
                                            parsedButtons = buttonComp.buttons.map((b, bIdx) => ({
                                                id: `btn_${bIdx + 1}`,
                                                text: b?.text || b?.url || b?.phone_number || `Button ${bIdx + 1}`,
                                                type: b?.type || 'QUICK_REPLY',
                                                url: b?.url || null,
                                                phone: b?.phone_number || null
                                            }));
                                        }

                                        // If template has buttons, remove default source handle edge to prevent React Flow handle lookup crash
                                        if (parsedButtons.length > 0) {
                                            removeEdgeByHandle(selectedNode.id, null);
                                        }

                                        // Default variable mappings
                                        const initialVarMap = {};
                                        uniqueVars.forEach((v, idx) => {
                                            initialVarMap[v] = idx === 0 ? 'name' : (idx === 1 ? 'phone' : 'custom');
                                        });

                                        const updatedData = {
                                            ...localData,
                                            templateName: tName,
                                            languageCode: selected?.language || 'en_US',
                                            category: selected?.category || 'MARKETING',
                                            header: headerText,
                                            body: bodyText,
                                            footer: footerText,
                                            buttons: parsedButtons,
                                            variables: uniqueVars,
                                            variableMap: initialVarMap,
                                            customMediaUrl: null,
                                            carouselMedia: null
                                        };

                                        setLocalData(updatedData);
                                        updateNodeData(selectedNode.id, updatedData);
                                    } catch (err) {
                                        console.error('[NodeConfigPanel] Error selecting template:', err);
                                    }
                                }}
                            >
                                <option value="">Select Official Template</option>
                                {(Array.isArray(metaTemplates) ? metaTemplates : []).map((t, idx) => (
                                    <option key={idx} value={t.name}>
                                        {t.name} ({t.language} - {t.category || 'UTILITY'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {localData.templateName && (
                            <div className="template-preview-card">
                                <h4>Template Details</h4>
                                {localData.header && <p className="tpl-header"><strong>Header:</strong> {localData.header}</p>}
                                {localData.body && <p className="tpl-body"><strong>Body:</strong> {localData.body}</p>}
                                {localData.footer && <p className="tpl-footer"><small>{localData.footer}</small></p>}

                                {/* Media Header Upload if template has media/carousel */}
                                {(() => {
                                    const currentTpl = (Array.isArray(metaTemplates) ? metaTemplates : []).find(t => t?.name === localData.templateName);
                                    return isTemplateMediaHeader(currentTpl) ? (
                                        <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                                            <MediaHeaderUpload
                                                templateData={currentTpl}
                                                customPreview={localData.customMediaUrl || localData.mediaUrl}
                                                onMediaChange={(file, previewUrl, base64, carouselData) => {
                                                    const updated = {
                                                        ...localData,
                                                        customMediaUrl: previewUrl || base64 || null,
                                                        carouselMedia: carouselData || null
                                                    };
                                                    setLocalData(updated);
                                                    updateNodeData(selectedNode.id, updated);
                                                }}
                                            />
                                        </div>
                                    ) : null;
                                })()}

                                {/* Variable Mappings */}
                                {Array.isArray(localData.variables) && localData.variables.length > 0 && (
                                    <div className="variables-map-section">
                                        <label>Variable Mapping</label>
                                        {localData.variables.map((v) => (
                                            <div key={v} className="var-map-row">
                                                <span className="var-chip">{v}</span>
                                                <select
                                                    value={localData.variableMap?.[v] || 'name'}
                                                    onChange={(e) => {
                                                        const newMap = { ...(localData.variableMap || {}), [v]: e.target.value };
                                                        handleChange('variableMap', newMap);
                                                    }}
                                                >
                                                    <option value="name">Customer Name ({"{{name}}"})</option>
                                                    <option value="phone">Customer Phone ({"{{phone}}"})</option>
                                                    <option value="email">Customer Email ({"{{email}}"})</option>
                                                    <option value="order_id">Order ID</option>
                                                    <option value="custom">Custom Text</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* 11. Add To Group */}
                {selectedNode.type === 'add_group' && (
                    <div className="form-group">
                        <label>Select Group</label>
                        <select
                            value={localData.groupId || ''}
                            onChange={(e) => {
                                const gId = e.target.value;
                                const gObj = groupsList.find((g) => String(g.id) === String(gId));
                                handleChange('groupId', gId);
                                handleChange('groupName', gObj?.name || 'Selected Group');
                            }}
                        >
                            <option value="">Select Group</option>
                            {groupsList.map((g) => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* 12. Add Tag */}
                {selectedNode.type === 'add_tag' && (
                    <div className="form-group">
                        <label>Select Tag</label>
                        <select
                            value={localData.tagId || ''}
                            onChange={(e) => {
                                const tId = e.target.value;
                                const tObj = tagsList.find((t) => String(t.id) === String(tId));
                                handleChange('tagId', tId);
                                handleChange('tagName', tObj?.name || 'Selected Tag');
                            }}
                        >
                            <option value="">Select Tag</option>
                            {tagsList.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* 13. Push To Webhook */}
                {selectedNode.type === 'push_webhook' && (
                    <>
                        <div className="form-group">
                            <label>Method</label>
                            <select
                                value={localData.method || 'POST'}
                                onChange={(e) => handleChange('method', e.target.value)}
                            >
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Webhook Endpoint URL</label>
                            <input
                                type="url"
                                value={localData.webhookUrl || ''}
                                onChange={(e) => handleChange('webhookUrl', e.target.value)}
                                placeholder="https://api.yourdomain.com/webhook"
                            />
                        </div>
                        <div className="form-group">
                            <label>JSON Body Payload</label>
                            <textarea
                                rows={4}
                                value={localData.body || ''}
                                onChange={(e) => handleChange('body', e.target.value)}
                                placeholder='{"phone": "{{phone}}", "event": "lead"}'
                            />
                        </div>
                    </>
                )}

                {/* 14. Create Ticket */}
                {selectedNode.type === 'create_ticket' && (
                    <>
                        <div className="form-group">
                            <label>Department</label>
                            <input
                                type="text"
                                value={localData.department || 'Support'}
                                onChange={(e) => handleChange('department', e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Priority</label>
                            <select
                                value={localData.priority || 'Medium'}
                                onChange={(e) => handleChange('priority', e.target.value)}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                                <option value="Urgent">Urgent</option>
                            </select>
                        </div>
                    </>
                )}

                {/* 15. Connect To Agent */}
                {selectedNode.type === 'connect_agent' && (
                    <div className="form-group">
                        <label>Live Agent</label>
                        <input
                            type="text"
                            value={localData.agentName || 'Auto-assign available agent'}
                            onChange={(e) => handleChange('agentName', e.target.value)}
                        />
                    </div>
                )}

                {/* 16. Delay */}
                {selectedNode.type === 'delay' && (
                    <div className="delay-inputs-grid">
                        <div className="form-group">
                            <label>Hours</label>
                            <input
                                type="number"
                                min={0}
                                value={localData.hours || 0}
                                onChange={(e) => handleChange('hours', Number(e.target.value))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Minutes</label>
                            <input
                                type="number"
                                min={0}
                                value={localData.minutes || 0}
                                onChange={(e) => handleChange('minutes', Number(e.target.value))}
                            />
                        </div>
                        <div className="form-group">
                            <label>Seconds</label>
                            <input
                                type="number"
                                min={0}
                                value={localData.seconds || 5}
                                onChange={(e) => handleChange('seconds', Number(e.target.value))}
                            />
                        </div>
                    </div>
                )}

                {/* 17. Condition */}
                {selectedNode.type === 'condition' && (
                    <>
                        <div className="form-group">
                            <label>Compare Variable</label>
                            <input
                                type="text"
                                value={localData.variable || 'message'}
                                onChange={(e) => handleChange('variable', e.target.value)}
                                placeholder="message or variable name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Operator</label>
                            <select
                                value={localData.operator || 'equals'}
                                onChange={(e) => handleChange('operator', e.target.value)}
                            >
                                <option value="equals">Equals</option>
                                <option value="contains">Contains</option>
                                <option value="starts_with">Starts With</option>
                                <option value="ends_with">Ends With</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Expected Value</label>
                            <input
                                type="text"
                                value={localData.value || ''}
                                onChange={(e) => handleChange('value', e.target.value)}
                                placeholder="e.g. yes or 1"
                            />
                        </div>
                    </>
                )}

                {/* 18. End Flow */}
                {selectedNode.type === 'end_flow' && (
                    <div className="form-group">
                        <p className="field-hint" style={{ color: '#ef4444' }}>
                            This node stops the chatbot execution for the customer. No further nodes will be processed.
                        </p>
                    </div>
                )}
            </div>
        </aside>
    );
}
