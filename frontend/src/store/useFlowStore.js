import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';
import api from '../services/api.js';

export const useFlowStore = create((set, get) => ({
    flowId: null,
    flowName: 'My WhatsApp Chatbot',
    flowDescription: '',
    status: 'active',
    keywords: [],

    nodes: [],
    edges: [],
    selectedNode: null,

    isSaving: false,
    saveMessage: '',
    errorMessage: '',

    // Undo / Redo stacks
    history: [],
    future: [],

    // Initialize/load flow
    setFlow: (flowData) => {
        const startNode = (flowData.nodes || []).find(n => n.type === 'starting_keyword');
        const nodeKw = startNode?.data?.keywords;
        const finalKw = Array.isArray(nodeKw) ? nodeKw : (Array.isArray(flowData.keywords) ? flowData.keywords : []);

        set({
            flowId: flowData.id || null,
            flowName: flowData.name || 'My WhatsApp Chatbot',
            flowDescription: flowData.description || '',
            status: flowData.status || 'active',
            keywords: finalKw,
            nodes: flowData.nodes || [],
            edges: flowData.edges || [],
            selectedNode: null,
            history: [],
            future: []
        });
    },

    setFlowName: (name) => set({ flowName: name }),

    // React Flow handlers
    onNodesChange: (changes) => {
        set({
            nodes: applyNodeChanges(changes, get().nodes)
        });
    },

    onEdgesChange: (changes) => {
        set({
            edges: applyEdgeChanges(changes, get().edges)
        });
    },

    onConnect: (connection) => {
        const edge = {
            ...connection,
            animated: true,
            style: { stroke: '#4f46e5', strokeWidth: 2 }
        };
        get().recordSnapshot();
        set({
            edges: addEdge(edge, get().edges)
        });
    },

    setSelectedNode: (node) => set({ selectedNode: node }),

    // Snapshot for Undo / Redo
    recordSnapshot: () => {
        const currentSnap = {
            nodes: JSON.parse(JSON.stringify(get().nodes)),
            edges: JSON.parse(JSON.stringify(get().edges))
        };
        set({
            history: [...get().history, currentSnap],
            future: []
        });
    },

    undo: () => {
        const { history, future, nodes, edges } = get();
        if (history.length === 0) return;

        const previous = history[history.length - 1];
        const newHistory = history.slice(0, history.length - 1);
        const currentSnap = { nodes, edges };

        set({
            nodes: previous.nodes,
            edges: previous.edges,
            history: newHistory,
            future: [currentSnap, ...future],
            selectedNode: null
        });
    },

    redo: () => {
        const { history, future, nodes, edges } = get();
        if (future.length === 0) return;

        const next = future[0];
        const newFuture = future.slice(1);
        const currentSnap = { nodes, edges };

        set({
            nodes: next.nodes,
            edges: next.edges,
            history: [...history, currentSnap],
            future: newFuture,
            selectedNode: null
        });
    },

    // Node operations
    addNode: (newNode) => {
        get().recordSnapshot();
        set({
            nodes: [...get().nodes, newNode],
            selectedNode: newNode
        });
    },

    updateNodeData: (nodeId, newData) => {
        get().recordSnapshot();
        const targetNode = get().nodes.find(n => n.id === nodeId);
        const nodeType = targetNode?.type;

        const updatedNodes = get().nodes.map((node) => {
            if (node.id === nodeId) {
                return {
                    ...node,
                    data: { ...node.data, ...newData }
                };
            }
            return node;
        });

        // Filter out edges attached to source handles that no longer exist on this node
        let updatedEdges = get().edges;
        if (newData.buttons && Array.isArray(newData.buttons)) {
            const isTemplate = nodeType === 'template';
            const isTextButton = nodeType === 'text_button';

            if (isTemplate || isTextButton) {
                const validHandles = new Set(
                    newData.buttons.map(b => isTemplate ? `template-btn-${b.id}` : `button-${b.id}`)
                );
                // If template has 0 buttons, default handle (sourceHandle: null / undefined) is valid
                if (isTemplate && newData.buttons.length === 0) {
                    validHandles.add(null);
                    validHandles.add(undefined);
                }

                updatedEdges = updatedEdges.filter(edge => {
                    if (edge.source === nodeId) {
                        return validHandles.has(edge.sourceHandle);
                    }
                    return true;
                });
            }
        }

        const updatedSelected = get().selectedNode?.id === nodeId
            ? { ...get().selectedNode, data: { ...get().selectedNode.data, ...newData } }
            : get().selectedNode;

        const isStartNode = nodeType === 'starting_keyword';

        set({
            nodes: updatedNodes,
            edges: updatedEdges,
            selectedNode: updatedSelected,
            ...(isStartNode && Array.isArray(newData.keywords) ? { keywords: newData.keywords } : {})
        });
    },

    removeEdgeByHandle: (nodeId, handleId) => {
        get().recordSnapshot();
        set({
            edges: get().edges.filter((e) => !(e.source === nodeId && e.sourceHandle === handleId))
        });
    },

    duplicateNode: (nodeId) => {
        get().recordSnapshot();
        const targetNode = get().nodes.find((n) => n.id === nodeId);
        if (!targetNode) return;

        const newId = `node_${Date.now()}`;
        const newNode = {
            ...JSON.parse(JSON.stringify(targetNode)),
            id: newId,
            position: {
                x: targetNode.position.x + 40,
                y: targetNode.position.y + 40
            }
        };

        set({
            nodes: [...get().nodes, newNode],
            selectedNode: newNode
        });
    },

    deleteNode: (nodeId) => {
        get().recordSnapshot();
        set({
            nodes: get().nodes.filter((n) => n.id !== nodeId),
            edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
            selectedNode: get().selectedNode?.id === nodeId ? null : get().selectedNode
        });
    },

    clearFlow: () => {
        get().recordSnapshot();
        const startNode = get().nodes.find((n) => n.type === 'starting_keyword') || {
            id: 'node_start_1',
            type: 'starting_keyword',
            position: { x: 250, y: 100 },
            data: { keywords: [], description: 'Trigger flow on matching keyword' }
        };
        set({
            nodes: [{ ...startNode, data: { ...startNode.data, keywords: [] } }],
            edges: [],
            selectedNode: null,
            keywords: []
        });
    },

    viewport: { x: 0, y: 0, zoom: 1 },
    setViewport: (viewport) => set({ viewport }),

    // Backend save
    saveFlow: async (navigate) => {
        const { flowId, flowName, flowDescription, status, nodes, edges, keywords, viewport } = get();
        set({ isSaving: true, saveMessage: '', errorMessage: '' });

        // Dynamically obtain keywords exclusively from starting_keyword node
        const startNode = nodes.find(n => n.type === 'starting_keyword');
        const effectiveKeywords = (startNode?.data?.keywords && Array.isArray(startNode.data.keywords))
            ? startNode.data.keywords.map(k => String(k).trim()).filter(Boolean)
            : (Array.isArray(keywords) ? keywords.map(k => String(k).trim()).filter(Boolean) : []);

        // Ensure starting node's data has the exact sanitized keywords array
        const sanitizedNodes = nodes.map(n => {
            if (n.type === 'starting_keyword') {
                return {
                    ...n,
                    data: {
                        ...n.data,
                        keywords: effectiveKeywords
                    }
                };
            }
            return n;
        });

        try {
            if (flowId && flowId !== 'new') {
                const res = await api.put(`/chatbot/flow/${flowId}`, {
                    name: flowName,
                    description: flowDescription,
                    status,
                    nodes: sanitizedNodes,
                    edges,
                    keywords: effectiveKeywords,
                    viewport
                });
                if (res.data?.flowName) {
                    set({ flowName: res.data.flowName });
                }
                const msg = res.data?.message || 'Flow saved successfully!';
                set({ nodes: sanitizedNodes, keywords: effectiveKeywords, isSaving: false, saveMessage: msg });
                setTimeout(() => set({ saveMessage: '' }), 3500);
                return { success: true, flowId };
            } else {
                const res = await api.post('/chatbot/flow', {
                    name: flowName,
                    description: flowDescription,
                    status,
                    nodes: sanitizedNodes,
                    edges,
                    keywords: effectiveKeywords,
                    viewport
                });
                const newId = res.data.flowId;
                const actualName = res.data.flowName || flowName;
                const msg = res.data?.message || 'Flow created and saved successfully!';
                set({ flowId: newId, flowName: actualName, nodes: sanitizedNodes, keywords: effectiveKeywords, isSaving: false, saveMessage: msg });
                if (typeof navigate === 'function') {
                    navigate(`/chatbot/flow/${newId}`, { replace: true });
                }
                setTimeout(() => set({ saveMessage: '' }), 3500);
                return { success: true, flowId: newId };
            }
        } catch (err) {
            console.error('Save Flow error:', err);
            const msg = err.response?.data?.message || err.message || 'Failed to save flow';
            set({ isSaving: false, errorMessage: msg });
            setTimeout(() => set({ errorMessage: '' }), 5000);
            return { success: false, error: msg };
        }
    }
}));
