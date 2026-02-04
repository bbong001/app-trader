import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useAppTranslation } from '../../hooks/useAppTranslation';

export default function ProfileHeader() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const email = useAuthStore((s) => s.email);
  const token = useAuthStore((s) => s.token);
  const [uid, setUid] = useState<string | null>(null);
  const { t } = useAppTranslation();

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setUid(null);
      return;
    }

    const fetchUid = async () => {
      try {
        const res = await fetch('/api/auth/uid', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUid(data.uid);
          }
        }
      } catch (error) {
        console.error('Error fetching UID:', error);
      }
    };

    fetchUid();
  }, [isLoggedIn, token]);

  return (
    <div className="bg-gray-900 px-4 py-4 flex items-center justify-between">
      {isLoggedIn ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="text-white text-lg font-medium leading-tight">
              {(email || 'user@email.com').toLowerCase()}
            </div>
            <span className="inline-block w-2 h-2 rounded-full bg-lime-400" />
          </div>
          <div className="text-gray-400 text-sm">
            {t('profile.uidLabel')}:{uid ?? '----'}&nbsp;&nbsp;
            {t('profile.creditScore', { score: 100 })}
          </div>
        </div>
      ) : (
        <a
          href="/login"
          className="bg-green-500 hover:bg-green-600 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {t('profile.goToLogin')}
        </a>
      )}

      {/* Globe icon */}
      <a href="/language" className="p-2 active:bg-gray-800 rounded-lg transition">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </a>
    </div>
  );
}
