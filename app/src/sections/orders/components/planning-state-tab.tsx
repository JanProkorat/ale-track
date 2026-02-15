import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Tab, Tabs } from "@mui/material";

import { PlanningState } from "src/api/Client";

type PlanningStateTabProps = {
    onPlanningStateChange: (selectedState: PlanningState) => void;
};

export function PlanningStateTab({ onPlanningStateChange }: Readonly<PlanningStateTabProps>) {
    const { t } = useTranslation();

    const [selectedState, setSelectedState] = useState<PlanningState>(PlanningState.Active);

    return (
        <Tabs
            value={selectedState}
            onChange={(_, newValue) => {
                setSelectedState(newValue);
                onPlanningStateChange(newValue);
            }}
            textColor="secondary"
            indicatorColor="secondary"
            variant="fullWidth"
        >
            {Object.keys(PlanningState)
                .filter((key) => isNaN(Number(key)))
                .map((planningState) => {
                    const planningStateEnumValue = PlanningState[planningState as keyof typeof PlanningState];
                    return (
                        <Tab key={planningState} value={planningStateEnumValue} label={t('PlanningState.' + planningState)} />
                    );
                })}
        </Tabs>
    );
}