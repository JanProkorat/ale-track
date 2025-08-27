import { CONFIG } from 'src/config-global';

import {OrdersView} from "../sections/orders/view";


// ----------------------------------------------------------------------

export default function Page() {
    return (
        <>
            <title>{`Orders - ${CONFIG.appName}`}</title>

            <OrdersView />
        </>
    );
}