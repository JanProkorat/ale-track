import type { ReactNode } from 'react';

import {jwtDecode} from 'jwt-decode';
import { useState, useEffect, useContext, createContext } from 'react';

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isInitialized, setInitialized] = useState(false);

    const authTokenLocalStorageKey = 'authToken';

    useEffect(() => {
        const token = localStorage.getItem(authTokenLocalStorageKey);
        if (token) {
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
                const isExpired = tokenUser.exp * 1000 < Date.now();
                if (!isExpired) {
                    setUser(tokenUser);
                } else {
                    localStorage.removeItem(authTokenLocalStorageKey);
                }
            } catch {
                localStorage.removeItem(authTokenLocalStorageKey);
            }
        }
        setInitialized(true);
    }, []);

    const signIn = (token: string) => {
        localStorage.setItem(authTokenLocalStorageKey, token);
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

            setUser(tokenUser);
        } catch {
            localStorage.removeItem(authTokenLocalStorageKey);
            setUser(null);
        }
    };

    const signOut = async () => {
        localStorage.removeItem(authTokenLocalStorageKey);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isInitialized, isAuthenticated: !!user, signIn, signOut }}>
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