import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const LoadingContext = createContext(null)

// Global event bus for non-React contexts (e.g. Axios interceptors in api.js, AuthContext)
export const globalLoadingEvents = {
    start: (text) => {},
    stop: () => {}
}

export function LoadingProvider({ children }) {
    const [isLoading, setIsLoading] = useState(false)
    const [loadingText, setLoadingText] = useState('Loading...')
    const requestCountRef = useRef(0)
    const timerRef = useRef(null)
    const autoHideTimeoutRef = useRef(null)
    const location = useLocation()
    const prevPathRef = useRef(location.pathname)

    const hideLoader = useCallback((force = false) => {
        if (autoHideTimeoutRef.current) clearTimeout(autoHideTimeoutRef.current)
        if (timerRef.current) clearTimeout(timerRef.current)
        if (force) {
            requestCountRef.current = 0
            setIsLoading(false)
            return
        }
        requestCountRef.current = Math.max(0, requestCountRef.current - 1)
        if (requestCountRef.current === 0) {
            timerRef.current = setTimeout(() => {
                if (requestCountRef.current === 0) {
                    setIsLoading(false)
                }
            }, 80)
        }
    }, [])

    const showLoader = useCallback((text = 'Loading...') => {
        requestCountRef.current += 1
        setLoadingText(text)
        setIsLoading(true)

        // Safety timeout so loader never gets stuck indefinitely
        if (autoHideTimeoutRef.current) clearTimeout(autoHideTimeoutRef.current)
        autoHideTimeoutRef.current = setTimeout(() => {
            hideLoader(true)
        }, 5000)
    }, [hideLoader])

    // Link Axios and Auth global event handlers
    useEffect(() => {
        globalLoadingEvents.start = (text = 'Processing...') => {
            showLoader(text)
        }
        globalLoadingEvents.stop = () => {
            hideLoader(false)
        }
        return () => {
            globalLoadingEvents.start = () => {}
            globalLoadingEvents.stop = () => {}
        }
    }, [showLoader, hideLoader])

    // Smooth loader when navigating from 1 page to another page
    useEffect(() => {
        if (prevPathRef.current !== location.pathname) {
            const from = prevPathRef.current
            const to = location.pathname
            prevPathRef.current = to

            // Public & Auth routes that must NEVER show the page transition loading screen
            const publicRoutes = [
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

            const isNavigatingToPublic = publicRoutes.some(p => to.toLowerCase() === p.toLowerCase())
            if (isNavigatingToPublic || (from === '/' && to === '/login')) {
                hideLoader(true)
                return
            }

            showLoader('Loading Page...')
            const t = setTimeout(() => {
                hideLoader(false)
            }, 260)
            return () => {
                clearTimeout(t)
                hideLoader(true)
            }
        }
    }, [location.pathname, showLoader, hideLoader])

    return (
        <LoadingContext.Provider value={{ isLoading, loadingText, showLoader, hideLoader }}>
            {children}
        </LoadingContext.Provider>
    )
}

export function useLoading() {
    const ctx = useContext(LoadingContext)
    if (!ctx) {
        throw new Error('useLoading must be used within a LoadingProvider')
    }
    return ctx
}

