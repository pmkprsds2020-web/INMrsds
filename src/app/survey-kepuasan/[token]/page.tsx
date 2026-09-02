import { KepuasanPublicSurveyFlow } from '@/components/survey-kepuasan/KepuasanPublicSurveyFlow';

export const metadata = {
  title: 'Survey Kepuasan Pasien',
};

export default async function SurveyKepuasanTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <KepuasanPublicSurveyFlow token={token} />;
}
