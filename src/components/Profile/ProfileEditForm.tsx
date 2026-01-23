import React, { useState, useEffect } from 'react';
import styles from './ProfileEditForm.module.css';
import { AvatarUpload } from './AvatarUpload';
import { ProfileCompletion } from './ProfileCompletion';

interface ProfileEditFormProps {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
  };
  onSubmit: (data: any) => Promise<void>;
  onAvatarUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  user,
  onSubmit,
  onAvatarUpload,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatarUrl: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState<any>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        avatarUrl: user.avatarUrl || '',
      });

      // Simulate profile completion data
      // In real app, this would come from API
      const completion = {
        completionScore: calculateCompletion(user),
        isComplete: false,
        missingFields: calculateMissingFields(user),
      };
      setProfileCompletion(completion);
    }
  }, [user]);

  const calculateCompletion = (userData: any) => {
    let score = 0;
    const fields = [
      userData.firstName,
      userData.lastName,
      userData.email,
      userData.phone,
      userData.avatarUrl,
    ];
    fields.forEach((field) => {
      if (field) score += 20;
    });
    return score;
  };

  const calculateMissingFields = (userData: any) => {
    const missing = [];
    if (!userData.firstName) missing.push('firstName');
    if (!userData.lastName) missing.push('lastName');
    if (!userData.email) missing.push('email');
    if (!userData.phone) missing.push('phone');
    if (!userData.avatarUrl) missing.push('avatarUrl');
    return missing;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (formData.phone && !/^[\d\s\-+()]+$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleAvatarUploadSuccess = async (avatarUrl: string) => {
    try {
      setFormData((prev) => ({
        ...prev,
        avatarUrl,
      }));
      setSuccessMessage('Avatar updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        avatar: 'Failed to upload avatar',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      setSuccessMessage('Profile updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Update completion
      const completion = {
        completionScore: calculateCompletion(formData),
        isComplete: calculateCompletion(formData) === 100,
        missingFields: calculateMissingFields(formData),
      };
      setProfileCompletion(completion);
    } catch (error: any) {
      setErrors({
        submit: error.message || 'Failed to update profile',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {profileCompletion && (
        <ProfileCompletion
          completionScore={profileCompletion.completionScore}
          isComplete={profileCompletion.isComplete}
          missingFields={profileCompletion.missingFields}
        />
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile Picture</h2>
          <AvatarUpload
            currentAvatar={formData.avatarUrl}
            onUploadSuccess={handleAvatarUploadSuccess}
            onUploadError={(error) =>
              setErrors((prev) => ({ ...prev, avatar: error }))
            }
            isLoading={isLoading}
          />
          {errors.avatar && (
            <p className={styles.error}>{errors.avatar}</p>
          )}
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Personal Information</h2>

          <div className={styles.formGroup}>
            <label htmlFor="firstName" className={styles.label}>
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={`${styles.input} ${
                errors.firstName ? styles.inputError : ''
              }`}
              placeholder="John"
              disabled={isSubmitting || isLoading}
            />
            {errors.firstName && (
              <p className={styles.error}>{errors.firstName}</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="lastName" className={styles.label}>
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={`${styles.input} ${
                errors.lastName ? styles.inputError : ''
              }`}
              placeholder="Doe"
              disabled={isSubmitting || isLoading}
            />
            {errors.lastName && (
              <p className={styles.error}>{errors.lastName}</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`${styles.input} ${
                errors.email ? styles.inputError : ''
              }`}
              placeholder="john@example.com"
              disabled={isSubmitting || isLoading}
            />
            {errors.email && (
              <p className={styles.error}>{errors.email}</p>
            )}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="phone" className={styles.label}>
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`${styles.input} ${
                errors.phone ? styles.inputError : ''
              }`}
              placeholder="+1 (555) 000-0000"
              disabled={isSubmitting || isLoading}
            />
            {errors.phone && (
              <p className={styles.error}>{errors.phone}</p>
            )}
          </div>
        </div>

        {successMessage && (
          <div className={styles.success}>{successMessage}</div>
        )}
        {errors.submit && (
          <div className={styles.submitError}>{errors.submit}</div>
        )}

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
