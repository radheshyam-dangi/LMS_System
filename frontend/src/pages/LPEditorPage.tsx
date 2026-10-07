import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TiptapLPEditor } from '../components/TiptapLPEditor/TiptapLPEditor';
import { learningPathService } from '../services/learningPathService';
import { convertLpToTiptap } from '../components/TiptapLPEditor/convertLpToTiptap';
import { ArrowLeft, Sparkles } from 'lucide-react';
import './LPEditorPage.css';

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
      <header className="lp-editor-header">
        <div className="lp-header-left">
          <button 
            onClick={() => navigate('/learning-paths')} 
            className="lp-header-back-btn"
            title="Return to Learning Paths list"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="lp-header-divider" />

          <div className="lp-header-title-group">
            <span className="lp-studio-badge">
              <Sparkles size={11} /> STUDIO
            </span>
            <h1 className="lp-header-title">
              {pathId ? 'Edit Curriculum' : 'Curriculum Builder'}
            </h1>
          </div>
        </div>

        <div className="lp-header-right">
          <span className="lp-status-badge">
            <span className="lp-status-dot" />
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
