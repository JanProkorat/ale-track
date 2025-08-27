import { CONFIG } from 'src/config-global';

import {ProductDeliveriesView} from "../sections/product-deliveries/view";

// ----------------------------------------------------------------------

export default function Page() {
    return (
        <>
            <title>{`Product deliveries - ${CONFIG.appName}`}</title>

            <ProductDeliveriesView />
        </>
    );
}