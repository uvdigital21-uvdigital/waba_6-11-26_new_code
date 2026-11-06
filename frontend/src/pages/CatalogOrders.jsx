import React, { useState, useEffect } from 'react';
import { useTitle } from '../context/TitleContext.jsx';

const CatalogOrders = () => {
    const { setTitle } = useTitle();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setTitle('Catalog Order Report');
    }, [setTitle]);

    return (
        <div className="dashboard-content">
            <div className="template-management-card">
                <div className="template-management-header">
                    <div className="header-left">
                        <div className="official-template-icon" style={{ background: '#f3f4f6' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="9" y1="3" x2="9" y2="21"></line>
                                <line x1="15" y1="3" x2="15" y2="21"></line>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="3" y1="15" x2="21" y2="15"></line>
                            </svg>
                        </div>
                        <h1 className="page-title">Catalog Order Report</h1>
                    </div>
                    <div className="search-controls" style={{ gap: '15px' }}>
                        <input type="text" className="search-input" placeholder="Search from number..." />
                        <button className="btn-search">Search</button>
                        <select className="filter-select">
                            <option value="">Select By tonumber</option>
                        </select>
                        <input type="text" className="search-input" placeholder="Search catalog id here..." />
                        <button className="btn-search">Search</button>
                    </div>
                </div>

                <div className="template-controls">
                    <div className="show-entries">
                        <span>Show</span>
                        <select>
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                        <span>entries</span>
                    </div>
                    <div className="date-range-display" style={{ background: '#1abc9c' }}>
                        July 7, 2025 - July 7, 2026
                    </div>
                </div>

                <div className="table-container">
                    <table className="data-table">
                        <thead className="table-header">
                            <tr>
                                <th>+</th>
                                <th>From Name</th>
                                <th>From Number</th>
                                <th>Order Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="4" className="no-data">Loading...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="4" className="no-data">No data available in table</td></tr>
                            ) : (
                                <></>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="pagination-container">
                    <div className="showing-info">
                        Showing 0 to 0 of 0 entries
                    </div>
                    <div className="pagination-buttons">
                        <button className="btn-pagination" disabled>Previous</button>
                        <button className="btn-pagination" disabled>Next</button>
                    </div>
                </div>

                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                    <div style={{ background: '#1abc9c', color: 'white', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Quantity</h3>
                        <div style={{ background: 'white', color: 'black', padding: '15px', borderRadius: '4px' }}>
                            <p style={{ margin: 0, fontSize: '16px' }}>Total: 0</p>
                        </div>
                    </div>
                    <div style={{ background: '#1abc9c', color: 'white', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>Item Price</h3>
                        <div style={{ background: 'white', color: 'black', padding: '15px', borderRadius: '4px' }}>
                            <p style={{ margin: 0, fontSize: '16px' }}>Total: 0.00</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CatalogOrders;