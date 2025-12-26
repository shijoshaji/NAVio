import React, { createContext, useContext, useState, useEffect } from 'react';

const PrivacyContext = createContext();

export const PrivacyProvider = ({ children }) => {
    const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
        // Initialize from localStorage
        const saved = localStorage.getItem('privacyMode');
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        localStorage.setItem('privacyMode', JSON.stringify(isPrivacyMode));
    }, [isPrivacyMode]);

    const togglePrivacyMode = () => {
        setIsPrivacyMode(prev => !prev);
    };

    return (
        <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacyMode }}>
            {children}
        </PrivacyContext.Provider>
    );
};

export const usePrivacy = () => {
    const context = useContext(PrivacyContext);
    if (!context) {
        throw new Error('usePrivacy must be used within a PrivacyProvider');
    }
    return context;
};
