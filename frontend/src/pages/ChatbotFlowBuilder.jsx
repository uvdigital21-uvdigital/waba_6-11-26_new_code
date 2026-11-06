import React, { useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useReactFlow,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useFlowStore } from '../store/useFlowStore.js';
import { nodeTypes as baseNodeTypes } from '../components/flow/CustomNodes.jsx';
import ListNode from '../components/flow/ListNode.jsx';
import NodeSidebar from '../components/flow/NodeSidebar.jsx';
import NodeConfigPanel from '../components/flow/NodeConfigPanel.jsx';
import FlowHeader from '../components/flow/FlowHeader.jsx';
import api from '../services/api.js';
import './ChatbotFlowBuilder.css';

// Replace the "Text + List" node with the new green ListNode design.
// Any node type whose key contains "list" (e.g. text_list, list_message) uses ListNode.
// Defined at module level so the object stays stable between renders.
const listNodeKeys = Object.keys(baseNodeTypes).filter((key) => /list/i.test(key));
const nodeTypes = { ...baseNodeTypes };
(listNodeKeys.length > 0 ? listNodeKeys : ['text_list']).forEach((key) => {
    nodeTypes[key] = ListNode;
});
console.info('[ChatbotFlowBuilder] ListNode is used for node type(s):', listNodeKeys.length > 0 ? listNodeKeys : ['text_list']);

function FlowCanvas() {
    const { id } = useParams();
    const reactFlowWrapper = useRef(null);
    const { screenToFlowPosition } = useReactFlow();

    const nodes = useFlowStore((state) => state.nodes);
    const edges = useFlowStore((state) => state.edges);
    const onNodesChange = useFlowStore((state) => state.onNodesChange);
    const onEdgesChange = useFlowStore((state) => state.onEdgesChange);
    const onConnect = useFlowStore((state) => state.onConnect);
    const addNode = useFlowStore((state) => state.addNode);
    const setSelectedNode = useFlowStore((state) => state.setSelectedNode);
    const setFlow = useFlowStore((state) => state.setFlow);

    // Load Flow by ID if editing
    useEffect(() => {
        if (id && id !== 'new') {
            api.get(`/chatbot/flow/${id}`)
                .then((res) => {
                    if (res.data?.flow) {
                        setFlow(res.data.flow);
                    }
                })
                .catch((err) => console.error('Failed to load flow:', err));
        } else {
            // New Flow default starting node
            setFlow({
                id: 'new',
                name: 'New Chatbot Flow',
                nodes: [
                    {
                        id: 'node_start_1',
                        type: 'starting_keyword',
                        position: { x: 250, y: 100 },
                        data: { keywords: [], description: 'Trigger flow on matching keyword' }
                    }
                ],
                edges: []
            });
        }
    }, [id, setFlow]);

    // Drag & Drop onto Canvas
    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');
            const label = event.dataTransfer.getData('application/reactflow-label');

            if (!type) return;

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY
            });

            const newNode = {
                id: `node_${Date.now()}`,
                type,
                position,
                data: {
                    label: label || type,
                    message: '',
                    keywords: [],
                    buttons: [{ id: 'btn_1', text: 'Option 1' }]
                }
            };

            addNode(newNode);
        },
        [screenToFlowPosition, addNode]
    );

    const setViewport = useFlowStore((state) => state.setViewport);

    const onMoveEnd = useCallback((_, viewport) => {
        setViewport(viewport);
    }, [setViewport]);

    const onNodeClick = useCallback(
        (_, node) => {
            setSelectedNode(node);
        },
        [setSelectedNode]
    );

    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, [setSelectedNode]);

    return (
        <div className="flow-builder-container">
            <FlowHeader />

            <div className="flow-builder-workspace">
                <NodeSidebar />

                <div className="flow-canvas-area" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        onMoveEnd={onMoveEnd}
                        fitView
                        proOptions={{ hideAttribution: true }}
                    >
                        <Controls />
                        <MiniMap
                            nodeStrokeColor={(n) => (n.type === 'starting_keyword' ? '#10b981' : '#4f46e5')}
                            nodeColor={(n) => (n.type === 'end_flow' ? '#ef4444' : '#e0e7ff')}
                        />
                        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                    </ReactFlow>
                </div>

                <NodeConfigPanel />
            </div>
        </div>
    );
}

import { ErrorBoundary } from '../components/ErrorBoundary.jsx';

export default function ChatbotFlowBuilder() {
    return (
        <ErrorBoundary componentName="ChatbotFlowBuilder">
            <ReactFlowProvider>
                <FlowCanvas />
            </ReactFlowProvider>
        </ErrorBoundary>
    );
}