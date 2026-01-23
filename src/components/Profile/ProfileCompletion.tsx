import React, { useState, useEffect } from 'react';
import styles from './ProfileCompletion.module.css';

interface ProfileCompletionProps {
  completionScore: number;
  isComplete: boolean;
  missingFields: string[];
}

export const ProfileCompletion: React.FC<ProfileCompletionProps> = ({
  completionScore,
  isComplete,
  missingFields,
}) => {
  const getCompletionColor = (score: number) => {
    if (score === 100) return '#10b981'; // green
    if (score >= 80) return '#f59e0b'; // amber
    if (score >= 50) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const getCompletionMessage = (score: number) => {
    if (score === 100) return 'Profile Complete!';
    if (score >= 80) return 'Almost there!';
    if (score >= 50) return 'Keep improving';
    return 'Incomplete';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Profile Completion</h3>
        <span className={styles.score}>{completionScore}%</span>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progress}
          style={{
            width: `${completionScore}%`,
            backgroundColor: getCompletionColor(completionScore),
          }}
        />
      </div>

      <p className={styles.message}>
        {getCompletionMessage(completionScore)}
      </p>

      {!isComplete && missingFields.length > 0 && (
        <div className={styles.missingFields}>
          <h4>Complete these fields:</h4>
          <ul>
            {missingFields.map((field) => (
              <li key={field}>
                {field === 'firstName'
                  ? 'First Name'
                  : field === 'lastName'
                    ? 'Last Name'
                    : field === 'avatarUrl'
                      ? 'Profile Picture'
                      : field.charAt(0).toUpperCase() + field.slice(1)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
