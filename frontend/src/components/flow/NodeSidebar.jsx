import React from 'react';
import {
    FiPlay, FiMessageSquare, FiGrid, FiImage, FiLink, FiList,
    FiMapPin, FiFileText, FiLayout, FiUsers, FiTag, FiSend,
    FiTag as FiTicket, FiUserCheck, FiClock, FiGitBranch, FiPower
} from 'react-icons/fi';
import { useFlowStore } from '../../store/useFlowStore.js';

const NODE_CATEGORIES = [
    {
        category: 'Triggers & Messaging',
        items: [
            { type: 'starting_keyword', label: 'Starting Keyword', icon: FiPlay, color: '#10b981' },
            { type: 'text_reply', label: 'Text Reply', icon: FiMessageSquare, color: '#3b82f6' },
            { type: 'text_button', label: 'Text + Button', icon: FiGrid, color: '#6366f1' },
            { type: 'media_button', label: 'Media + Button', icon: FiImage, color: '#8b5cf6' },
            { type: 'url_button', label: 'URL Button', icon: FiLink, color: '#06b6d4' },
            { type: 'list_message', label: 'Text + List', icon: FiList, color: '#f59e0b' },
            { type: 'media_caption', label: 'Media Caption', icon: FiImage, color: '#d946ef' },
            { type: 'request_location', label: 'Request Location', icon: FiMapPin, color: '#f97316' },
            { type: 'template', label: 'Official Template', icon: FiLayout, color: '#6366f1' },
        ]
    }
];

export default function NodeSidebar() {
    const addNode = useFlowStore((state) => state.addNode);
    const onDragStart = (event, nodeType, label) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow-label', label);
        event.dataTransfer.effectAllowed = 'move';
    };

    // Touch screens cannot reliably use HTML5 drag/drop. Tapping a card adds it
    // near the visible canvas center; desktop drag/drop continues to work.
    const handleCardClick = (nodeType, label) => {
        if (!window.matchMedia('(pointer: coarse), (max-width: 768px)').matches) return;
        addNode({
            id: `node_${Date.now()}`,
            type: nodeType,
            position: { x: 80 + Math.round(Math.random() * 80), y: 100 + Math.round(Math.random() * 120) },
            data: { label, message: '', keywords: [], buttons: [{ id: 'btn_1', text: 'Option 1' }] }
        });
    };

    return (
        <aside className="flow-sidebar">
            <div className="sidebar-header">
                <h3>Flow Nodes</h3>
                <p>Drag nodes onto the canvas</p>
            </div>

            <div className="sidebar-scroll">
                {NODE_CATEGORIES.map((cat, idx) => (
                    <div key={idx} className="category-group">
                        <h4 className="category-title">{cat.category}</h4>
                        <div className="nodes-grid">
                            {cat.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.type}
                                        className="draggable-node-card"
                                        draggable
                                        onDragStart={(e) => onDragStart(e, item.type, item.label)}
                                        onClick={() => handleCardClick(item.type, item.label)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(item.type, item.label); }}
                                    >
                                        <div className="node-card-icon" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                                            <Icon size={18} />
                                        </div>
                                        <span className="node-card-label">{item.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
}
