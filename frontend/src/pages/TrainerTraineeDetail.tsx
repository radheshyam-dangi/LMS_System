import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProgressAnalyticsSection } from '../components/ProgressAnalyticsSection/ProgressAnalyticsSection';
import type { SessionUser, RoleName } from '../types/auth';
import { userService } from '../services/userService';

type TrainerTraineeDetailProps = {
  accessToken: string;
  activeRole: RoleName;
  currentUser: SessionUser;
};

export function TrainerTraineeDetail({ accessToken, activeRole, currentUser }: TrainerTraineeDetailProps) {
  const { traineeId } = useParams<{ traineeId: string }>();
  const navigate = useNavigate();
  const [traineeName, setTraineeName] = useState('Trainee');

  useEffect(() => {
    if (traineeId && accessToken) {
      userService.fetchUserById(traineeId, accessToken)
        .then((data: any) => {
          if (data && data.firstName) {
            setTraineeName([data.firstName, data.lastName].filter(Boolean).join(' '));
          } else if (data && data.email) {
            setTraineeName(data.email);
          } else if (data && data.name) {
            setTraineeName(data.name);
          }
        })
        .catch((err: any) => console.error('Failed to load trainee name', err));
    }
  }, [traineeId, accessToken]);

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{ padding: '24px 32px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px',
            cursor: 'pointer', color: '#475569', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
          }}
        >
          <span>&larr;</span> Back to Overview
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
          {traineeName} — Progress
        </h1>
      </div>
      
      {/* We pass the traineeId and trainerId to ProgressAnalyticsSection.
          activeRole is passed as 'Trainee' to trigger the Trainee layout (not the Reports layout).
      */}
      <ProgressAnalyticsSection
        currentUser={currentUser}
        activeRole="Trainee"
        accessToken={accessToken}
        targetTraineeId={traineeId}
        scopedToTrainerId={currentUser.id}
      />
    </div>
  );
}
