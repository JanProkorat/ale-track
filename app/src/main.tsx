import 'src/i18n/i18n';
import 'src/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'src/utils/leafletSetup';

import App from 'src/App';

createRoot(document.getElementById('root')!).render(
     <StrictMode>
          <App />
     </StrictMode>,
);
