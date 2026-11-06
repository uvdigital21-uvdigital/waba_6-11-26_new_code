import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlowStore } from '../../store/useFlowStore.js';
import { FiArrowLeft, FiSave, FiTrash2, FiLayout, FiRotateCcw, FiRotateCw } from 'react-icons/fi';

export default function FlowHeader() {
    const navigate = useNavigate();
    const flowName = useFlowStore((state) => state.flowName);
    const setFlowName = useFlowStore((state) => state.setFlowName);
    const isSaving = useFlowStore((state) => state.isSaving);
    const saveMessage = useFlowStore((state) => state.saveMessage);
    const errorMessage = useFlowStore((state) => state.errorMessage);
    const saveFlow = useFlowStore((state) => state.saveFlow);
    const clearFlow = useFlowStore((state) => state.clearFlow);
    const undo = useFlowStore((state) => state.undo);
    const redo = useFlowStore((state) => state.redo);
    const addNode = useFlowStore((state) => state.addNode);

    const handleAddTemplate = () => {
        addNode({
            id: `node_${Date.now()}`,
            type: 'template',
            position: { x: 300, y: 250 },
            data: { templateName: '' }
        });
    };

    const handleClear = () => {
        if (window.confirm('Are you sure you want to clear all nodes except the Starting node?')) {
            clearFlow();
        }
    };

    return (
        <header className="flow-studio-header">
            <div className="header-left">
                <button type="button" className="btn-icon-header" title="Back to Chatbot List" onClick={() => navigate('/chatbot')}>
                    <FiArrowLeft size={18} />
                </button>

                <div className="flow-name-input-wrapper">
                    <input
                        type="text"
                        className="flow-title-input"
                        value={flowName}
                        onChange={(e) => setFlowName(e.target.value)}
                        placeholder="Chatbot Flow Name..."
                    />
                </div>
            </div>

            <div className="header-actions">
                <div className="undo-redo-group">
                    <button type="button" className="btn-tool-header" title="Undo" onClick={undo}>
                        <FiRotateCcw size={16} />
                    </button>
                    <button type="button" className="btn-tool-header" title="Redo" onClick={redo}>
                        <FiRotateCw size={16} />
                    </button>
                </div>

                <button type="button" className="btn-secondary-header" onClick={handleAddTemplate}>
                    <FiLayout size={16} /> Add Template
                </button>

                <button type="button" className="btn-danger-header" onClick={handleClear}>
                    <FiTrash2 size={16} /> Clear
                </button>

                <button
                    type="button"
                    className="btn-primary-header"
                    onClick={() => saveFlow(navigate)}
                    disabled={isSaving}
                >
                    <FiSave size={16} />
                    {isSaving ? 'Saving...' : 'Save ChatBot Flow'}
                </button>
            </div>

            {(saveMessage || errorMessage) && (
                <div className={`header-toast ${errorMessage ? 'error' : 'success'}`}>
                    <span>{errorMessage ? '⚠️' : '✅'}</span>
                    <span>{errorMessage || saveMessage}</span>
                </div>
            )}
        </header>
    );
}
