import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TiptapLPEditor } from '../components/TiptapLPEditor/TiptapLPEditor';
import { learningPathService } from '../services/learningPathService';
import { convertLpToTiptap } from '../components/TiptapLPEditor/convertLpToTiptap';

export default function LPEditorPage() {
  const { pathId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const focusAction = location.state?.action;
  const targetId = location.state?.targetId;

  useEffect(() => {
    if (!pathId) {
      // Creating new LP
      setInitialData(null);
      setLoading(false);
      return;
    }

    // Editing existing LP
    const fetchLp = async () => {
      try {
        const token = localStorage.getItem('skillforge_access_token');
        if (!token) throw new Error('Not authenticated');
        const lp = await learningPathService.fetchPathById(pathId, token);
        const tiptapJson = convertLpToTiptap(lp);
        setInitialData(tiptapJson);
      } catch (err: any) {
        setError(err.message || 'Failed to load learning path');
      } finally {
        setLoading(false);
      }
    };
    fetchLp();
  }, [pathId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        Loading editor...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'red' }}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/learning-paths')}>Back to Dashboard</button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate('/learning-paths')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>
          ← Back
        </button>
        <h1 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
          {pathId ? 'Edit Learning Path' : 'Create Learning Path'}
        </h1>
      </header>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <TiptapLPEditor 
          initialDraftData={initialData} 
          pathId={pathId} 
          focusAction={focusAction}
          targetId={targetId}
        />
      </main>
    </div>
  );
}
