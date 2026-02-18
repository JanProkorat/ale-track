import React, { useMemo, useState, useContext, useCallback, createContext } from 'react';

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

     const value = useMemo(() => ({ refreshKey, triggerRefresh }), [refreshKey, triggerRefresh]);

     return <EntityStatsContext.Provider value={value}>{children}</EntityStatsContext.Provider>;
};

export const useEntityStatsRefresh = () => useContext(EntityStatsContext);
