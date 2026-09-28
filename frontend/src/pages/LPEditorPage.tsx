import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TiptapLPEditor } from '../components/TiptapLPEditor/TiptapLPEditor';
import { learningPathService } from '../services/learningPathService';
import { convertLpToTiptap } from '../components/TiptapLPEditor/convertLpToTiptap';
import { ArrowLeft, Sparkles } from 'lucide-react';

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
      <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#f8fafc', color: '#64748b' }}>
        <div style={{ fontSize: '24px' }}>⏳</div>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>Loading curriculum studio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ padding: '24px 32px', background: '#ffffff', borderRadius: '16px', border: '1px solid #fee2e2', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.08)', maxWidth: '440px' }}>
          <h2 style={{ color: '#dc2626', margin: '0 0 8px 0', fontSize: '18px' }}>Unable to Load Curriculum</h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 16px 0' }}>{error}</p>
          <button 
            onClick={() => navigate('/learning-paths')}
            style={{ padding: '8px 18px', background: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            ← Back to Learning Paths
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      {/* Studio Header Bar */}
      <header style={{
        padding: '12px 24px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 60,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            onClick={() => navigate('/learning-paths')} 
            style={{ 
              background: '#f8fafc', 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer', 
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            title="Return to Learning Paths list"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div style={{ width: '1px', height: '22px', background: '#e2e8f0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)', 
              color: '#4338ca', 
              fontSize: '11px', 
              fontWeight: 800, 
              padding: '3px 8px', 
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Sparkles size={11} /> STUDIO
            </span>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
              {pathId ? 'Edit Curriculum' : 'Curriculum Builder'}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            color: '#059669', 
            background: '#ecfdf5', 
            border: '1px solid #a7f3d0',
            padding: '3px 10px', 
            borderRadius: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            {pathId ? 'Live Edit Mode' : 'New Draft'}
          </span>
        </div>
      </header>

      {/* Editor Canvas Main */}
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
