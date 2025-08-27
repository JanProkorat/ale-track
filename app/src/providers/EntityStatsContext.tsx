import React, { useState, useContext, useCallback, createContext } from 'react';

const EntityStatsContext = createContext<{
    refreshKey: number;
    triggerRefresh: () => void;
}>({
    refreshKey: 0,
    triggerRefresh: () => {},
});

export const EntityStatsProvider = ({ children }: { children: React.ReactNode }) => {
    const [refreshKey, setRefreshKey] = useState(0);

    const triggerRefresh = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    return (
        <EntityStatsContext.Provider value={{ refreshKey, triggerRefresh }}>
            {children}
        </EntityStatsContext.Provider>
    );
};

export const useEntityStatsRefresh = () => useContext(EntityStatsContext);