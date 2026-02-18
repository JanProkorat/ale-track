import { useMemo } from 'react';

import { AuthorizedClient } from './AuthorizedClient';

export function useAuthorizedClient(): AuthorizedClient {
    return useMemo(() => new AuthorizedClient(), []);
}
