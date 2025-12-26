import React from 'react';
import { usePrivacy } from '../context/PrivacyContext';

const PrivacyGuard = ({ children, className = "", blurIntensity = "blur-sm" }) => {
    const { isPrivacyMode } = usePrivacy();

    if (isPrivacyMode) {
        return (
            <span className={`filter ${blurIntensity} select-none transition-all duration-300 ${className}`} title="Hidden for Privacy">
                {children}
            </span>
        );
    }

    return <span className={className}>{children}</span>;
};

export default PrivacyGuard;
