import React from 'react'
import { useLocation } from 'react-router-dom'
import { useLoading } from '../context/LoadingContext.jsx'

export default function CoolGlobalLoader() {
    const { isLoading, loadingText } = useLoading()
    const location = useLocation()

    const publicPaths = [
        '/login',
        '/register',
        '/PrivacyPolicy',
        '/privacypolicy',
        '/privacy-policy',
        '/PRIVACY-POLICY',
        '/privacy',
        '/TermsAndConditions',
        '/termsandconditions',
        '/terms-and-conditions',
        '/TERMS-AND-CONDITIONS',
        '/terms'
    ]

    const isPublicPage = publicPaths.some(p => location.pathname.toLowerCase() === p.toLowerCase())

    if (!isLoading || isPublicPage) return null

    return (
        <>
            <style>{`
                @keyframes waba-spin-outer {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes waba-spin-inner {
                    0% { transform: rotate(360deg); }
                    100% { transform: rotate(0deg); }
                }
                @keyframes waba-pulse-glow {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 0 25px rgba(16, 185, 129, 0.6), 0 0 45px rgba(6, 182, 212, 0.4);
                    }
                    50% {
                        transform: scale(1.08);
                        box-shadow: 0 0 40px rgba(16, 185, 129, 0.9), 0 0 65px rgba(6, 182, 212, 0.7);
                    }
                }
                @keyframes waba-dots-bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40% { transform: translateY(-6px); opacity: 1; }
                }
                @keyframes waba-fade-in {
                    from { opacity: 0; backdrop-filter: blur(0px); }
                    to { opacity: 1; backdrop-filter: blur(6px); }
                }
                .waba-loader-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 999999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(15, 23, 42, 0.55);
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    animation: waba-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    pointer-events: all;
                    user-select: none;
                }
                .waba-loader-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 14px;
                    padding: 24px 32px;
                    background: #0f172a;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .waba-spinner-container {
                    position: relative;
                    width: 76px;
                    height: 76px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .waba-spinner-ring-outer {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    border: 3.5px solid transparent;
                    border-top-color: #10b981;
                    border-right-color: #34d399;
                    animation: waba-spin-outer 1s linear infinite;
                    filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.8));
                }
                .waba-spinner-ring-inner {
                    position: absolute;
                    inset: 9px;
                    border-radius: 50%;
                    border: 3px solid transparent;
                    border-bottom-color: #06b6d4;
                    border-left-color: #22d3ee;
                    animation: waba-spin-inner 0.8s linear infinite;
                    filter: drop-shadow(0 0 6px rgba(6, 182, 212, 0.7));
                }
                .waba-center-logo {
                    width: 36px;
                    height: 36px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffffff;
                    animation: waba-pulse-glow 1.6s ease-in-out infinite;
                }
                .waba-loader-text {
                    font-family: inherit;
                    font-size: 15px;
                    font-weight: 700;
                    color: #ffffff;
                    letter-spacing: 0.4px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    margin: 0;
                    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
                }
                .waba-dot-1 { animation: waba-dots-bounce 1.4s infinite 0.1s; }
                .waba-dot-2 { animation: waba-dots-bounce 1.4s infinite 0.25s; }
                .waba-dot-3 { animation: waba-dots-bounce 1.4s infinite 0.4s; }
                .waba-loader-subtext {
                    font-size: 11.5px;
                    font-weight: 700;
                    color: #34d399;
                    text-transform: uppercase;
                    letter-spacing: 1.8px;
                    margin-top: -6px;
                    text-shadow: 0 0 10px rgba(16, 185, 129, 0.6);
                }
            `}</style>

            <div className="waba-loader-overlay">
                <div className="waba-loader-content">
                    <div className="waba-spinner-container">
                        <div className="waba-spinner-ring-outer" />
                        <div className="waba-spinner-ring-inner" />
                        <div className="waba-center-logo">
                            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.49 0-2.95-.4-4.22-1.16l-.3-.18-3.13.82.83-3.05-.2-.31a8.163 8.163 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.28-8.24 2.21 0 4.29.86 5.85 2.42a8.23 8.23 0 0 1 2.42 5.84c0 4.55-3.7 8.24-8.27 8.24z"/>
                            </svg>
                        </div>
                    </div>
                    <p className="waba-loader-text">
                        {loadingText}
                        <span className="waba-dot-1">.</span>
                        <span className="waba-dot-2">.</span>
                        <span className="waba-dot-3">.</span>
                    </p>
                    <span className="waba-loader-subtext">Official WABA</span>
                </div>
            </div>
        </>
    )
}

