import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useFlowStore } from '../../store/useFlowStore.js';
import {
    FiPlay, FiMessageSquare, FiGrid, FiImage, FiLink, FiList,
    FiMapPin, FiFileText, FiLayout, FiUsers, FiTag, FiSend,
    FiTag as FiTicket, FiUserCheck, FiClock, FiGitBranch, FiPower,
    FiCopy, FiTrash2
} from 'react-icons/fi';

const BaseNodeWrapper = memo(({ id, selected, title, icon: Icon, headerBg, children, handles = { target: true, source: true }, sourceHandles = [] }) => {
    const duplicateNode = useFlowStore((state) => state.duplicateNode);
    const deleteNode = useFlowStore((state) => state.deleteNode);

    return (
        <div className={`custom-flow-node ${selected ? 'selected' : ''}`}>
            {handles.target && (
                <Handle
                    type="target"
                    position={Position.Top}
                    className="flow-handle target-handle"
                />
            )}

            <div className="node-header" style={{ background: headerBg }}>
                <div className="node-title-group">
                    {Icon && <Icon className="node-icon" />}
                    <span className="node-title">{title}</span>
                </div>
                {title !== 'Starting Keyword' && (
                    <div className="node-actions nodrag">
                        <button
                            type="button"
                            className="node-action-btn"
                            title="Duplicate"
                            onClick={(e) => { e.stopPropagation(); duplicateNode(id); }}
                        >
                            <FiCopy size={12} />
                        </button>
                        <button
                            type="button"
                            className="node-action-btn delete"
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); deleteNode(id); }}
                        >
                            <FiTrash2 size={12} />
                        </button>
                    </div>
                )}
            </div>

            <div className="node-body">{children}</div>

            {handles.source && sourceHandles.length === 0 && (
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="flow-handle source-handle"
                />
            )}

            {sourceHandles.map((h) => (
                <Handle
                    key={h.id}
                    type="source"
                    position={h.position || Position.Bottom}
                    id={h.id}
                    className={`flow-handle source-handle ${h.className || ''}`}
                    style={h.style}
                >
                    {h.label && <span className="handle-label">{h.label}</span>}
                </Handle>
            ))}
        </div>
    );
});

// 1. Starting Keyword Node
export const StartingKeywordNode = memo(({ id, data, selected }) => {
    const kwList = Array.isArray(data.keywords) ? data.keywords.filter(Boolean) : [];
    return (
        <BaseNodeWrapper id={id} selected={selected} title="Starting Keyword" icon={FiPlay} headerBg="linear-gradient(135deg, #059669 0%, #10b981 100%)" handles={{ target: false, source: true }}>
            <div className="node-preview">
                <span className="preview-label">Keywords:</span>
                <div className="kw-tags">
                    {kwList.length > 0 ? (
                        kwList.map((kw, idx) => (
                            <span key={idx} className="kw-badge">{kw}</span>
                        ))
                    ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Click to configure keywords...</span>
                    )}
                </div>
            </div>
        </BaseNodeWrapper>
    );
});

// 2. Text Reply Node
export const TextReplyNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Text Reply" icon={FiMessageSquare} headerBg="linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)">
        <div className="node-preview">
            <p className="node-text">{data.message || 'Enter text message reply...'}</p>
        </div>
    </BaseNodeWrapper>
));

