import {CONFIG} from "../config-global";
import {UsersView} from "../sections/users/view";

export default function Page() {
    return (
        <>
            <title>{`Users - ${CONFIG.appName}`}</title>

            <UsersView />
        </>
    );
}