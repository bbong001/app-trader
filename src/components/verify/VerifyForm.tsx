import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import InputField from '../login/InputField';
import IdUploadCard from './IdUploadCard';
import { useAppTranslation } from '../../hooks/useAppTranslation';
import { useAuthStore } from '../../stores/authStore';
import { useUserVerification } from '../../hooks/useUserVerification';

type VerifyFormData = {
  name: string;
  idNumber: string;
  frontId: File;
  backId: File;
};

export default function VerifyForm() {
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const { t } = useAppTranslation();

  const verifySchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t('verify.form.errors.nameRequired')),
        idNumber: z
          .string()
          .min(1, t('verify.form.errors.idRequired')),
        frontId: z
          .any()
          .refine(
            (file) => file instanceof File,
            t('verify.form.errors.frontRequired'),
          ),
        backId: z
          .any()
          .refine(
            (file) => file instanceof File,
            t('verify.form.errors.backRequired'),
          ),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
  });

  const handleFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('frontId', file, { shouldValidate: true });
      setFrontPreview(URL.createObjectURL(file));
    }
  };

  const handleBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue('backId', file, { shouldValidate: true });
      setBackPreview(URL.createObjectURL(file));
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { token } = useAuthStore();
  
  // Check verification status periodically
  useUserVerification();

  const onSubmit = async (data: VerifyFormData) => {
    if (!token) {
      setSubmitError('Please log in to submit verification');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('idNumber', data.idNumber);
      formData.append('frontId', data.frontId);
      formData.append('backId', data.backId);

      const response = await fetch('/api/verify/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit verification');
      }

      alert(t('verify.form.submittedAlert') || 'Verification request submitted successfully!');
      
      // Refresh user info to get latest verification status
      if (token) {
        try {
          const userResponse = await fetch('/api/user/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const { updateVerificationStatus } = useAuthStore.getState();
            updateVerificationStatus(userData.data?.isVerified || false);
          }
        } catch (error) {
          console.error('Error refreshing user info:', error);
        }
      }
      
      // Reset form
      setFrontPreview(null);
      setBackPreview(null);
      // Reset form fields
      const form = document.querySelector('form');
      form?.reset();
    } catch (error: any) {
      console.error('Error submitting verification:', error);
      setSubmitError(error.message || 'Failed to submit verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-4 pb-24 bg-gray-900">
      <InputField
        label={t('verify.form.nameLabel')}
        name="name"
        placeholder={t('verify.form.namePlaceholder')}
        register={register as any}
        error={errors.name as any}
      />

      <InputField
        label={t('verify.form.idNumberLabel')}
        name="idNumber"
        type="text"
        placeholder={t('verify.form.idNumberPlaceholder')}
        register={register as any}
        error={errors.idNumber as any}
      />

      <p className="text-center text-green-400 text-sm mt-8 mb-6">
        {t('verify.form.uploadHint')}
      </p>

      <div className="flex flex-col items-center">
        <IdUploadCard
          label={t('verify.form.idUpload.frontLabel')}
          inputId="front-id"
          onChange={handleFrontChange}
          previewUrl={frontPreview}
          error={errors.frontId?.message as string | undefined}
        />

        <IdUploadCard
          label={t('verify.form.idUpload.backLabel')}
          inputId="back-id"
          onChange={handleBackChange}
          previewUrl={backPreview}
          error={errors.backId?.message as string | undefined}
        />
      </div>

      {submitError && (
        <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm text-center">{submitError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full mt-4 mb-6 bg-green-500 text-gray-900 font-semibold py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting 
          ? (t('verify.form.submitting') || 'Submitting...') 
          : t('verify.form.submitButton')
        }
      </button>
    </form>
  );
}


