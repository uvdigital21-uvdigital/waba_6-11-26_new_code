import React, { createContext, useState, useContext } from 'react'

const TitleContext = createContext()

export function useTitle() {
    const context = useContext(TitleContext)
    if (!context) {
        throw new Error('useTitle must be used within a TitleProvider')
    }
    return context
}

export function TitleProvider({ children }) {
    const [title, setTitle] = useState('Dashboard')

    return (
        <TitleContext.Provider value={{ title, setTitle }}>
            {children}
        </TitleContext.Provider>
    )
}

export default TitleContext