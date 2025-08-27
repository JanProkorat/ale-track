import { CONFIG } from 'src/config-global';

import {BreweriesView} from "../sections/breweries/view";

// ----------------------------------------------------------------------

export default function Page() {
    return (
        <>
            <title>{`Breweries - ${CONFIG.appName}`}</title>

            <BreweriesView />
        </>
    );
}
