import { CONFIG } from 'src/config-global';

import {VehiclesView} from "../sections/vehicles/view";

// ----------------------------------------------------------------------

export default function Page() {
    return (
        <>
            <title>{`Vehicles - ${CONFIG.appName}`}</title>

            <VehiclesView />
        </>
    );
}