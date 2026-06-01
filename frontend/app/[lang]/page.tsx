import { getDictionary, resolveLocale } from './dictionaries';
import { AuthRedirect } from '@/src/app/ui/AuthRedirect';
import { LoginButton } from '@/app/ui/LoginButton';

type PageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);
  return {
    title: `${dict.general.title}`,
    description: dict.general.description,
  };
}

export default async function Page({ params }: PageProps) {
  const param = await params;
  const locale = resolveLocale(param.lang);
  const dict = await getDictionary(locale);

  return (
    <AuthRedirect to={`/${locale}/forms`} ifLogged={true}>
      <div className="text-center h1 mt-5">Welcome to CHEFS 2!</div>
      <div className="d-flex justify-content-center mt-4">
        <LoginButton label={dict.general.login} />
      </div>
    </AuthRedirect>
  );
}
