import React, { useCallback, useEffect } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import { useFlowStore } from '../../store/useFlowStore.js'

// WhatsApp list message limits
const MAX_ITEMS = 10
const MAX_ITEM_LEN = 24
const MAX_MESSAGE_LEN = 1024

const styles = `
.ln-node {
    width: 236px;
    background: #34c26e;
    border: 2px solid #2aa85c;
    border-radius: 10px;
    padding: 0 6px 8px 6px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
    font-family: inherit;
    box-sizing: content-box;
}
.ln-node.ln-selected {
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.55), 0 2px 8px rgba(15, 23, 42, 0.18);
}

/* ---------- Header (same layout as the other nodes) ---------- */
.ln-node .ln-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 -6px 8px -6px;
    padding: 7px 8px;
    background: #1f9d55;
    border-radius: 8px 8px 0 0;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
}
.ln-node .ln-header-title {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ln-node .ln-icon-btn {
    width: 20px;
    height: 20px;
    padding: 0 !important;
    margin: 0;
    border: none !important;
    border-radius: 4px !important;
    background: rgba(255, 255, 255, 0.25) !important;
    color: #ffffff !important;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: none !important;
}
.ln-node .ln-icon-btn:hover {
    background: rgba(255, 255, 255, 0.45) !important;
}

/* ---------- Message box ---------- */
.ln-node .ln-msg-wrap {
    position: relative;
    margin-bottom: 8px;
}
.ln-node .ln-msg {
    display: block;
    width: 100% !important;
    box-sizing: border-box !important;
    height: 88px !important;
    min-height: 88px !important;
    resize: none !important;
    border: 1px solid #d1d5db !important;
    border-radius: 4px !important;
    background: #ffffff !important;
    color: #111827 !important;
    padding: 6px 8px 18px 8px !important;
    font-size: 12.5px !important;
    line-height: 1.35 !important;
    outline: none !important;
    box-shadow: none !important;
    font-family: inherit;
}
.ln-node .ln-msg:focus {
    border-color: #0f766e !important;
}
.ln-node .ln-count {
    position: absolute;
    right: 8px;
    bottom: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    pointer-events: none;
}
.ln-node .ln-count.ln-count-warn {
    color: #dc2626;
}

/* ---------- List item rows ---------- */
.ln-node .ln-row {
    position: relative;
    height: 28px;
    margin-bottom: 6px;
}
.ln-node .ln-input {
    display: block;
    width: calc(100% - 52px) !important;
    height: 28px !important;
    box-sizing: border-box !important;
    border: 1px solid #d1d5db !important;
    border-radius: 4px !important;
    background: #ffffff !important;
    color: #111827 !important;
    padding: 0 8px !important;
    margin: 0 !important;
    font-size: 12.5px !important;
    line-height: 26px !important;
    outline: none !important;
    box-shadow: none !important;
    font-family: inherit;
}
.ln-node .ln-input:focus {
    border-color: #0f766e !important;
}
.ln-node .ln-del {
    display: none;
    position: absolute;
    top: 0;
    right: 0;
    width: 50px;
    height: 28px;
    padding: 0 !important;
    margin: 0;
    border: none !important;
    border-radius: 0 4px 4px 0 !important;
    background: #ef0000 !important;
    color: #ffffff !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    cursor: pointer;
    box-shadow: none !important;
}
.ln-node .ln-row:hover .ln-del,
.ln-node .ln-row:focus-within .ln-del {
    display: block;
}
.ln-node .ln-row:hover .ln-input,
.ln-node .ln-row:focus-within .ln-input {
    border-radius: 4px 0 0 4px !important;
    width: calc(100% - 50px) !important;
}

/* ---------- Add button ---------- */
.ln-node .ln-add-wrap {
    display: flex;
    justify-content: center;
    margin-top: 2px;
}
.ln-node .ln-add {
    border: none !important;
    background: #1aa5a0 !important;
    color: #ffffff !important;
    font-size: 12.5px !important;
    font-weight: 700 !important;
    padding: 6px 22px !important;
    border-radius: 6px !important;
    cursor: pointer;
    box-shadow: none !important;
}
.ln-node .ln-add:hover {
    background: #148f8a !important;
}
.ln-node .ln-add:disabled {
    background: #94a3b8 !important;
    cursor: not-allowed;
}

/* ---------- Connection dots ---------- */
/* Top / bottom dots: same look as the other nodes */
.ln-node .ln-handle-main {
    width: 10px !important;
    height: 10px !important;
    background: #4f46e5 !important;
    border: 2px solid #ffffff !important;
}
/* Left dot and one dot per list item on the right */
.ln-node .ln-handle-item {
    width: 11px !important;
    height: 11px !important;
    background: #ffffff !important;
    border: 1.5px solid #64748b !important;
}
`

function IconList() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
    )
}

function IconCopy() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    )
}

function IconTrash() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
    )
}

