import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';

import { useEnumLabel } from 'src/utils/enumTranslations';

import { Region } from 'src/generated/api-client';

// ---------------------------------------------------------------------------

const regionValues = Object.values(Region).filter(
     (v): v is Region => typeof v === 'number',
);

interface RegionTabsProps {
     selectedRegion: Region;
     onRegionChange: (region: Region) => void;
}

export default function RegionTabs({ selectedRegion, onRegionChange }: RegionTabsProps) {
     const enumLabel = useEnumLabel();

     return (
          <Card>
               <Tabs
                    value={selectedRegion}
                    onChange={(_e, v: Region) => onRegionChange(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    textColor="primary"
                    indicatorColor="primary"
                    sx={{
                         m: 2,
                         minHeight: 42,
                         '& .MuiTabs-flexContainer': {
                              justifyContent: 'space-between',
                         },
                         '& .MuiTabScrollButton-root.Mui-disabled': {
                              opacity: 0.3,
                         },
                         '& .MuiTab-root': {
                              minHeight: 42,
                              flex: 1,
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              letterSpacing: '0.01em',
                         },
                    }}
               >
                    {regionValues.map((r) => (
                         <Tab key={r} value={r} label={enumLabel.region(r)} />
                    ))}
               </Tabs>
          </Card>
     );
}
