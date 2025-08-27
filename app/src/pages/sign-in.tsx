import { CONFIG } from 'src/config-global';

import { SignInView } from 'src/sections/auth';

import {Logo} from "../components/logo";

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
        <Logo
            sx={{
                width: 290,
                height: 80,
                mt: -2,
                mb: 3,
                ml: 4,
            }}
        />
        <title>{`Sign in - ${CONFIG.appName}`}</title>
      <SignInView />
    </>
  );
}
