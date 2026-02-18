import type { ReactNode } from 'react';

import {jwtDecode} from 'jwt-decode';
import { useState, useEffect, useContext, useCallback, useMemo, createContext } from 'react';

import type {UserRoleType} from "../api/Client";

type User = {
    name: string;
    exp: number;
    role: UserRoleType,
    [key: string]: any;
};

const claimMappingRoleKey = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';
const claimMappings = {
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': 'id',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'name',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'firstName',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname': 'lastName',
    claimMappingRoleKey: 'role'
};

type AuthContextType = {
    user: User | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    signIn: (token: string) => void;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authTokenLocalStorageKey = 'authToken';

function decodeAndMapToken(token: string): User | null {
    try {
        const decodedToken = jwtDecode<any>(token);
        const tokenUser: User = {
            name: '',
            exp: decodedToken.exp ?? 0,
            role: decodedToken[claimMappingRoleKey] as UserRoleType
        };
        Object.entries(decodedToken).forEach(([key, value]) => {
            if (key in claimMappings) {
                const mappedKey = claimMappings[key as keyof typeof claimMappings];
                tokenUser[mappedKey] = mappedKey === 'role' ? value as UserRoleType : value;
            } else {
                tokenUser[key] = value;
            }
        });
        return tokenUser;
    } catch {
        return null;
    }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isInitialized, setInitialized] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem(authTokenLocalStorageKey);
        if (token) {
            const tokenUser = decodeAndMapToken(token);
            if (tokenUser && tokenUser.exp * 1000 >= Date.now()) {
                setUser(tokenUser);
            } else {
                localStorage.removeItem(authTokenLocalStorageKey);
            }
        }
        setInitialized(true);
    }, []);

    const signIn = useCallback((token: string) => {
        localStorage.setItem(authTokenLocalStorageKey, token);
        const tokenUser = decodeAndMapToken(token);
        if (tokenUser) {
            setUser(tokenUser);
        } else {
            localStorage.removeItem(authTokenLocalStorageKey);
            setUser(null);
        }
    }, []);

    const signOut = useCallback(async () => {
        localStorage.removeItem(authTokenLocalStorageKey);
        setUser(null);
    }, []);

    const value = useMemo(
        () => ({ user, isInitialized, isAuthenticated: !!user, signIn, signOut }),
        [user, isInitialized, signIn, signOut]
    );

    return (
        <AuthContext.Provider value={value}>
        {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};