export default function ListNode({ id, data, selected }) {
    const updateNodeInternals = useUpdateNodeInternals()

    const items = Array.isArray(data?.buttons) ? data.buttons : []
    const message = data?.message || data?.body || ''

    // Handle positions change when rows are added or removed
    useEffect(() => {
        updateNodeInternals(id)
    }, [id, items.length, updateNodeInternals])

    // Merge a patch into this node's data directly in the flow store
    const patchData = useCallback(
        (patch) => {
            useFlowStore.setState((s) => {
                const merge = (n) => (n.id === id ? { ...n, data: { ...(n.data || {}), ...patch } } : n)
                const next = { nodes: s.nodes.map(merge) }
                if (s.selectedNode && s.selectedNode.id === id) {
                    next.selectedNode = merge(s.selectedNode)
                }
                return next
            })
        },
        [id]
    )

    const getItems = useCallback(() => {
        const node = useFlowStore.getState().nodes.find((n) => n.id === id)
        return Array.isArray(node?.data?.buttons) ? node.data.buttons : []
    }, [id])

    const setMessage = (value) => patchData({ message: value, body: value })

    const setItemText = (itemId, text) => {
        patchData({ buttons: getItems().map((it) => (it.id === itemId ? { ...it, text } : it)) })
    }

    const addItem = () => {
        const current = getItems()
        if (current.length >= MAX_ITEMS) return
        patchData({
            buttons: [...current, { id: `btn_${Date.now()}`, text: `Option ${current.length + 1}` }]
        })
    }

    const removeItem = (itemId) => {
        const current = getItems()
        if (current.length <= 1) return
        // Remove the connection that started from this row, then the row itself
        useFlowStore.setState((s) => ({
            edges: s.edges.filter((e) => !(e.source === id && e.sourceHandle === itemId))
        }))
        patchData({ buttons: current.filter((it) => it.id !== itemId) })
    }

    const duplicateNode = () => {
        const self = useFlowStore.getState().nodes.find((n) => n.id === id)
        if (!self) return
        // eslint-disable-next-line no-unused-vars
        const { measured, dragging, ...rest } = self
        const copy = {
            ...rest,
            id: `node_${Date.now()}`,
            selected: false,
            position: { x: (self.position?.x || 0) + 40, y: (self.position?.y || 0) + 40 },
            data: JSON.parse(JSON.stringify(self.data || {}))
        }
        useFlowStore.setState((s) => ({ nodes: [...s.nodes, copy] }))
    }

    const deleteNode = () => {
        useFlowStore.setState((s) => ({
            nodes: s.nodes.filter((n) => n.id !== id),
            edges: s.edges.filter((e) => e.source !== id && e.target !== id),
            selectedNode: s.selectedNode && s.selectedNode.id === id ? null : s.selectedNode
        }))
    }

    return (
        <div className={`ln-node${selected ? ' ln-selected' : ''}`}>
            <style>{styles}</style>

            {/* Top: incoming connection (default input, same as other nodes) */}
            <Handle type="target" position={Position.Top} className="ln-handle-main" />
            {/* Left: extra incoming connection */}
            <Handle type="target" position={Position.Left} id="left" className="ln-handle-item" />

            <div className="ln-header">
                <IconList />
                <span className="ln-header-title">↓ [Text + List]</span>
                <button type="button" className="ln-icon-btn nodrag" title="Duplicate node" onClick={duplicateNode}>
                    <IconCopy />
                </button>
                <button type="button" className="ln-icon-btn nodrag" title="Delete node" onClick={deleteNode}>
                    <IconTrash />
                </button>
            </div>

            <div className="ln-msg-wrap">
                <textarea
                    className="ln-msg nodrag nowheel"
                    value={message}
                    placeholder="Type your message here..."
                    maxLength={MAX_MESSAGE_LEN}
                    onChange={(e) => setMessage(e.target.value)}
                />
                <span className={`ln-count${message.length > MAX_MESSAGE_LEN - 50 ? ' ln-count-warn' : ''}`}>
                    {message.length}/{MAX_MESSAGE_LEN}
                </span>
            </div>

            {items.map((item) => (
                <div key={item.id} className="ln-row">
                    <input
                        type="text"
                        className="ln-input nodrag"
                        value={item.text || ''}
                        placeholder="List item"
                        maxLength={MAX_ITEM_LEN}
                        onChange={(e) => setItemText(item.id, e.target.value)}
                    />
                    {items.length > 1 && (
                        <button type="button" className="ln-del nodrag" onClick={() => removeItem(item.id)}>
                            Delete
                        </button>
                    )}

                    {/* One outgoing connection per list item */}
                    <Handle
                        type="source"
                        position={Position.Right}
                        id={item.id}
                        className="ln-handle-item"
                        style={{ right: -8 }}
                    />
                </div>
            ))}

            <div className="ln-add-wrap">
                <button
                    type="button"
                    className="ln-add nodrag"
                    onClick={addItem}
                    disabled={items.length >= MAX_ITEMS}
                    title={items.length >= MAX_ITEMS ? `Maximum ${MAX_ITEMS} items` : 'Add list item'}
                >
                    Add
                </button>
            </div>

            {/* Bottom: default outgoing connection (same as other nodes) */}
            <Handle type="source" position={Position.Bottom} className="ln-handle-main" />
        </div>
    )
}