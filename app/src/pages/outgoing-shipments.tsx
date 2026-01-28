import { CONFIG } from 'src/config-global';

import {OutgoingShipmentsView} from "../sections/outgoing-shipments/view";


// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Outgoing shipments - ${CONFIG.appName}`}</title>

      <OutgoingShipmentsView />
    </>
  );
}