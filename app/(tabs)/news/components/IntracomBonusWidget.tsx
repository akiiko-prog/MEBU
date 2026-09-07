import { withObservables } from '@nozbe/watermelondb/react';
import { useRouter } from 'expo-router';
import React from 'react';

import { getDatabaseInstance } from '@/database/DatabaseProvider';
import IntracomBonus from '@/database/models/IntracomBonus';

import HomeHeaderButton, { HomeHeaderButtonItem } from '../../index/components/HomeHeaderButton';
import { useTranslation } from 'react-i18next';

interface IntracomBonusWidgetProps {
    bonusRecords: IntracomBonus[];
}

const IntracomBonusWidget = ({ bonusRecords }: IntracomBonusWidgetProps) => {
    const router = useRouter();
    const { t } = useTranslation();
    const bonus = bonusRecords.length > 0 ? bonusRecords[0].total : null;

    const item: HomeHeaderButtonItem = {
        title: t("News_IntracomBonus_Title"),
        icon: "star",
        color: "#FFA500",
        description: bonus !== null ? `${bonus}` : "...",
        onPress: () => {
            router.push("/(modals)/intracom-bonus-history");
        }
    };

    return (
        <HomeHeaderButton item={item} />
    );
};

const enhance = withObservables([], () => ({
    bonusRecords: getDatabaseInstance().get<IntracomBonus>('intracom_bonus').query(),
}));

export default enhance(IntracomBonusWidget);
