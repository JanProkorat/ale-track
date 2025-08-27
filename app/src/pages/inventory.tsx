import { CONFIG } from 'src/config-global';

import {InventoryView} from "../sections/inventory/view";


// ----------------------------------------------------------------------

export default function Page() {
    return (
        <>
            <title>{`Inventory - ${CONFIG.appName}`}</title>

            <InventoryView />
        </>
    );
}