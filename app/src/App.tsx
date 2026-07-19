import { RouterProvider } from 'react-router-dom';
import { AppProviders } from 'src/providers/AppProviders';
import { router } from 'src/routes/router';

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
