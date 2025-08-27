import {uuidv4} from "minimal-shared";
import React, {useState, useContext, useCallback, createContext} from 'react';

import {Alert, Snackbar} from '@mui/material';

type SnackbarType = 'success' | 'error' | 'info' | 'warning';

interface SnackbarMessage {
    id: string;
    message: string;
    severity: SnackbarType;
}

interface SnackbarContextType {
    showSnackbar: (message: string, severity?: SnackbarType) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
    const [snackbars, setSnackbars] = useState<SnackbarMessage[]>([]);

    const showSnackbar = useCallback((message: string, severity: SnackbarType = 'info') => {
        const id = uuidv4();
        setSnackbars(prev => [...prev, {id, message, severity}]);
    }, []);

    const handleClose = (id: string) => {
        setSnackbars(prev => prev.filter(snackbar => snackbar.id !== id));
    };

    return (
        <SnackbarContext.Provider value={{showSnackbar}}>
            {children}
            {snackbars.map((snackbar, index) => (
                <Snackbar
                    key={snackbar.id}
                    open
                    autoHideDuration={3000}
                    onClose={() => handleClose(snackbar.id)}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                    sx={{mb: index * 7}}
                >
                    <Alert onClose={() => handleClose(snackbar.id)} severity={snackbar.severity} variant="filled">
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            ))}
        </SnackbarContext.Provider>
    );
};

export const useSnackbar = (): SnackbarContextType => {
    const context = useContext(SnackbarContext);
    if (!context) throw new Error('useSnackbar must be used within a SnackbarProvider');
    return context;
};