import { CONFIG } from 'src/config-global';

import {DriversView} from "../sections/drivers/view";

// ----------------------------------------------------------------------

export default function Page() {
    return (
        <>
            <title>{`Drivers - ${CONFIG.appName}`}</title>

            <DriversView />
        </>
    );
}