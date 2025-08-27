import { CONFIG } from 'src/config-global';

import { ClientsView } from 'src/sections/clients/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Clients - ${CONFIG.appName}`}</title>

      <ClientsView />
    </>
  );
}