// 3. Text + Button Node (Per-Button Dynamic Handles)
export const TextButtonNode = memo(({ id, data, selected }) => {
    const rawBtns = Array.isArray(data.buttons) && data.buttons.length > 0
        ? data.buttons
        : [{ id: 'btn_1', text: 'Option 1' }, { id: 'btn_2', text: 'Option 2' }];

    return (
        <BaseNodeWrapper
            id={id}
            selected={selected}
            title="Text + Button"
            icon={FiGrid}
            headerBg="linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
            handles={{ target: true, source: false }} // Disable single default source handle
        >
            <div className="node-preview">
                <p className="node-text">{data.message || 'Interactive Button Message'}</p>
                <div className="per-button-handles-wrapper">
                    {rawBtns.map((btn, idx) => {
                        const btnId = btn.id || `btn_${idx + 1}`;
                        const handleId = `button-${btnId}`;
                        return (
                            <div key={btnId} className="per-button-item">
                                <span className="btn-pill-text">🔘 {btn.text || `Option ${idx + 1}`}</span>
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={handleId}
                                    className="flow-handle button-per-item-handle"
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </BaseNodeWrapper>
    );
});

// 4. Media + Button Node (Media preview & optional per-button handles)
export const MediaButtonNode = memo(({ id, data, selected }) => {
    const rawBtns = Array.isArray(data.buttons) && data.buttons.length > 0 ? data.buttons : [];
    const hasButtons = rawBtns.length > 0;
    const hasMedia = Boolean(data.mediaUrl || data.file || data.fileUrl || data.mediaName);
    const fileName = data.mediaName || (data.mediaUrl ? data.mediaUrl.split('/').pop() : null);
    const rawType = (data.mediaType || data.fileType || '').toLowerCase();
    const typeLabel = rawType === 'document' || rawType === 'application' || (fileName && fileName.endsWith('.pdf')) ? 'Document' : (rawType === 'video' ? 'Video' : (rawType === 'audio' ? 'Audio' : 'Image'));

    return (
        <BaseNodeWrapper
            id={id}
            selected={selected}
            title="Media + Button"
            icon={FiImage}
            headerBg="linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)"
            handles={{ target: true, source: !hasButtons }}
        >
            <div className="node-preview">
                <span className="media-badge">
                    {hasMedia ? `📎 ${typeLabel}: ${fileName || 'Attached'}` : '⚠️ No Media Selected'}
                </span>
                <p className="node-text">{data.caption || data.message || 'Caption text...'}</p>
                {hasButtons && (
                    <div className="per-button-handles-wrapper">
                        {rawBtns.map((btn, idx) => {
                            const btnId = btn.id || `btn_${idx + 1}`;
                            const handleId = `button-${btnId}`;
                            return (
                                <div key={btnId} className="per-button-item">
                                    <span className="btn-pill-text">🔘 {btn.text || `Option ${idx + 1}`}</span>
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={handleId}
                                        className="flow-handle button-per-item-handle"
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </BaseNodeWrapper>
    );
});

// 5. URL Button Node
export const UrlButtonNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="URL Button" icon={FiLink} headerBg="linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)">
        <div className="node-preview">
            <p className="node-text">{data.caption || 'Visit Website'}</p>
            <div className="node-url-pill">🔗 {data.url || 'https://example.com'}</div>
        </div>
    </BaseNodeWrapper>
));

// 6. List Message Node
export const ListMessageNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Text + List" icon={FiList} headerBg="linear-gradient(135deg, #d97706 0%, #f59e0b 100%)">
        <div className="node-preview">
            <p className="node-text"><strong>{data.header || 'Header'}</strong></p>
            <p className="node-text">{data.body || 'Select an item from the menu...'}</p>
            <div className="node-btn-pill">📋 {data.buttonText || 'View Menu'}</div>
        </div>
    </BaseNodeWrapper>
));

// 7. Media Caption Node
export const MediaCaptionNode = memo(({ id, data, selected }) => {
    const hasMedia = Boolean(data.mediaUrl || data.file || data.fileUrl || data.mediaName);
    const fileName = data.mediaName || (data.mediaUrl ? data.mediaUrl.split('/').pop() : null);
    const rawType = (data.mediaType || data.fileType || '').toLowerCase();
    const typeLabel = rawType === 'document' || rawType === 'application' || (fileName && fileName.endsWith('.pdf')) ? 'Document' : (rawType === 'video' ? 'Video' : (rawType === 'audio' ? 'Audio' : 'Image'));

    return (
        <BaseNodeWrapper id={id} selected={selected} title="Media Caption" icon={FiImage} headerBg="linear-gradient(135deg, #c026d3 0%, #d946ef 100%)">
            <div className="node-preview">
                <span className="media-badge">
                    {hasMedia ? `📎 ${typeLabel}: ${fileName || 'Attached'}` : '⚠️ No Media Selected'}
                </span>
                <p className="node-text">{data.caption || data.message || 'Media caption text...'}</p>
            </div>
        </BaseNodeWrapper>
    );
});

// 8. Request Location Node
export const RequestLocationNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Request Location" icon={FiMapPin} headerBg="linear-gradient(135deg, #ea580c 0%, #f97316 100%)">
        <div className="node-preview">
            <p className="node-text">📍 {data.message || 'Ask customer to share live or pinned location.'}</p>
        </div>
    </BaseNodeWrapper>
));

// 9. WhatsApp Form Node
export const WhatsappFormNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="WhatsApp Form" icon={FiFileText} headerBg="linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)">
        <div className="node-preview">
            <span className="media-badge">📝 Form Builder</span>
            <p className="node-text">Fields: {(data.fields || []).length || 0} inputs</p>
        </div>
    </BaseNodeWrapper>
));

// 10. Official Template Node (Per-Button Dynamic Handles & Variables Preview)
export const TemplateNode = memo(({ id, data, selected }) => {
    const rawBtns = Array.isArray(data.buttons) ? data.buttons : [];
    const hasButtons = rawBtns.length > 0;

    return (
        <BaseNodeWrapper
            id={id}
            selected={selected}
            title="Official Template"
            icon={FiLayout}
            headerBg="linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
            handles={{ target: true, source: !hasButtons }} // If buttons exist, use per-button handles
        >
            <div className="node-preview">
                <div className="template-meta-header">
                    <span className="media-badge">⚡ {data.templateName || 'Select Meta Template'}</span>
                    <span className="lang-badge">{data.languageCode || 'en_US'}</span>
                </div>
                {data.body && (
                    <p className="template-body-preview">{data.body}</p>
                )}
                {hasButtons && (
                    <div className="per-button-handles-wrapper">
                        {rawBtns.map((btn, idx) => {
                            const btnId = btn.id || `tpl_btn_${idx + 1}`;
                            const handleId = `template-btn-${btnId}`;
                            return (
                                <div key={btnId} className="per-button-item">
                                    <span className="btn-pill-text">⚡ {btn.text || btn.title || `Button ${idx + 1}`}</span>
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={handleId}
                                        className="flow-handle button-per-item-handle"
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </BaseNodeWrapper>
    );
});

// 11. Add To Group Node
export const AddGroupNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Add To Group" icon={FiUsers} headerBg="linear-gradient(135deg, #16a34a 0%, #22c55e 100%)">
        <div className="node-preview">
            <p className="node-text">👥 Group: {data.groupName || 'Select Group'}</p>
        </div>
    </BaseNodeWrapper>
));

// 12. Add Tag Node
export const AddTagNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Add Tag" icon={FiTag} headerBg="linear-gradient(135deg, #ca8a04 0%, #eab308 100%)">
        <div className="node-preview">
            <p className="node-text">🏷️ Tag: {data.tagName || 'Select Tag'}</p>
        </div>
    </BaseNodeWrapper>
));

// 13. Push To Webhook Node
export const PushWebhookNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Push To Webhook" icon={FiSend} headerBg="linear-gradient(135deg, #475569 0%, #64748b 100%)">
        <div className="node-preview">
            <span className="media-badge">{data.method || 'POST'}</span>
            <p className="node-text node-url">{data.webhookUrl || 'https://api.example.com/webhook'}</p>
        </div>
    </BaseNodeWrapper>
));

// 14. Create Ticket Node
export const CreateTicketNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Create Ticket" icon={FiTicket} headerBg="linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)">
        <div className="node-preview">
            <p className="node-text">🎫 Dept: {data.department || 'Support'}</p>
            <span className="media-badge">Priority: {data.priority || 'Medium'}</span>
        </div>
    </BaseNodeWrapper>
));

// 15. Connect To Agent Node
export const ConnectAgentNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Connect To Agent" icon={FiUserCheck} headerBg="linear-gradient(135deg, #9333ea 0%, #a855f7 100%)">
        <div className="node-preview">
            <p className="node-text">👤 Agent: {data.agentName || 'Auto-assign'}</p>
        </div>
    </BaseNodeWrapper>
));

// 16. Delay Node
export const DelayNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="Delay" icon={FiClock} headerBg="linear-gradient(135deg, #d97706 0%, #f59e0b 100%)">
        <div className="node-preview">
            <p className="node-text">⏳ Wait: {data.hours || 0}h {data.minutes || 0}m {data.seconds || 5}s</p>
        </div>
    </BaseNodeWrapper>
));

// 17. Condition Node (IF / ELSE Handles)
export const ConditionNode = memo(({ id, data, selected }) => (
    <BaseNodeWrapper
        id={id}
        selected={selected}
        title="Condition"
        icon={FiGitBranch}
        headerBg="linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
        handles={{ target: true, source: false }}
        sourceHandles={[
            { id: 'true', position: Position.Bottom, style: { left: '30%', background: '#10b981' }, label: 'IF' },
            { id: 'false', position: Position.Bottom, style: { left: '70%', background: '#ef4444' }, label: 'ELSE' }
        ]}
    >
        <div className="node-preview">
            <p className="node-text">If <strong>{data.variable || 'message'}</strong> {data.operator || 'equals'} "{data.value || ''}"</p>
        </div>
    </BaseNodeWrapper>
));

// 18. End Flow Node
export const EndFlowNode = memo(({ id, selected }) => (
    <BaseNodeWrapper id={id} selected={selected} title="End Flow" icon={FiPower} headerBg="linear-gradient(135deg, #dc2626 0%, #ef4444 100%)" handles={{ target: true, source: false }}>
        <div className="node-preview">
            <p className="node-text" style={{ color: '#ef4444', fontWeight: '600' }}>🛑 Stop Chatbot Execution</p>
        </div>
    </BaseNodeWrapper>
));

// Node Types Map for React Flow
export const nodeTypes = {
    starting_keyword: StartingKeywordNode,
    text_reply: TextReplyNode,
    text_button: TextButtonNode,
    media_button: MediaButtonNode,
    url_button: UrlButtonNode,
    list_message: ListMessageNode,
    media_caption: MediaCaptionNode,
    request_location: RequestLocationNode,
    whatsapp_form: WhatsappFormNode,
    template: TemplateNode,
    add_group: AddGroupNode,
    add_tag: AddTagNode,
    push_webhook: PushWebhookNode,
    create_ticket: CreateTicketNode,
    connect_agent: ConnectAgentNode,
    delay: DelayNode,
    condition: ConditionNode,
    end_flow: EndFlowNode
};
