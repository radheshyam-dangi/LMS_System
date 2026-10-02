import { RichText } from './RichText';
import { resolveAssignmentInstructions } from '../../utils/assignmentInstructions';

type Props = { assignment: any; onContinue: () => void; onCancel: () => void };

/** Blocks assignment questions until the trainee acknowledges the instructions. */
export function AssignmentInstructionsGate({ assignment, onContinue, onCancel }: Props) {
  const { content, hasCustom } = resolveAssignmentInstructions(assignment);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="assignment-instructions-title" onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,0.65)' }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: 700, maxWidth: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 12, background: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div>
            <h4 id="assignment-instructions-title" style={{ margin: 0, color: '#0f172a', fontSize: 18 }}>Assignment Instructions</h4>
            {!hasCustom && <span style={{ fontSize: 12, color: '#64748b' }}>Default instructions</span>}
          </div>
          <button type="button" aria-label="Close instructions" onClick={onCancel} style={{ border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 24 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 24, color: '#334155', fontSize: 14, lineHeight: 1.6 }}>
          <RichText content={content} emptyStateText="No instructions provided." />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button type="button" onClick={onCancel} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: '#e2e8f0', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button type="button" onClick={onContinue} style={{ padding: '10px 20px', border: 'none', borderRadius: 6, background: '#0f172a', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Close &amp; Continue</button>
        </div>
      </div>
    </div>
  );
}
