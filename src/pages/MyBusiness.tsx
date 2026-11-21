import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BusinessProfileEditor } from '@/components/advertising/BusinessProfileSetup';
import { Button } from '@/components/ui/button';
import { useAdvertising } from '@/hooks/useAdvertising';

export default function MyBusiness() {
  const { t } = useTranslation();
  const advertising = useAdvertising();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState(params.get('abrir') === '1');
  const profile = advertising.businessProfile;

  return (
    <main className="mx-auto max-w-md space-y-5 px-5 py-8">
      <Link to="/profile" className="text-primary underline">{t('profile.title', 'Perfil')}</Link>
      <h1 className="text-2xl font-semibold">{t('entry.myBusinesses')}</h1>
      {advertising.loading ? <p role="status">…</p> : (
        <>
          {profile && <h2 className="font-semibold">{profile.business_name}</h2>}
          <Button onClick={() => setEditing(true)}>{t(profile ? 'entry.manageBusiness' : 'entry.business')}</Button>
          {editing && <BusinessProfileEditor advertising={advertising} open onOpenChange={setEditing} />}
        </>
      )}
    </main>
  );
}
