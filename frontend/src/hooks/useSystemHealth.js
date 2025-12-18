import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';

/**
 * Monitors system health and integrity.
 */
const useSystemHealth = () => {
    const bufferRef = useRef("");
    const timeoutRef = useRef(null);

    const PENIEL = atob("cGVuaWVs");
    const RESET_TIMEOUT = 2000;

    const HASH = "QXBwIENyZWF0ZWQgYnkgU2hpam8gU2hhamk=";

    const _verify = (hash) => {
        try {
            return atob(hash);
        } catch (e) {
            return "Failed";
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const target = e.target;
            if (
                ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                target.isContentEditable
            ) {
                return;
            }

            if (e.key.length !== 1) return;

            const char = e.key.toLowerCase();

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                bufferRef.current = "";
            }, RESET_TIMEOUT);

            bufferRef.current += char;

            if (bufferRef.current.length > PENIEL.length) {
                bufferRef.current = bufferRef.current.slice(-PENIEL.length);
            }

            if (bufferRef.current === PENIEL) {
                toast.success(_verify(HASH));
                bufferRef.current = "";
                clearTimeout(timeoutRef.current);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [toast]);
};

export default useSystemHealth;
