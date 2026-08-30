import { BudayaPublicSurveyFlow } from '@/components/survey-budaya/BudayaPublicSurveyFlow';

export const metadata = {
  title: 'Survey Budaya Keselamatan Pasien',
};

export default async function SurveyBudayaTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <BudayaPublicSurveyFlow token={token} />;
}
